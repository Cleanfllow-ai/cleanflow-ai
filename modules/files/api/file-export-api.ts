import { AWS_CONFIG } from '@/shared/config/aws-config'
import { makeRequest } from './file-upload-api'
import type {
    ExportDownloadResult,
} from '@/modules/files/types'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// API Endpoints used by this module
const ENDPOINTS = {
    FILES_EXPORT: (id: string) => `/files/${id}/export`,
    FILES_PREVIEW_DATA: (id: string) => `/files/${id}/preview-data`,
    FILES_COLUMNS: (id: string) => `/files/${id}/columns`,
}

// ─── File Download / Export ───

export async function downloadFileFromApi(uploadId: string, fileType: 'csv' | 'excel' | 'json', dataType: 'clean' | 'quarantine' | 'raw' | 'original' | 'all', authToken: string, targetErp?: string): Promise<Blob> {
    let endpoint = `${ENDPOINTS.FILES_EXPORT(uploadId)}?type=${fileType}&data=${dataType}&_ts=${Date.now()}`

    // Add ERP transformation parameter if specified
    if (targetErp) {
        endpoint += `&erp=${encodeURIComponent(targetErp)}`
    }

    const url = `${API_BASE_URL}${endpoint}`

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        cache: 'no-store',
    })

    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)

    // Check if response is JSON (presigned URL response) vs direct file content
    const contentType = response.headers.get('Content-Type') || ''

    if (contentType.includes('application/json')) {
        // Response may contain presigned URL - parse and fetch from S3
        const data = await response.json()
        if (data.presigned_url) {
            console.log('📥 Fetching from presigned URL:', data.filename || 'file')
            const s3Response = await fetch(data.presigned_url)
            if (!s3Response.ok) {
                throw new Error(`Failed to download from S3: ${s3Response.statusText}`)
            }
            return s3Response.blob()
        }
        // If no presigned_url, might be an error
        if (data.error) {
            throw new Error(data.error)
        }
        // Fallback - return empty blob if unexpected JSON
        return new Blob([JSON.stringify(data)], { type: 'application/json' })
    }

    // Log transformation info if present
    const erpTransformation = response.headers.get('X-ERP-Transformation')
    if (erpTransformation === 'true') {
        console.log('ERP Transformation applied:', {
            source: response.headers.get('X-Source-ERP'),
            target: response.headers.get('X-Target-ERP'),
            entity: response.headers.get('X-Entity-Type')
        })
    }

    return response.blob()
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

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Export failed: ${response.statusText}`)
    }

    // Check if response is JSON (presigned URL response) vs direct file content
    const contentType = response.headers.get('Content-Type') || ''
    console.log('🔍 Response Content-Type:', contentType)

    if (contentType.includes('application/json')) {
        // Response contains presigned URL - parse and fetch from S3
        const data = await response.json()
        if (data.presigned_url) {
            console.log('📥 Fetching from presigned URL:', data.filename)
            // Fetch the actual file from S3 presigned URL
            try {
                const s3Response = await fetch(data.presigned_url)
                if (!s3Response.ok) {
                    throw new Error(`Failed to download from S3: ${s3Response.statusText}`)
                }
                return { blob: await s3Response.blob(), filename: data.filename }
            } catch (error) {
                console.warn('Direct S3 fetch failed, falling back to browser download link:', error)
                return { downloadUrl: data.presigned_url, filename: data.filename }
            }
        }
        // If no presigned_url, might be an error - throw
        if (data.error) {
            throw new Error(data.error)
        }
    }

    // Log headers for debugging
    const columnSelection = response.headers.get('X-Column-Selection')
    if (columnSelection === 'true') {
        console.log('Column selection applied:', {
            selected: response.headers.get('X-Selected-Columns'),
            renamed: response.headers.get('X-Renamed-Columns'),
        })
    }

    return { blob: await response.blob() }
}

// ─── File Preview ───

export async function getFilePreview(uploadId: string, authToken: string): Promise<{ headers: string[], sample_data: any[], total_rows: number, has_dq_status?: boolean }> {
    // Use dedicated preview-data endpoint that returns only first N rows
    try {
        const endpoint = `${ENDPOINTS.FILES_PREVIEW_DATA(uploadId)}?limit=50`
        const data = await makeRequest(endpoint, authToken, { method: 'GET' })
        return {
            headers: data.headers || [],
            sample_data: data.sample_data || [],
            total_rows: data.total_rows || 0
        }
    } catch (error) {
        console.error('❌ Failed to fetch preview data:', error)
        // Fallback to S3 method if new endpoint fails
        return getFilePreviewFromS3(uploadId, authToken, 20)
    }
}

export async function getFilePreviewFromS3(uploadId: string, authToken: string, maxRows: number = 20): Promise<{ headers: string[], sample_data: any[], total_rows: number, has_dq_status?: boolean }> {
    try {
        // Download the original file from S3 via export endpoint
        const blob = await downloadFileFromApi(uploadId, 'csv', 'all', authToken)
        const text = await blob.text()
        // Parse CSV
        const lines = text.trim().split('\n')
        if (lines.length === 0) {
            return { headers: [], sample_data: [], total_rows: 0 }
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        const previewLines = lines.slice(1, Math.min(maxRows + 1, lines.length))

        const sample_data = previewLines.map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
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
