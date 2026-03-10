import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import { fileManagementAPI, FileStatusResponse } from "@/modules/files"
import { RootState } from "@/shared/store/store"

interface FilesState {
  items: FileStatusResponse[]
  status: "idle" | "loading" | "succeeded" | "failed"
  error: string | null
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
      return rejectWithValue(error.message || "Failed to fetch files")
    }
  }
)

export const enrichFiles = createAsyncThunk(
  "files/enrichFiles",
  async ({ files, authToken }: { files: FileStatusResponse[]; authToken: string }, { dispatch }) => {
    const CHUNK_SIZE = 5
    const updates: { id: string; seconds: number }[] = []

    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE)
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
          } catch (e) {
            console.warn(`Failed to fetch report for time enrichment: ${file.upload_id}`)
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
    resetFiles: (state) => {
      return initialState
    }
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
        state.status = "failed"
        state.error = action.payload as string
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
export const selectFilesError = (state: RootState) => state.files.error

export default filesSlice.reducer
