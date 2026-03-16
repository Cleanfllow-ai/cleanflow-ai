// ─── Zoho Books types ─────────────────────────────────────────────────────────
// Extracted from lib/api/zoho-books-api.ts

export interface ZohoBooksConnectResponse {
    auth_url: string
    state: string
}

export interface ZohoBooksConnectionStatus {
    connected: boolean
    org_id?: string
    zoho_user_id?: string
    zoho_accounts_user_id?: string
    linked_at?: string
}

export interface ZohoBooksImportResponse {
    upload_id: string
    filename: string
    records_imported: number
    message: string
}

export interface ZohoBooksExportResponse {
    total_records?: number
    success_count?: number
    failed_count?: number
    status?: 'processing' | 'completed' | 'failed'
    processed_count?: number
    total_count?: number
    message?: string
    error?: string
    results?: Array<{ row: number; status: string; id?: string; error?: string }>
}

export interface ZohoBooksExportStatusResponse {
    upload_id: string
    status: 'processing' | 'completed' | 'failed' | 'not_started' | 'pushed'
    message?: string
    processed_count?: number
    success_count?: number
    failed_count?: number
    total_count?: number
    error?: string
}

export interface ZohoBooksImportFilters {
    limit?: number
    page?: number
    date_from?: string
    date_to?: string
    all?: boolean
    max_pages?: number
}

export interface EntityInfo {
    entity: string
    label: string
    record_count: number
    has_data: boolean
    available: boolean
    reason?: string
}
