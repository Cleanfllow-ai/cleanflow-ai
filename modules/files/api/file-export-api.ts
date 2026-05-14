import { AWS_CONFIG } from '@/shared/config/aws-config'
import { makeRequest } from './file-upload-api'
import { splitCSVLine } from '@/modules/files/utils/csv-parser'
import type {
    ExportDownloadResult,
} from '@/modules/files/types'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

/** Validate that a URL looks like a legitimate S3 presigned URL */
function isValidS3Url(url: string): boolean {
    return url.startsWith('https://') && (url.includes('.s3.') || url.includes('.amazonaws.com'))
}

// API Endpoints used by this module
const ENDPOINTS = {
    FILES_EXPORT: (id: string) => `/files/${id}/export`,
    FILES_PREVIEW_DATA: (id: string) => `/files/${id}/preview-data`,
    FILES_COLUMNS: (id: string) => `/files/${id}/columns`,
}

const MAX_EXPORT_PREPARE_ATTEMPTS = 90
const DEFAULT_EXPORT_PREPARE_DELAY_MS = 2000
// Beyond this row count, skip the in-memory blob fetch and let the browser
// stream the download natively via <a href>. Small files use the inline blob
// path so callers (preview, column-rename, etc.) can read the bytes directly;
// large files (>100k rows ~= >10MB CSV) avoid buffering through the JS heap,
// which was stalling the spinner for 30-60s on 100+ MB exports.
const INLINE_BLOB_ROW_THRESHOLD = 100_000
// Hard ceiling on the in-memory blob fetch. 60s covers a ~50 MB download on
// typical connections; anything slower should fall back to the direct link.
const S3_FETCH_TIMEOUT_MS = 60_000

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function resolveExportDownload(
    requestFactory: () => Promise<Response>,
    attempt: number = 0,
): Promise<ExportDownloadResult> {
    const response = await requestFactory()
    const contentType = response.headers.get('Content-Type') || ''
    const isJson = contentType.includes('application/json')
    // Backend tags the prepared-export path with this header; that path is
    // exclusively for files large enough to need async preparation, so we
    // never want to buffer the result through the JS heap.
    const isPreparedExport = response.headers.get('X-Download-Type') === 'presigned-url'
    const data = isJson ? await response.json().catch(() => null) : null

    if (response.status === 202 && data?.status === 'preparing') {
        if (attempt >= MAX_EXPORT_PREPARE_ATTEMPTS) {
            throw new Error(data.message || 'Export is still being prepared. Please try again shortly.')
        }
        const retryDelayMs = Number(data.retry_after_ms) || DEFAULT_EXPORT_PREPARE_DELAY_MS
        await sleep(retryDelayMs)
        return resolveExportDownload(requestFactory, attempt + 1)
    }

    if (!response.ok) {
        const fallbackMessage = `Export failed: ${response.statusText}`
        throw new Error((data && (data.error || data.message)) || fallbackMessage)
    }

    if (isJson && data) {
        if (data.presigned_url) {
            if (!isValidS3Url(data.presigned_url)) {
                throw new Error('Invalid presigned URL: must be an HTTPS S3/AWS URL')
            }
            // Skip the in-memory blob roundtrip when:
            //  - the prepared-export path was used (X-Download-Type header — always large), OR
            //  - the backend reports row_count above our inline threshold, OR
            //  - the backend gives no size hint at all (assume it's the
            //    prepared-export path — the X-Download-Type header may be
            //    invisible to JS until CORS expose_headers ships it).
            // Caller hands the URL to triggerPresignedDownload (hidden iframe)
            // so the browser streams the download in-place — no new tab — and
            // we avoid buffering 100+ MB through fetch().blob() which would
            // stall the spinner for 30-60s with no feedback.
            const exceedsRowThreshold =
                typeof data.row_count === 'number' && data.row_count > INLINE_BLOB_ROW_THRESHOLD
            const noSizeHint = typeof data.row_count !== 'number'
            if (isPreparedExport || exceedsRowThreshold || noSizeHint) {
                return { downloadUrl: data.presigned_url, filename: data.filename }
            }
            console.log('Fetching from presigned URL:', data.filename || 'file')
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), S3_FETCH_TIMEOUT_MS)
            try {
                const s3Response = await fetch(data.presigned_url, { signal: controller.signal })
                if (!s3Response.ok) {
                    throw new Error(`Failed to download from S3: ${s3Response.statusText}`)
                }
                return { blob: await s3Response.blob(), filename: data.filename }
            } catch (error) {
                console.warn('Direct S3 fetch failed, falling back to browser download link:', error)
                return { downloadUrl: data.presigned_url, filename: data.filename }
            } finally {
                clearTimeout(timeoutId)
            }
        }
        if (data.error) {
            throw new Error(data.error)
        }
        return {
            blob: new Blob([JSON.stringify(data)], { type: 'application/json' }),
            filename: data.filename,
        }
    }

    return { blob: await response.blob() }
}

