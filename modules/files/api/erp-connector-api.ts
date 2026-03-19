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

export interface ColumnResolution {
  column: string
  entity: string
  cdf_field: string
  confidence?: number
  method?: string
}

export interface SchemaResolveResponse {
  resolutions: ColumnResolution[]
  entities_needed: string[]
  unmapped: string[]
  total: number
  mapped: number
}

export interface MultiExportEntityResult {
  entity: string
  success_count: number
  failed_count: number
  errors: string[]
}

export interface MultiExportResponse {
  status: 'done' | 'failed' | 'processing'
  results?: MultiExportEntityResult[]
  message?: string
}

export interface MultiExportProgress {
  provider: string
  status: 'running' | 'done' | 'failed'
  entities: Array<{
    entity: string
    status: 'pending' | 'running' | 'done' | 'failed'
    success: number
    failed: number
  }>
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
    return await this.makeRequest<ConnectorERPListResponse>('/connectors/erp/mapping/erps', {
      method: 'GET',
    })
  }

  /**
   * Check connection status for any provider.
   */
  async getConnectionStatus(provider: string): Promise<ConnectorConnectionStatus> {
    try {
      return await this.makeRequest<ConnectorConnectionStatus>(
        `/connectors/${provider}/connections`,
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
    return await this.makeRequest<{ auth_url: string }>(`/connectors/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify({}),
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
    return await this.makeRequest<ConnectorExportResponse>(`/connectors/erp/${provider}/export`, {
      method: 'POST',
      body: JSON.stringify({
        upload_id: uploadId,
        entity_type: entity,
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
    return await this.makeRequest(`/connectors/erp/${provider}/import`, {
      method: 'POST',
      body: JSON.stringify({
        entity_type: entity,
        filters,
        org_id: orgId,
      }),
    })
  }

  /**
   * Disconnect any provider.
   */
  async disconnect(provider: string): Promise<void> {
    await this.makeRequest(`/connectors/${provider}/disconnect`, {
      method: 'DELETE',
    })
  }

  /**
   * Resolve CSV columns to entity.field pairs via LLM + template matching.
   */
  async schemaResolve(
    provider: string,
    columns: string[]
  ): Promise<SchemaResolveResponse> {
    return await this.makeRequest<SchemaResolveResponse>('/connectors/erp/schema-resolve', {
      method: 'POST',
      body: JSON.stringify({ provider, columns }),
    })
  }

  /**
   * Start a multi-entity export using pre-resolved column mappings.
   */
  async multiExport(
    provider: string,
    uploadId: string,
    columnResolutions: ColumnResolution[],
    orgId?: string
  ): Promise<MultiExportResponse> {
    return await this.makeRequest<MultiExportResponse>('/connectors/erp/multi-export', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        upload_id: uploadId,
        column_resolutions: columnResolutions,
        org_id: orgId,
      }),
    })
  }

  /**
   * Poll progress for an in-flight multi-entity export.
   */
  async multiExportStatus(
    provider: string,
    uploadId: string
  ): Promise<MultiExportProgress> {
    const params = new URLSearchParams({ provider, upload_id: uploadId })
    return await this.makeRequest<MultiExportProgress>(
      `/connectors/erp/multi-export/status?${params.toString()}`,
      { method: 'GET' }
    )
  }
}

export const erpConnectorAPI = new ERPConnectorService()
export default erpConnectorAPI
