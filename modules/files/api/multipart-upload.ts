/**
 * multipart-upload.ts
 *
 * Upload client with two strategies:
 *   - Files ≤ 100 MB → single presigned-POST upload (existing path)
 *   - Files > 100 MB → true S3 multipart upload via backend API
 *
 * The multipart path uses the backend endpoints:
 *   POST /uploads/multipart/init          → { upload_id, s3_upload_id, key }
 *   POST /uploads/multipart/{id}/presign-batch → { urls: [{part_number, url}] }
 *   POST /uploads/multipart/{id}/presign-part  → { url, part_number }
 *   POST /uploads/multipart/{id}/complete  → { upload_id }
 *   POST /uploads/multipart/{id}/abort     → { upload_id }
 *
 * Supports AbortSignal for cancellation, per-part progress, and retry.
 */

import { AWS_CONFIG } from '@/shared/config/aws-config'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ── Configuration ─────────────────────────────────────────────────────────────

/** Files above this threshold use true S3 multipart upload. */
const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100 MB

/** Minimum part size — S3 requires ≥ 5 MB for all parts except the last. */
const MIN_PART_SIZE = 100 * 1024 * 1024 // 100 MB

/** Maximum concurrent part uploads. */
const MAX_CONCURRENCY = 5

/** Maximum retry attempts per part. */
const MAX_RETRIES = 3

/** How many presigned URLs to request at once. */
const PRESIGN_BATCH_SIZE = 50

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

