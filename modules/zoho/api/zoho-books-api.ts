import { AWS_CONFIG } from "@/shared/config/aws-config"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

// --- Types (imported from modules/zoho/types, re-exported for backwards compatibility) ---
import type {
  ZohoBooksConnectResponse,
  ZohoBooksConnectionStatus,
  ZohoBooksImportResponse,
  ZohoBooksExportResponse,
  ZohoBooksExportStatusResponse,
  ZohoBooksImportFilters,
  EntityInfo,
} from "@/modules/zoho/types/zoho.types"

export type {
  ZohoBooksConnectResponse,
  ZohoBooksConnectionStatus,
  ZohoBooksImportResponse,
  ZohoBooksExportResponse,
  ZohoBooksExportStatusResponse,
  ZohoBooksImportFilters,
  EntityInfo,
} from "@/modules/zoho/types/zoho.types"

class ZohoBooksService {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth: boolean = false,
    retries: number = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      if ((error as Error).name === 'AbortError' && retries < 2) {
        await new Promise((resolve) => setTimeout(resolve, (retries + 1) * 2000))
        return this.makeRequest<T>(endpoint, options, skipAuth, retries + 1)
      }
      throw error
    }
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    try {
      const tokensStr = localStorage.getItem('authTokens')
      if (tokensStr) {
        const tokens = JSON.parse(tokensStr)
        return tokens.idToken || null
      }
    } catch {
      // ignore
    }
    return null
  }

  async connect(): Promise<ZohoBooksConnectResponse> {
    return await this.makeRequest<ZohoBooksConnectResponse>('/zoho-books/connect', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async getConnectionStatus(): Promise<ZohoBooksConnectionStatus> {
    try {
      return await this.makeRequest<ZohoBooksConnectionStatus>('/zoho-books/connections', {
        method: 'GET',
      })
    } catch {
      return { connected: false }
    }
  }

  async discoverEntities(orgId?: string): Promise<{ entities: EntityInfo[] }> {
    const params = new URLSearchParams()
    if (orgId) params.set('org_id', orgId)
    const qs = params.toString()
    return await this.makeRequest<{ entities: EntityInfo[] }>(
      `/zoho-books/discover-entities${qs ? `?${qs}` : ''}`,
      { method: 'GET' }
    )
  }

  async getEntityFields(entity: string): Promise<{ entity: string; fields: Array<{ key: string; label: string; description?: string; required?: boolean; data_type?: string }>; count: number }> {
    const params = new URLSearchParams({ entity })
    return await this.makeRequest(`/zoho-books/entity-fields?${params.toString()}`, {
      method: 'GET',
    })
  }

  async aiAutoMap(fileColumns: string[], entity: string, uploadId?: string): Promise<{ mapping: Record<string, string>; columns_mapped: number; method?: string }> {
    return await this.makeRequest('/zoho-books/ai-automap', {
      method: 'POST',
      body: JSON.stringify({ file_columns: fileColumns, entity, upload_id: uploadId }),
    })
  }

  async disconnect(): Promise<void> {
    await this.makeRequest('/zoho-books/disconnect', {
      method: 'DELETE',
    })
  }

  async importData(
    entity: string,
    filters: ZohoBooksImportFilters = {},
    orgId?: string
  ): Promise<ZohoBooksImportResponse> {
    return await this.makeRequest<ZohoBooksImportResponse>('/zoho-books/import', {
      method: 'POST',
      body: JSON.stringify({
        entity,
        filters,
        org_id: orgId,
      }),
    })
  }

  async exportToZoho(
    uploadId: string,
    entity?: string,
    orgId?: string,
    columnMapping?: Record<string, string>
  ): Promise<ZohoBooksExportResponse> {
    return await this.makeRequest<ZohoBooksExportResponse>('/zoho-books/export', {
      method: 'POST',
      body: JSON.stringify({
        upload_id: uploadId,
        entity,
        org_id: orgId,
        column_mapping: columnMapping,
      }),
    })
  }

  async getExportStatus(uploadId: string): Promise<ZohoBooksExportStatusResponse> {
    const params = new URLSearchParams({ upload_id: uploadId })
    return await this.makeRequest<ZohoBooksExportStatusResponse>(`/zoho-books/export-status?${params.toString()}`, {
      method: 'GET',
    })
  }

  async openOAuthPopup(): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        const response = await this.connect()

        if (!response.auth_url) {
          resolve({ success: false, error: 'No auth URL received' })
          return
        }

        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        const authWindow = window.open(
          response.auth_url,
          'Zoho Books OAuth',
          `width=${width},height=${height},top=${top},left=${left}`
        )

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          if (event.data.type === 'zoho-books-auth-success') {
            window.removeEventListener('message', messageHandler)
            resolve({ success: true })
          } else if (event.data.type === 'zoho-books-auth-error') {
            window.removeEventListener('message', messageHandler)
            resolve({ success: false, error: event.data.error || 'Authorization failed' })
          }
        }

        window.addEventListener('message', messageHandler)

        const pollTimer = setInterval(() => {
          if (authWindow && authWindow.closed) {
            clearInterval(pollTimer)
            window.removeEventListener('message', messageHandler)
            resolve({ success: false, error: 'Auth window closed' })
          }
        }, 500)
      } catch (error) {
        resolve({ success: false, error: (error as Error).message || 'Connection failed' })
      }
    })
  }
}

export const zohoBooksAPI = new ZohoBooksService()
export default zohoBooksAPI
