// ─── Export types ─────────────────────────────────────────────────────────────
// Extracted from lib/api/file-management-api.ts

// Column Response (GET /files/{id}/columns)
export interface ColumnResponse {
    columns: string[]
}

// Preview Data Response (GET /files/{id}/preview-data)
export interface PreviewDataResponse {
    headers: string[]
    sample_data: Record<string, any>[]
    total_rows: number
    returned_rows: number
}

// Download URLs Response (GET /files/{id}/preview)
export interface DownloadUrlsResponse {
    upload_id: string
    status: string
    dq_score: number
    download_urls: {
        clean_data: string
        quarantine_data: string
        dq_report: string
    }
}

// Export Response (GET/POST /files/{id}/export)
export interface ExportResponse {
    presigned_url: string
    filename: string
}

export interface ExportDownloadResult {
    blob?: Blob
    downloadUrl?: string
    filename?: string
}
