import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"

import type { FileItem, FileStats } from "@/modules/files/types"

import { FILES_API_CONFIG } from "./file-manager.utils"

interface ToastLike {
  (args: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }): void
}

interface UseFileUploadParams {
  idToken: string | null
  toast: ToastLike
  loadFiles: () => Promise<void>
  updateStats: (fileList: FileItem[]) => void
  setFiles: Dispatch<SetStateAction<FileItem[]>>
  setStats: Dispatch<SetStateAction<FileStats>>
}

/** Exponential-backoff retry: delays in ms for attempts 1, 2, 3 */
const RETRY_DELAYS_MS = [1000, 2000, 4000]

/**
 * Add ±50% jitter to a base delay to avoid retry-storm thunder-herd under
 * concurrent S3 503 SlowDown pressure.
 * Result is in range [base, base * 1.5].
 */
export function addJitter(base: number): number {
  return base + Math.random() * base * 0.5
}

/**
 * Perform a fetch with automatic retries for network errors and 503 responses.
 *
 * - Network/timeout errors → up to 3 retries with 1s/2s/4s backoff
 * - HTTP 503 SlowDown      → up to 3 retries with 1s/2s/4s backoff
 * - HTTP 4xx               → no retry (caller error), throw immediately
 * - HTTP 5xx (non-503)     → 1 retry then throw
 */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init)

      // 4xx client errors: no retry
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // 503 SlowDown: retry with backoff
      if (response.status === 503) {
        if (attempt < maxRetries) {
          await _sleep(addJitter(RETRY_DELAYS_MS[attempt] ?? 4000))
          continue
        }
        return response
      }

      // 5xx server error (non-503): 1 retry max
      if (response.status >= 500) {
        if (attempt === 0) {
          await _sleep(addJitter(RETRY_DELAYS_MS[0]))
          continue
        }
        return response
      }

      // 2xx / 3xx: success
      return response
    } catch (networkErr) {
      // Network drop / connection reset
      lastError = networkErr
      if (attempt < maxRetries) {
        await _sleep(addJitter(RETRY_DELAYS_MS[attempt] ?? 4000))
        continue
      }
    }
  }
  throw lastError ?? new Error("Network request failed after retries")
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Parse the BE error payload from a non-OK init-upload response. */
async function _parseInitUploadError(response: Response): Promise<{
  code?: string
  action?: string
  error?: string
}> {
  try {
    const body = await response.text()
    if (!body) return {}
    const json = JSON.parse(body)
    return { code: json.code, action: json.action, error: json.error }
  } catch {
    return {}
  }
}

/** Build a user-facing toast message for init-upload failures. */
function _initUploadToast(
  status: number,
  code?: string,
  error?: string,
): { title: string; description: string } {
  // FM-1: invalid filename
  if (code === "FilenameInvalidError" || code === "UPLOAD_FILENAME_INVALID") {
    return {
      title: "Invalid filename",
      description:
        "Filename contains invalid characters. Rename your file to use letters, digits, dashes, dots.",
    }
  }

  // FM-3: content-type mismatch
  if (
    code === "ContentTypeMismatchError" ||
    code === "UPLOAD_CONTENT_TYPE_UNSUPPORTED"
  ) {
    const actual = error?.match(/Got ([^.]+)\./)?.[1] ?? "unknown format"
    return {
      title: "Wrong file format",
      description: `Expected CSV. Got ${actual}. Save as CSV in Excel.`,
    }
  }

  // Generic 4xx / 5xx fallbacks
  if (status === 401 || status === 403) {
    return { title: "Not authorised", description: "Please sign in again." }
  }
  if (status === 402) {
    return {
      title: "Plan limit reached",
      description: "Upgrade your plan to upload larger files.",
    }
  }
  if (status === 413) {
    return { title: "Request too large", description: "The request body is too large." }
  }

  return {
    title: "Upload failed",
    description: error ?? `Server returned HTTP ${status}.`,
  }
}

/** Build a user-facing toast for S3 PUT failures. */
function _s3PutToast(status: number): { title: string; description: string } {
  if (status === 403) {
    // SignatureDoesNotMatch or AccessDenied — almost always means the presigned
    // URL has expired (user waited >15 min between POST /uploads and PUT).
    return {
      title: "Upload link expired",
      description:
        "Upload link expired. Click upload again.",
    }
  }
  if (status === 503) {
    return {
      title: "Service busy",
      description: "Service busy. Try again in a minute.",
    }
  }
  return {
    title: "Upload failed",
    description: "Check your connection and try again.",
  }
}

export function useFileUpload({
  idToken,
  toast,
  loadFiles,
  updateStats,
  setFiles,
  setStats,
}: UseFileUploadParams) {
  const uploadFile = useCallback(
    async (file: File): Promise<FileItem> => {
      if (!idToken) {
        throw new Error("Not authenticated")
      }

      // ── Step 1: request a presigned URL from the backend ─────────────────
      let presignedResponse: Response
      try {
        presignedResponse = await fetch(`${FILES_API_CONFIG.apiUrl}uploads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type || "application/octet-stream",
            file_size: file.size,
          }),
        })
      } catch (networkErr) {
        toast({
          title: "Upload failed",
          description: "Check your connection.",
          variant: "destructive",
        })
        throw networkErr
      }

      if (!presignedResponse.ok) {
        const { code, action, error } = await _parseInitUploadError(presignedResponse)
        const { title, description } = _initUploadToast(
          presignedResponse.status,
          code,
          error,
        )
        toast({ title, description, variant: "destructive" })
        throw new Error(`${title}: ${description}`)
      }

      const presignedData = await presignedResponse.json()

      // ── Step 2: PUT/POST to S3 with retry logic ───────────────────────────
      if (presignedData.presignedPost && presignedData.usePost) {
        const formData = new FormData()
        Object.keys(presignedData.presignedPost.fields).forEach((key) => {
          formData.append(key, presignedData.presignedPost.fields[key])
        })
        formData.append("file", file)

        let uploadResponse: Response
        try {
          // FM-6 (network drop) and FM-7 (503 SlowDown): retry with backoff.
          uploadResponse = await fetchWithRetry(
            presignedData.presignedPost.url,
            { method: "POST", body: formData },
            3,
          )
        } catch (networkErr) {
          // FM-6: all 3 retries exhausted on network error
          toast({
            title: "Upload failed",
            description: "Upload failed. Check your connection.",
            variant: "destructive",
          })
          throw networkErr
        }

        if (!uploadResponse.ok && uploadResponse.status !== 204) {
          // FM-5: presigned URL expired (403) — no retry; must re-request URL
          // FM-7: 503 after exhausted retries
          const { title, description } = _s3PutToast(uploadResponse.status)
          toast({ title, description, variant: "destructive" })
          throw new Error(`S3 upload failed: ${uploadResponse.status}`)
        }
      } else {
        throw new Error("No presigned POST data available")
      }

      // ── Step 3: build result, refresh file list ───────────────────────────
      const newFile: FileItem = {
        id: presignedData.key || file.name,
        name: file.name,
        key: presignedData.key || file.name,
        size: file.size,
        type: file.name.split(".").pop()?.toUpperCase() || "FILE",
        modified: new Date(),
        lastModified: new Date().toISOString(),
        status: "uploaded",
      }

      await loadFiles()

      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded successfully.`,
      })

      return newFile
    },
    [idToken, loadFiles, setFiles, setStats, toast, updateStats],
  )

  return { uploadFile }
}

// Named re-exports for testing without importing the full hook
export { fetchWithRetry, _initUploadToast, _s3PutToast }
