// ─── Storage connector types (Google Drive, etc.) ───────────────────────────

export interface StorageConnectResponse {
  auth_url: string
  state?: string
}

export interface StorageConnectionStatus {
  connected: boolean
  erp_type?: string
  connection_status?: string
  linked_at?: string
  email?: string
}

export interface StorageFile {
  id: string
  name: string
  mimeType: string
  size?: number | null
  modifiedTime: string
  iconLink?: string
}

export interface StorageFileListResponse {
  files: StorageFile[]
  next_page_token?: string | null
}

export interface StorageFolder {
  id: string
  name: string
}

export interface StorageFoldersResponse {
  folders: StorageFolder[]
}

export interface StorageImportResponse {
  upload_id: string
  filename: string
  file_size?: number
  message: string
}