// ─── File Download / Export ───

export async function downloadFileFromApi(uploadId: string, fileType: 'csv' | 'excel' | 'json', dataType: 'clean' | 'quarantine' | 'raw' | 'original' | 'all', authToken: string, targetErp?: string): Promise<ExportDownloadResult> {
    let endpoint = `${ENDPOINTS.FILES_EXPORT(uploadId)}?type=${fileType}&data=${dataType}&_ts=${Date.now()}`

    // Add ERP transformation parameter if specified
    if (targetErp) {
        endpoint += `&erp=${encodeURIComponent(targetErp)}`
    }

    const url = `${API_BASE_URL}${endpoint}`

    return resolveExportDownload(
        () => fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` },
            cache: 'no-store',
        }),
    )
}

/**
 * Export file with column selection and optional renaming.
 * Uses POST method to send columns array and column_mapping object.
 */
export async function exportWithColumns(
    uploadId: string,
    authToken: string,
    options: {
        format: 'csv' | 'excel' | 'json'
        data: 'all' | 'clean' | 'quarantine' | 'raw' | 'original'
        columns?: string[]
        columnMapping?: Record<string, string>
        erp?: string
        entity?: string
    }
): Promise<ExportDownloadResult> {
    const url = `${API_BASE_URL}${ENDPOINTS.FILES_EXPORT(uploadId)}`

    const body: Record<string, any> = {
        format: options.format,
        data: options.data === 'original' ? 'raw' : options.data,
    }

    if (options.columns && options.columns.length > 0) {
        body.columns = options.columns
    }

    if (options.columnMapping && Object.keys(options.columnMapping).length > 0) {
        body.column_mapping = options.columnMapping
    }

    if (options.erp) {
        body.erp = options.erp
    }

    if (options.entity) {
        body.entity = options.entity
    }

    console.log('📤 Export with columns:', { uploadId, ...options })

    return resolveExportDownload(
        () => fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }),
    )
}

// ─── File Preview ───

export async function getFilePreview(uploadId: string, authToken: string, signal?: AbortSignal): Promise<{ headers: string[], sample_data: any[], total_rows: number, has_dq_status?: boolean }> {
    // Use dedicated preview-data endpoint that returns only first N rows
    try {
        const endpoint = `${ENDPOINTS.FILES_PREVIEW_DATA(uploadId)}?limit=50`
        const data = await makeRequest(endpoint, authToken, { method: 'GET', signal })
        return {
            headers: data.headers || [],
            sample_data: data.sample_data || [],
            total_rows: data.total_rows || 0
        }
    } catch (error) {
        console.error('❌ Failed to fetch preview data:', error)
        // Re-throw so the caller sets previewError and the UI shows
        // "Preview Unavailable" instead of an invisible empty table.
        throw error
    }
}

export async function getFilePreviewFromS3(uploadId: string, authToken: string, maxRows: number = 20): Promise<{ headers: string[], sample_data: any[], total_rows: number, has_dq_status?: boolean }> {
    try {
        // Download the original file from S3 via export endpoint
        const download = await downloadFileFromApi(uploadId, 'csv', 'all', authToken)
        if (!download.blob) {
            throw new Error('Preview download requires an inline blob response')
        }
        const text = await download.blob.text()
        // Parse CSV
        const lines = text.trim().split('\n')
        if (lines.length === 0) {
            return { headers: [], sample_data: [], total_rows: 0 }
        }

        const headers = splitCSVLine(lines[0]).map(h => h.trim())
        const previewLines = lines.slice(1, Math.min(maxRows + 1, lines.length))

        const sample_data = previewLines.map(line => {
            const values = splitCSVLine(line).map(v => v.trim())
            const row: Record<string, any> = {}
            headers.forEach((header, index) => {
                row[header] = values[index] || ''
            })
            return row
        })
        return {
            headers,
            sample_data,
            total_rows: lines.length - 1 // Exclude header
        }
    } catch (error) {
        console.error('❌ Failed to fetch file preview from S3:', error)
        return { headers: [], sample_data: [], total_rows: 0 }
    }
}
