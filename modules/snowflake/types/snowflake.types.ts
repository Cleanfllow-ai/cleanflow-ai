// ─── Snowflake types ──────────────────────────────────────────────────────────

export interface SnowflakeConnectResponse {
  auth_url: string
  state?: string
}

export interface SnowflakeConnectionStatus {
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

// ─── Metadata browsing ────────────────────────────────────────────────────────

export interface SnowflakeMetadataItem {
  name: string
  rows?: number
}

export interface SnowflakeMetadataResponse {
  items: SnowflakeMetadataItem[]
}

// ─── Import / Export ──────────────────────────────────────────────────────────

export interface SnowflakeImportRequest {
  table: string
  limit?: number
  warehouse?: string
  database?: string
  schema?: string
}

export interface SnowflakeImportResponse {
  upload_id: string
  filename: string
  records_imported: number
  message: string
}

export type SnowflakeWriteMode = "insert" | "truncate_insert" | "merge"

export interface SnowflakeExportRequest {
  upload_id: string
  target_table: string
  warehouse?: string
  database?: string
  schema?: string
  write_mode: SnowflakeWriteMode
  merge_key?: string
  column_mapping?: Record<string, string>
}

export interface SnowflakeExportResponse {
  success?: boolean
  records_written?: number
  total_records?: number
  errors?: Array<{ batch_start: number; batch_size: number; error: string }>
  upload_id?: string
  target_table?: string
  message?: string
  error?: string
}
