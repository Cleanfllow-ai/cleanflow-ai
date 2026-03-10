import { AWS_CONFIG } from '@/shared/config/aws-config'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ─── Ingestion Types ───

export interface FtpIngestionConfig {
    host: string
    port?: number
    username?: string
    password?: string
    protocol: 'ftp' | 'ftps' | 'ftps_implicit' | 'sftp'
    remote_path: string
    filename: string
    auth?: {
        type: 'password' | 'ssh_key'
        private_key?: string
        key_passphrase?: string
    }
    tls?: {
        verify_cert?: boolean
    }
}

export interface TcpIngestionConfig {
    host: string
    port: number
    timeout_seconds?: number
    delimiter?: string
    max_size_bytes?: number
    request_data?: string
    filename: string
    tls?: {
        enabled?: boolean
        verify_cert?: boolean
        ca_cert?: string
        client_cert?: string
        client_key?: string
    }
    auth?: {
        type: 'none' | 'token' | 'userpass'
        token?: string
        username?: string
        password?: string
        auth_command?: string
    }
}

export interface HttpIngestionConfig {
    url: string
    method?: 'GET' | 'POST' | 'PUT'
    headers?: Record<string, string>
    body?: Record<string, any> | string
    auth?: {
        type: 'none' | 'bearer' | 'api_key' | 'basic' | 'hmac' | 'cookie' | 'oidc'
        token?: string
        api_key?: string
        username?: string
        password?: string
        header_name?: string
        // HMAC auth
        access_key?: string
        secret_key?: string
        // Cookie auth
        cookie?: string
        // OIDC auth
        token_url?: string
        client_id?: string
        client_secret?: string
        scope?: string
    }
    timeout_seconds?: number
    filename: string
}

export interface IngestionResponse {
    success: boolean
    message: string
    upload_id: string
    filename: string
    size_bytes: number
    source?: string
    content_type?: string
}

// Legacy types for backward compatibility
export interface UnifiedBridgeErp {
    name: string
    available: boolean
    file_count: number
}

export interface UnifiedBridgeErpsResponse {
    erps: UnifiedBridgeErp[]
}

export interface UnifiedBridgeFile {
    id: string
    name: string
    filename: string
    rows: number
    size_mb: number
    entity: string
    available: boolean
}

export interface UnifiedBridgeFilesResponse {
    files: UnifiedBridgeFile[]
}

export interface UnifiedBridgeImportResponse {
    success: boolean
    upload_id: string
    rows: number
    message?: string
}

// ─── Ingestion APIs ───

export async function ingestFromFtp(config: FtpIngestionConfig, token: string): Promise<IngestionResponse> {
    const response = await fetch(`${API_BASE_URL}/unified-bridge/ftp/ingest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `FTP ingestion failed: ${response.statusText}`)
    }

    return response.json()
}

export async function ingestFromTcp(config: TcpIngestionConfig, token: string): Promise<IngestionResponse> {
    const response = await fetch(`${API_BASE_URL}/unified-bridge/tcp/ingest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `TCP ingestion failed: ${response.statusText}`)
    }

    return response.json()
}

export async function ingestFromHttp(config: HttpIngestionConfig, token: string): Promise<IngestionResponse> {
    const response = await fetch(`${API_BASE_URL}/unified-bridge/http/ingest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `HTTP ingestion failed: ${response.statusText}`)
    }

    return response.json()
}

export async function uploadBinary(file: File, token: string, onProgress?: (progress: number) => void): Promise<IngestionResponse> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1]

                const response = await fetch(`${API_BASE_URL}/unified-bridge/binary/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filename: file.name,
                        content_type: file.type || 'application/octet-stream',
                        data: base64,
                    }),
                })

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}))
                    throw new Error(error.error || `Binary upload failed: ${response.statusText}`)
                }

                if (onProgress) onProgress(100)
                resolve(await response.json())
            } catch (error) {
                reject(error)
            }
        }

        reader.onerror = () => reject(new Error('Failed to read file'))

        if (onProgress) onProgress(10)
        reader.readAsDataURL(file)
    })
}

// ─── Connection Tests ───

export async function testFtpConnection(config: Omit<FtpIngestionConfig, 'filename'>): Promise<{ success: boolean; message: string }> {
    if (!config.host || !config.remote_path) {
        return { success: false, message: 'Host and remote path are required' }
    }
    return { success: true, message: 'Connection parameters look valid' }
}

export async function testTcpConnection(config: Omit<TcpIngestionConfig, 'filename'>): Promise<{ success: boolean; message: string }> {
    if (!config.host || !config.port) {
        return { success: false, message: 'Host and port are required' }
    }
    return { success: true, message: 'Connection parameters look valid' }
}

export async function testHttpEndpoint(config: Omit<HttpIngestionConfig, 'filename'>): Promise<{ success: boolean; message: string }> {
    if (!config.url) {
        return { success: false, message: 'URL is required' }
    }
    try {
        new URL(config.url)
        return { success: true, message: 'URL is valid' }
    } catch {
        return { success: false, message: 'Invalid URL format' }
    }
}
