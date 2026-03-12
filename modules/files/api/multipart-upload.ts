/**
 * multipart-upload.ts
 *
 * Upload client — always uses a single presigned-POST upload via the /uploads
 * route. S3 presigned POST supports files up to 5 GB, which covers all
 * practical use-cases. Supports AbortSignal for upload cancellation.
 */

import { AWS_CONFIG } from '@/shared/config/aws-config'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ── Public types ──────────────────────────────────────────────────────────────

export interface MultipartProgress {
  loaded: number        // bytes transferred so far
  total: number         // total file size in bytes
  percent: number       // 0–100
  partsComplete: number
  partsTotal: number
}

/** Optional token refresher — called before each API request to get a valid token. */
export type GetToken = () => Promise<string>

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Kept for backward compat — returns a chunk size but single-upload doesn't use it. */
export function getChunkSize(fileSize: number): number {
  return fileSize // single upload — one "chunk" = whole file
}

async function apiPost(
  path: string,
  body: object,
  token: string,
  getToken?: GetToken,
  signal?: AbortSignal,
): Promise<any> {
  const validToken = getToken ? await getToken() : token
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Single presigned-POST upload ─────────────────────────────────────────────

async function singleUpload(
  file: File,
  token: string,
  onProgress?: (p: MultipartProgress) => void,
  getToken?: GetToken,
  signal?: AbortSignal,
): Promise<string> {
  // 1. Init via existing /uploads endpoint
  const initRes = await apiPost(
    '/uploads',
    { filename: file.name, content_type: file.type || 'application/octet-stream' },
    token,
    getToken,
    signal,
  )

  const uploadId: string = initRes.upload_id
  const presignedPost = initRes.presignedPost as { url: string; fields: Record<string, string> }

  if (!presignedPost?.url) {
    throw new Error('No presigned POST URL returned from server')
  }

  // 2. POST directly to S3 with XHR for progress tracking
  const fileSize = file.size
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    // All presigned POST fields must come before the file
    for (const [k, v] of Object.entries(presignedPost.fields || {})) {
      formData.append(k, v)
    }
    formData.append('file', file)

    // Wire up abort signal
    if (signal) {
      if (signal.aborted) {
        reject(new Error('Upload cancelled'))
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress?.({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
          partsComplete: e.loaded >= e.total ? 1 : 0,
          partsTotal: 1,
        })
      }
    })

    xhr.addEventListener('load', () => {
      // S3 presigned POST returns 204 on success
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ loaded: file.size, total: file.size, percent: 100, partsComplete: 1, partsTotal: 1 })
        resolve()
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status} — ${xhr.responseText?.slice(0, 200)}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    xhr.open('POST', presignedPost.url)
    xhr.send(formData)
  })

  // 3. Confirm upload — transitions status from UPLOADING -> UPLOADED
  await apiPost(`/uploads/${uploadId}/confirm`, { total_size: fileSize }, token, getToken, signal)

  return uploadId
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Upload a file to the pipeline.
 * Uses a single presigned-POST upload with XHR progress tracking.
 * Returns the upload_id.
 *
 * @param getToken  Optional async function that returns a fresh auth token.
 *                  Called before every API request so long uploads never hit 401.
 * @param signal    Optional AbortSignal to cancel the upload mid-flight.
 */
export async function multipartUpload(
  file: File,
  token: string,
  onProgress?: (p: MultipartProgress) => void,
  getToken?: GetToken,
  signal?: AbortSignal,
): Promise<string> {
  return singleUpload(file, token, onProgress, getToken, signal)
}
