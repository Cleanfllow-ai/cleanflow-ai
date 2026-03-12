/**
 * multipart-upload.ts
 *
 * Unified upload client:
 * - Files ≤ 50 MB  → single presigned-POST upload (existing /uploads route, no deployment needed)
 * - Files > 50 MB  → S3 multipart upload (50 MB chunks, 4-concurrent, retry-backoff)
 *
 * Supports files up to 5 TB (S3 multipart limit).
 */

import { AWS_CONFIG } from '@/shared/config/aws-config'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ── Thresholds & constants ────────────────────────────────────────────────────
const SINGLE_UPLOAD_THRESHOLD = 50 * 1024 * 1024   // 50 MB  — use presigned POST below this
const MIN_CHUNK_BYTES = 50 * 1024 * 1024            // 50 MB  — minimum multipart chunk
const MAX_CHUNK_BYTES = 500 * 1024 * 1024           // 500 MB — maximum multipart chunk
const MAX_PARTS       = 9_500                       // S3 allows 10,000; leave buffer
const CONCURRENCY     = 4                           // simultaneous part uploads
const MAX_RETRIES     = 3                           // retries per failed part

// ── Public types ──────────────────────────────────────────────────────────────

export interface MultipartProgress {
  loaded: number        // bytes transferred so far
  total: number         // total file size in bytes
  percent: number       // 0–100
  partsComplete: number
  partsTotal: number
}

export interface CompletedPart {
  PartNumber: number
  ETag: string
}

/** Optional token refresher — called before each API request to get a valid token. */
export type GetToken = () => Promise<string>

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the optimal chunk size so the number of parts never exceeds MAX_PARTS.
 * Always returns a value between MIN_CHUNK_BYTES and MAX_CHUNK_BYTES.
 */
export function getChunkSize(fileSize: number): number {
  const minForSize = Math.ceil(fileSize / MAX_PARTS)
  return Math.min(MAX_CHUNK_BYTES, Math.max(MIN_CHUNK_BYTES, minForSize))
}

async function apiPost(path: string, body: object, token: string, getToken?: GetToken): Promise<any> {
  const validToken = getToken ? await getToken() : token
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Single presigned-POST upload (≤ 50 MB) ───────────────────────────────────

async function singleUpload(
  file: File,
  token: string,
  onProgress?: (p: MultipartProgress) => void,
  getToken?: GetToken,
): Promise<string> {
  // 1. Init via existing /uploads endpoint (already deployed)
  const initRes = await apiPost(
    '/uploads',
    { filename: file.name, content_type: file.type || 'application/octet-stream' },
    token,
    getToken,
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
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

    xhr.open('POST', presignedPost.url)
    xhr.send(formData)
  })

  // 3. Confirm upload — transitions status from UPLOADING → UPLOADED
  await apiPost(`/uploads/${uploadId}/confirm`, { total_size: fileSize }, token, getToken)

  return uploadId
}

// ── Part upload with retry ────────────────────────────────────────────────────

async function uploadPart(
  partUrl: string,
  chunk: Blob,
  onChunkProgress: (delta: number) => void,
  attempt = 1,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    let lastLoaded = 0
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onChunkProgress(e.loaded - lastLoaded)
        lastLoaded = e.loaded
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || ''
        resolve(etag.replace(/"/g, ''))
      } else {
        reject(new Error(`Part upload failed: HTTP ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during part upload')))
    xhr.addEventListener('abort', () => reject(new Error('Part upload aborted')))

    xhr.open('PUT', partUrl)
    xhr.send(chunk)
  }).catch(async (err) => {
    if (attempt >= MAX_RETRIES) throw err
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    return uploadPart(partUrl, chunk, onChunkProgress, attempt + 1)
  }) as Promise<string>
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
}

// ── S3 multipart upload (> 50 MB) ─────────────────────────────────────────────

async function multipartUploadLarge(
  file: File,
  token: string,
  onProgress?: (p: MultipartProgress) => void,
  getToken?: GetToken,
): Promise<string> {
  const chunkSize = getChunkSize(file.size)
  const totalParts = Math.ceil(file.size / chunkSize)

  // 1. Initiate
  const { upload_id, s3_upload_id } = await apiPost(
    '/uploads/multipart/init',
    { filename: file.name, content_type: file.type || 'application/octet-stream' },
    token,
    getToken,
  )

  let bytesLoaded = 0
  let partsComplete = 0

  const reportProgress = (delta: number) => {
    bytesLoaded += delta
    onProgress?.({
      loaded: Math.min(bytesLoaded, file.size),
      total: file.size,
      percent: Math.round((Math.min(bytesLoaded, file.size) / file.size) * 100),
      partsComplete,
      partsTotal: totalParts,
    })
  }

  // 2. Upload all parts concurrently
  const partTasks = Array.from({ length: totalParts }, (_, i) => async () => {
    const partNumber = i + 1
    const start = i * chunkSize
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size))

    const { url } = await apiPost(
      `/uploads/multipart/${upload_id}/presign-part`,
      { part_number: partNumber },
      token,
      getToken,
    )

    const etag = await uploadPart(url, chunk, (delta) => reportProgress(delta))
    partsComplete++
    return { PartNumber: partNumber, ETag: etag } as CompletedPart
  })

  let completedParts: CompletedPart[]
  try {
    completedParts = await runWithConcurrency(partTasks, CONCURRENCY)
  } catch (err) {
    await apiPost(`/uploads/multipart/${upload_id}/abort`, {}, token, getToken).catch(() => {})
    throw err
  }

  // 3. Complete
  completedParts.sort((a, b) => a.PartNumber - b.PartNumber)
  await apiPost(`/uploads/multipart/${upload_id}/complete`, {
    parts: completedParts,
    total_size: file.size,
  }, token, getToken)

  return upload_id
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Upload a file to the pipeline.
 * Automatically selects single vs multipart based on file size.
 * Returns the upload_id.
 *
 * @param getToken  Optional async function that returns a fresh auth token.
 *                  Called before every API request so long uploads never hit 401.
 */
export async function multipartUpload(
  file: File,
  token: string,
  onProgress?: (p: MultipartProgress) => void,
  getToken?: GetToken,
): Promise<string> {
  if (file.size <= SINGLE_UPLOAD_THRESHOLD) {
    return singleUpload(file, token, onProgress, getToken)
  }
  return multipartUploadLarge(file, token, onProgress, getToken)
}
