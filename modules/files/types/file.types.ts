// ─── File-level types ─────────────────────────────────────────────────────────
// Extracted from lib/api/file-management-api.ts and hooks/useFileManager.ts

export interface FileUploadInitResponse {
  upload_id: string
  original_filename: string
  contentType: string
  key: string
  uploadUrl?: string  // Deprecated PUT method
  url?: string        // For backwards compatibility
  fields?: Record<string, string>  // For backwards compatibility
  presignedPost?: {   // NEW: Proper POST method with fields
    url: string
    fields: Record<string, string>
  }
  usePost?: boolean   // Flag to indicate which upload method to use
}

export interface FileStatusResponse {
  upload_id: string
  status: 'QUEUED' | 'DQ_RUNNING' | 'DQ_FIXED' | 'FAILED' | 'COMPLETED' | 'UPLOADING' | 'NORMALIZING' | 'DQ_FAILED' | 'UPLOAD_FAILED' | 'UPLOADED' | 'VALIDATED' | 'REJECTED' | 'DQ_DISPATCHED' | 'SHARDING' | 'SHARDED' | 'SHARD_FAILED'
  filename?: string
  original_filename?: string
  content_type?: string
  user_id?: string
  created_at?: string
  uploaded_at?: string
  updated_at?: string
  processing_time?: string
  status_timestamp?: string
  file_size?: number
  input_size_bytes?: number
  rows_in?: number
  rows_out?: number
  rows_clean?: number
  rows_fixed?: number
  rows_quarantined?: number
  dq_score?: number | null
  dq_issues?: string[]
  // New fields from user JSON
  dispatch_id?: string
  engine?: string
  reprocess_count?: number
  s3_raw_key?: string
  s3_result_key?: string
  dq_report_s3?: string
  dq_rules_version?: string
  processing_time_seconds?: number
  remediation_state?: string
  remediation_mode?: string
  current_reprocess_snapshot_id?: string
  current_reprocess_passed_rows_key?: string
  // Version management fields
  version_number?: number
  parent_upload_id?: string | null
  root_upload_id?: string | null
  source_upload_id?: string | null
  is_latest?: boolean
  patch_notes?: string | null
  // Pipeline source tracking
  source_type?: string
  // ERP detection
  detected_erp?: string | null
  detected_entity?: string
}

export interface FileListResponse {
  items: FileStatusResponse[]
  count: number
}

// From hooks/useFileManager.ts
export interface FileItem {
  id: string
  name: string
  key: string // S3 key
  size: number
  type: string
  modified: Date
  lastModified: string // API returns this
  status: 'processed' | 'processing' | 'failed' | 'uploaded' | 'queued' | 'dq_running' | 'dq_fixed' | 'dq_failed'
  url?: string
  thumbnail?: string
  // DQ processing fields
  upload_id?: string
  root_upload_id?: string
  original_filename?: string
  uploaded_at?: string
  dq_score?: number
  rows_in?: number
  rows_out?: number
  rows_quarantined?: number
  dq_issues?: Array<{
    rule: string
    violations: number
  }>
  last_error?: string
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  storageUsed: number
  storageLimit: number
  uploadedToday: number
  downloadedToday: number
}
