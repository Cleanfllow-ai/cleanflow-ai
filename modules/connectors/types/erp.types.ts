// ─── Shared ERP connector types ──────────────────────────────────────────────
// Covers QuickBooks, Zoho Books, and any future ERP provider.

export interface ERPConnectResponse {
  auth_url: string
  state?: string
}

export interface ERPConnectionStatus {
  connected: boolean
  // QuickBooks-specific
  realm_id?: string
  company_name?: string
  expires_at?: string
  // Zoho-specific
  org_id?: string
  zoho_user_id?: string
  zoho_accounts_user_id?: string
  // Common
  linked_at?: string
}

export interface ERPImportResponse {
  success?: boolean
  upload_id: string
  filename: string
  records_imported: number
  entity?: string
  message: string
}

export interface ERPExportResponse {
  success?: boolean
  message?: string
  error?: string
  records_exported?: number
  entity?: string
  // Zoho extended fields
  total_records?: number
  success_count?: number
  failed_count?: number
  status?: "processing" | "completed" | "failed"
  processed_count?: number
  total_count?: number
  results?: Array<{
    row: number
    status: string
    id?: string
    error?: string
  }>
}

export interface ERPExportStatusResponse {
  upload_id: string
  status: "processing" | "completed" | "failed" | "not_started" | "pushed"
  message?: string
  processed_count?: number
  success_count?: number
  failed_count?: number
  total_count?: number
  error?: string
}

export interface ERPImportFilters {
  limit?: number
  page?: number
  date_from?: string
  date_to?: string
  // Zoho-specific
  all?: boolean
  max_pages?: number
}

export interface ERPEntityInfo {
  entity: string
  label: string
  record_count: number
  has_data: boolean
  available: boolean
  reason?: string
}

