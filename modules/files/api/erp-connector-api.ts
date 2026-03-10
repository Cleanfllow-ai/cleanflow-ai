import { AWS_CONFIG } from "@/shared/config/aws-config"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

export interface ConnectorConnectionStatus {
  connected: boolean
  provider?: string
}

export interface ConnectorExportResponse {
  success?: boolean
  records_created?: number
  records_updated?: number
  records_failed?: number
  records_exported?: number
  message?: string
  status?: string
  [key: string]: unknown
}

export interface ConnectorERPListResponse {
  erps: string[]
  connectors: string[]
}

/**
 * Generic ERP Connector API.
 * Uses the unified /erp/connector/* endpoints — works for any registered provider.
 * Backend auto-resolves column mapping for cross-ERP export.
 */
class ERPConnectorService {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    const token = this.getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
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
        return this.makeRequest<T>(endpoint, options, retries + 1)
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

  /**
   * List all available ERPs (from template + registered connectors).
   */
  async listERPs(): Promise<ConnectorERPListResponse> {
    return await this.makeRequest<ConnectorERPListResponse>('/erp/mapping/erps', {
      method: 'GET',
    })
  }

  /**
   * Check connection status for any provider.
   */
  async getConnectionStatus(provider: string): Promise<ConnectorConnectionStatus> {
    try {
      const params = new URLSearchParams({ provider })
      return await this.makeRequest<ConnectorConnectionStatus>(
        `/erp/connector/connections?${params.toString()}`,
        { method: 'GET' }
      )
    } catch {
      return { connected: false, provider }
    }
  }

  /**
   * Initiate OAuth connection for any provider.
   */
  async connect(provider: string): Promise<{ auth_url: string }> {
    return await this.makeRequest<{ auth_url: string }>('/erp/connector/connect', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    })
  }

  /**
   * Export cleaned data to any provider.
   * Backend auto-resolves column mapping for cross-ERP scenarios.
   */
  async exportToERP(
    provider: string,
    uploadId: string,
    entity?: string,
    orgId?: string,
    columnMapping?: Record<string, string>
  ): Promise<ConnectorExportResponse> {
    return await this.makeRequest<ConnectorExportResponse>('/erp/connector/export', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        upload_id: uploadId,
        entity,
        org_id: orgId,
        column_mapping: columnMapping,
      }),
    })
  }

  /**
   * Import data from any provider.
   */
  async importFromERP(
    provider: string,
    entity: string,
    filters: Record<string, unknown> = {},
    orgId?: string
  ): Promise<unknown> {
    return await this.makeRequest('/erp/connector/import', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        entity,
        filters,
        org_id: orgId,
      }),
    })
  }

  /**
   * Disconnect any provider.
   */
  async disconnect(provider: string): Promise<void> {
    await this.makeRequest('/erp/connector/disconnect', {
      method: 'DELETE',
      body: JSON.stringify({ provider }),
    })
  }
}

export const erpConnectorAPI = new ERPConnectorService()
export default erpConnectorAPI
