// ─── Warehouse connector types (Snowflake, etc.) ────────────────────────────

export interface WarehouseConnectResponse {
  auth_url: string
  state?: string
}

export interface WarehouseConnectionStatus {
  connected: boolean
  account_identifier?: string
  user?: string
  warehouse?: string
  database?: string
  schema?: string
  linked_at?: string
  sf_user_schema?: string
  sf_user_database?: string
  sf_provisioned?: boolean
}

export interface WarehouseMetadataItem {
  name: string
  rows?: number
}

export interface WarehouseMetadataResponse {
  items: WarehouseMetadataItem[]
}

export interface WarehouseImportRequest {
  table: string
  limit?: number
  warehouse?: string
  database?: string
  schema?: string
}

export interface WarehouseImportResponse {
  upload_id: string
  filename: string
  records_imported: number
  message: string
}

export type WarehouseWriteMode = "insert" | "truncate_insert" | "merge"

export interface WarehouseExportRequest {
  upload_id: string
  target_table: string
  warehouse?: string
  database?: string
  schema?: string
  write_mode: WarehouseWriteMode
  merge_key?: string
  column_mapping?: Record<string, string>
}

export interface WarehouseExportResponse {
  success?: boolean
  records_written?: number
  total_records?: number
  errors?: Array<{ batch_start: number; batch_size: number; error: string }>
  upload_id?: string
  target_table?: string
  message?: string
  error?: string
}

