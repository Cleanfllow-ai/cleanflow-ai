/**
 * Unified Storage Connectors API — storage operations parameterized by provider.
 *
 * Uses the backend's existing provider-specific routes:
 *   GET  /{provider}/files          (e.g. /googledrive/files)
 *   GET  /{provider}/folders        (e.g. /googledrive/folders)
 *   POST /{provider}/import         (e.g. /googledrive/import)
 *   GET  /{provider}/import         (poll import status)
 */

import { ConnectorAPIBase } from "./base"

/** Map frontend provider ID to backend route prefix. */
function storageRoutePrefix(provider: string): string {
  const map: Record<string, string> = {
    googledrive: "/googledrive",
    "google-drive": "/googledrive",
    google_drive: "/googledrive",
  }
  return map[provider.toLowerCase()] || `/${provider}`
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StorageFile {
  id: string
  name: string
  mimeType: string
  size?: number | null
  modifiedTime: string
  iconLink?: string
  [key: string]: unknown
}

export interface StorageFolder {
  id: string
  name: string
  [key: string]: unknown
}

export interface StorageListResponse {
  files: StorageFile[]
  next_page_token?: string | null
}

export interface StorageFoldersResponse {
  folders: StorageFolder[]
}

export interface StorageImportResponse {
  upload_id: string
  status: string
  filename: string
  file_size?: number
  message: string
  [key: string]: unknown
}

// ─── Service ────────────────────────────────────────────────────────────────

class StorageConnectorsAPI extends ConnectorAPIBase {
  /** List files (CSV/Excel/Sheets) from a storage provider. */
  async listFiles(
    provider: string,
    folderId?: string,
    pageToken?: string,
    query?: string,
  ): Promise<StorageListResponse> {
    const prefix = storageRoutePrefix(provider)
    const params = new URLSearchParams()
    if (folderId) params.set("folder_id", folderId)
    if (pageToken) params.set("page_token", pageToken)
    if (query) params.set("query", query)
    const qs = params.toString()
    return await this.makeRequest<StorageListResponse>(
      `${prefix}/files${qs ? `?${qs}` : ""}`,
      { method: "GET" },
    )
  }

  /** List folders from a storage provider. */
  async listFolders(
    provider: string,
    parentId?: string,
  ): Promise<StorageFoldersResponse> {
    const prefix = storageRoutePrefix(provider)
    const params = new URLSearchParams()
    if (parentId) params.set("parent_folder_id", parentId)
    const qs = params.toString()
    return await this.makeRequest<StorageFoldersResponse>(
      `${prefix}/folders${qs ? `?${qs}` : ""}`,
      { method: "GET" },
    )
  }

  /** Start an async import from a storage provider. Returns upload_id. */
  async importFile(
    provider: string,
    fileId: string,
    destinationKey?: string,
  ): Promise<StorageImportResponse> {
    const prefix = storageRoutePrefix(provider)
    return await this.makeRequest<StorageImportResponse>(
      `${prefix}/import`,
      {
        method: "POST",
        body: JSON.stringify({
          file_id: fileId,
          ...(destinationKey ? { destination_key: destinationKey } : {}),
        }),
      },
    )
  }

  /** Poll import status (IMPORTING → UPLOADED / IMPORT_FAILED). */
  async getImportStatus(
    provider: string,
    uploadId: string,
  ): Promise<{
    upload_id: string
    status: string
    filename?: string
    file_size?: number
    bytes_transferred?: number
    error_message?: string
  }> {
    const prefix = storageRoutePrefix(provider)
    return await this.makeRequest(
      `${prefix}/import?upload_id=${encodeURIComponent(uploadId)}`,
      { method: "GET" },
    )
  }
}

export const storageConnectorsAPI = new StorageConnectorsAPI()
export default storageConnectorsAPI
