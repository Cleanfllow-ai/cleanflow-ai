export interface GoogleDriveConnectResponse {
    auth_url: string
    state?: string
}

export interface GoogleDriveConnectionStatus {
    connected: boolean
    erp_type?: string
    connection_status?: string
    linked_at?: string
    email?: string
}

export interface GoogleDriveFile {
    id: string
    name: string
    mimeType: string
    size?: number | null
    modifiedTime: string
    iconLink?: string
}

export interface GoogleDriveListResponse {
    files: GoogleDriveFile[]
    next_page_token?: string | null
}

export interface GoogleDriveFolder {
    id: string
    name: string
}

export interface GoogleDriveFoldersResponse {
    folders: GoogleDriveFolder[]
}

export interface GoogleDriveImportResponse {
    upload_id: string
    filename: string
    file_size?: number
    message: string
}