export function getChunkSize(fileSize: number): number {
  if (fileSize <= MULTIPART_THRESHOLD) return fileSize
  // Stay under S3's 10,000 parts limit
  return Math.max(MIN_PART_SIZE, Math.ceil(fileSize / 9999))
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

// ── Single presigned-POST upload (files ≤ 100 MB) ────────────────────────────

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

// ── True S3 multipart upload (files > 100 MB) ────────────────────────────────

interface PartResult {
  PartNumber: number
  ETag: string
}

/**
 * Upload a single part to S3 using a presigned PUT URL.
 * Uses XHR for progress tracking. Retries up to MAX_RETRIES on failure.
 */
function uploadPart(
  url: string,
  blob: Blob,
  partNumber: number,
  onPartProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<PartResult> {
  return new Promise((resolve, reject) => {
    let attempt = 0

    function tryUpload() {
      attempt++
      const xhr = new XMLHttpRequest()

      if (signal) {
        if (signal.aborted) {
          reject(new Error('Upload cancelled'))
          return
        }
        signal.addEventListener('abort', () => xhr.abort(), { once: true })
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onPartProgress(e.loaded)
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag')
          if (!etag) {
            reject(new Error(`Part ${partNumber}: no ETag in response`))
            return
          }
          onPartProgress(blob.size)
          resolve({ PartNumber: partNumber, ETag: etag })
        } else if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          setTimeout(tryUpload, delay)
        } else {
          reject(new Error(`Part ${partNumber} failed after ${MAX_RETRIES} attempts: HTTP ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          setTimeout(tryUpload, delay)
        } else {
          reject(new Error(`Part ${partNumber} network error after ${MAX_RETRIES} attempts`))
        }
      })

      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

      xhr.open('PUT', url)
      xhr.send(blob)
    }

    tryUpload()
  })
}

/**
 * Get presigned URLs for multiple parts in one batch call, falling back to
 * individual presign-part calls if the batch endpoint is unavailable.
 */
async function presignParts(
  uploadId: string,
  partNumbers: number[],
  token: string,
  getToken?: GetToken,
  signal?: AbortSignal,
): Promise<Map<number, string>> {
  const urlMap = new Map<number, string>()

  try {
    // Try batch endpoint first
    const res = await apiPost(
      `/uploads/multipart/${uploadId}/presign-batch`,
      { part_numbers: partNumbers },
      token,
      getToken,
      signal,
    )
    for (const item of (res.urls || [])) {
      urlMap.set(item.part_number, item.url)
    }
    return urlMap
  } catch {
    // Fallback: individual presign calls
    const results = await Promise.all(
      partNumbers.map(async (pn) => {
        const res = await apiPost(
          `/uploads/multipart/${uploadId}/presign-part`,
          { part_number: pn },
          token,
          getToken,
          signal,
        )
        return { part_number: pn, url: res.url as string }
      })
    )
    for (const r of results) {
      urlMap.set(r.part_number, r.url)
    }
    return urlMap
  }
}

async function s3MultipartUpload(
  file: File,
  token: string,
  onProgress?: (p: MultipartProgress) => void,
  getToken?: GetToken,
  signal?: AbortSignal,
): Promise<string> {
  const fileSize = file.size
  const partSize = getChunkSize(fileSize)
  const totalParts = Math.ceil(fileSize / partSize)

  // 1. Initiate multipart upload
  const initRes = await apiPost(
    '/uploads/multipart/init',
    { filename: file.name, content_type: file.type || 'application/octet-stream' },
    token,
    getToken,
    signal,
  )

  const uploadId: string = initRes.upload_id

  // Track per-part progress for accurate overall percentage
  const partLoaded = new Float64Array(totalParts) // bytes uploaded per part
  let partsComplete = 0

  function reportProgress() {
    let loaded = 0
    for (let i = 0; i < totalParts; i++) loaded += partLoaded[i]
    onProgress?.({
      loaded,
      total: fileSize,
      percent: Math.round((loaded / fileSize) * 100),
      partsComplete,
      partsTotal: totalParts,
    })
  }

  // 2. Upload parts with bounded concurrency
  const completedParts: PartResult[] = []

  try {
    // Process parts in batches of PRESIGN_BATCH_SIZE for URL fetching,
    // then upload within each batch with MAX_CONCURRENCY parallelism
    for (let batchStart = 0; batchStart < totalParts; batchStart += PRESIGN_BATCH_SIZE) {
      if (signal?.aborted) throw new Error('Upload cancelled')

      const batchEnd = Math.min(batchStart + PRESIGN_BATCH_SIZE, totalParts)
      const batchPartNumbers = Array.from(
        { length: batchEnd - batchStart },
        (_, i) => batchStart + i + 1, // S3 parts are 1-indexed
      )

      // Get presigned URLs for this batch
      const urlMap = await presignParts(uploadId, batchPartNumbers, token, getToken, signal)

      // Upload parts within this batch with concurrency limit
      const queue = [...batchPartNumbers]
      const uploading = new Set<Promise<void>>()

      while (queue.length > 0 || uploading.size > 0) {
        if (signal?.aborted) throw new Error('Upload cancelled')

        while (queue.length > 0 && uploading.size < MAX_CONCURRENCY) {
          const partNumber = queue.shift()!
          const partIndex = partNumber - 1 // 0-indexed for array access
          const start = partIndex * partSize
          const end = Math.min(start + partSize, fileSize)
          const blob = file.slice(start, end)
          const url = urlMap.get(partNumber)

          if (!url) throw new Error(`No presigned URL for part ${partNumber}`)

          const promise = uploadPart(
            url,
            blob,
            partNumber,
            (loaded) => {
              partLoaded[partIndex] = loaded
              reportProgress()
            },
            signal,
          ).then((result) => {
            completedParts.push(result)
            partsComplete++
            reportProgress()
            uploading.delete(promise)
          })

          uploading.add(promise)
        }

        if (uploading.size > 0) {
          // Wait for at least one to finish before continuing
          await Promise.race(uploading)
        }
      }
    }

    // Sort by part number (S3 requires ascending order)
    completedParts.sort((a, b) => a.PartNumber - b.PartNumber)

    // 3. Complete multipart upload
    await apiPost(
      `/uploads/multipart/${uploadId}/complete`,
      { parts: completedParts, total_size: fileSize },
      token,
      getToken,
      signal,
    )

    onProgress?.({
      loaded: fileSize,
      total: fileSize,
      percent: 100,
      partsComplete: totalParts,
      partsTotal: totalParts,
    })

    return uploadId
  } catch (err) {
    // Abort the multipart upload on failure
    try {
      await apiPost(
        `/uploads/multipart/${uploadId}/abort`,
        {},
        token,
        getToken,
      )
    } catch {
      // Best effort abort — ignore errors
    }
    throw err
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Upload a file to the pipeline.
 *
 * - Files ≤ 100 MB use a single presigned-POST upload.
 * - Files > 100 MB use true S3 multipart upload with concurrent parts.
 *
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
  if (file.size <= MULTIPART_THRESHOLD) {
    return singleUpload(file, token, onProgress, getToken, signal)
  }
  return s3MultipartUpload(file, token, onProgress, getToken, signal)
}
