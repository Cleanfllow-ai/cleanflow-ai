import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import { fileManagementAPI, FileStatusResponse } from "@/modules/files"
import { isFetchAbortError } from "@/modules/shared/api-error"
import { RootState } from "@/shared/store/store"

export interface FilesListError {
  message: string
  /** HTTP status code (401, 500, etc.) — null for network errors */
  status: number | null
}

interface FilesState {
  items: FileStatusResponse[]
  status: "idle" | "loading" | "succeeded" | "failed"
  error: FilesListError | null
  lastUpdated: number | null
}

const initialState: FilesState = {
  items: [],
  status: "idle",
  error: null,
  lastUpdated: null,
}

export const fetchFiles = createAsyncThunk(
  "files/fetchFiles",
  async (authToken: string, { rejectWithValue }) => {
    try {
      const response = await fileManagementAPI.getUploads(authToken)
      return response.items || []
    } catch (error: any) {
      // R2 P0-1 (2026-05-19): navigation-cancel aborts shouldn't transition
      // the slice to "failed" — leave it loadable so the next mount re-tries
      // without surfacing a stale error banner from the abandoned navigation.
      if (isFetchAbortError(error)) {
        return rejectWithValue({
          message: "__navigation_cancel__",
          status: null,
        })
      }
      // Preserve the HTTP status so callers can distinguish 401 (session
      // expired) from 5xx (server error) and show the correct toast.
      return rejectWithValue({
        message: error.message || "Failed to fetch files",
        status: error.status ?? null,
      })
    }
  }
)

// Per-session cache of upload IDs whose dq_report.json doesn't exist on the
// backend (legacy artifacts, partial pipelines, etc). Skipping these on
// subsequent poll cycles eliminates 404 console spam without changing
// backend behavior.
const _MISSING_REPORT_IDS = new Set<string>()

export const enrichFiles = createAsyncThunk(
  "files/enrichFiles",
  async ({ files, authToken }: { files: FileStatusResponse[]; authToken: string }, { dispatch }) => {
    const CHUNK_SIZE = 5
    const updates: { id: string; seconds: number }[] = []

    const _DQ_DONE_STATUSES = new Set(["DQ_FIXED", "COMPLETED", "DQ_COMPLETE"])
    const processedFiles = files.filter(
      f => _DQ_DONE_STATUSES.has(f.status) && !_MISSING_REPORT_IDS.has(f.upload_id),
    )
    for (let i = 0; i < processedFiles.length; i += CHUNK_SIZE) {
      const chunk = processedFiles.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map(async (file) => {
          try {
            const report = await fileManagementAPI.downloadDqReport(file.upload_id, authToken)
            let seconds = report.processing_time_seconds

            if (seconds === undefined && report.processing_time) {
              const pt = report.processing_time as any
              if (typeof pt === "number") seconds = pt
              else if (typeof pt === "string") seconds = parseFloat(pt)
            }

            if (seconds !== undefined) {
              updates.push({ id: file.upload_id, seconds })
            }
          } catch (e: any) {
            const msg = String(e?.message || "")
            if (/404|not found|not available/i.test(msg)) {
              _MISSING_REPORT_IDS.add(file.upload_id)
            }
          }
        })
      )
    }
    return updates
  }
)

const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    updateFile: (state, action: PayloadAction<FileStatusResponse>) => {
      const index = state.items.findIndex((f) => f.upload_id === action.payload.upload_id)
      if (index !== -1) {
        state.items[index] = action.payload
      } else {
        state.items.unshift(action.payload)
      }
    },
    removeFile: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((f) => f.upload_id !== action.payload)
    },
    resetFiles: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch Files
      .addCase(fetchFiles.pending, (state) => {
        state.status = "loading"
        state.error = null
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.status = "succeeded"
        state.items = action.payload
        state.lastUpdated = Date.now()
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        const payload = action.payload as FilesListError
        // R2 P0-1: navigation-cancel sentinel — keep slice idle so the next
        // mount can re-fetch instead of getting stuck on a failed banner.
        if (payload?.message === "__navigation_cancel__") {
          state.status = "idle"
          state.error = null
          return
        }
        state.status = "failed"
        state.error = payload
      })
      // Enrich Files
      .addCase(enrichFiles.fulfilled, (state, action) => {
        if (action.payload.length > 0) {
          action.payload.forEach((update) => {
            const file = state.items.find((f) => f.upload_id === update.id)
            if (file) {
              file.processing_time_seconds = update.seconds
            }
          })
        }
      })
  },
})

export const { updateFile, removeFile, resetFiles } = filesSlice.actions

export const selectFiles = (state: RootState) => state.files.items
export const selectFilesStatus = (state: RootState) => state.files.status
export const selectFilesError = (state: RootState) => state.files.error as FilesListError | null

export default filesSlice.reducer
