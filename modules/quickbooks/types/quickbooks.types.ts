// ─── QuickBooks types ─────────────────────────────────────────────────────────
// Extracted from lib/api/quickbooks-api.ts

export interface QuickBooksConnectResponse {
    auth_url: string
    state: string
}

export interface QuickBooksConnectionStatus {
    connected: boolean
    realm_id?: string
    company_name?: string
    linked_at?: string
    expires_at?: string
}

export interface QuickBooksImportResponse {
    success: boolean
    upload_id: string
    filename: string
    records_imported: number
    entity: string
    message: string
}

export interface QuickBooksExportResponse {
    success: boolean
    message: string
    records_exported?: number
    entity?: string
}

export interface QuickBooksImportFilters {
    limit?: number
    date_from?: string
    date_to?: string
}
