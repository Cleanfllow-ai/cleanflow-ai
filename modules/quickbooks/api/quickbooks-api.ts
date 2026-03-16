import { AWS_CONFIG } from "@/shared/config/aws-config"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

// ─── Types (imported from modules/quickbooks/types, re-exported for backwards compatibility) ───
import type {
  QuickBooksConnectResponse,
  QuickBooksConnectionStatus,
  QuickBooksImportResponse,
  QuickBooksExportResponse,
  QuickBooksImportFilters,
} from "@/modules/quickbooks/types/quickbooks.types"

export type {
  QuickBooksConnectResponse,
  QuickBooksConnectionStatus,
  QuickBooksImportResponse,
  QuickBooksExportResponse,
  QuickBooksImportFilters,
} from "@/modules/quickbooks/types/quickbooks.types"

/**
 * QuickBooks ERP Service
 * Handles all QuickBooks integration operations
 */
class QuickBooksService {
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

    // Add auth token unless skipping
    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    try {
      // Create abort controller with timeout (60 seconds for export operations)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ QuickBooks API Error:', error)

      // Retry logic for timeout errors
      if ((error as Error).name === 'AbortError' && retries < 2) {
        console.log(`⏱️ Request timed out, retrying... (attempt ${retries + 1}/2)`)
        // Exponential backoff: 2s, then 4s
        await new Promise(resolve => setTimeout(resolve, (retries + 1) * 2000))
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
      // Ignore parse errors
    }
    return null
  }

  /**
   * Connect to QuickBooks - Get OAuth URL
   */
  async connect(): Promise<QuickBooksConnectResponse> {
    try {
      const response = await this.makeRequest<QuickBooksConnectResponse>('/quickbooks/connect', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      return response
    } catch (error) {
      console.error('QuickBooks connect error:', error)
      throw error
    }
  }

  /**
   * Handle OAuth callback
   * Note: This endpoint does NOT require authentication - user_id comes from state parameter
   */
  async handleCallback(code: string, realmId: string, state: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        `/quickbooks/callback?code=${code}&realmId=${realmId}&state=${state}`,
        { method: 'GET' },
        true // skipAuth - callback endpoint is public
      )
      return response
    } catch (error) {
      console.error('QuickBooks callback error:', error)
      throw error
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<QuickBooksConnectionStatus> {
    try {
      const response = await this.makeRequest<QuickBooksConnectionStatus>('/quickbooks/connections', {
        method: 'GET',
      })
      return response
    } catch (error) {
      console.error('Get connection status error:', error)
      return { connected: false }
    }
  }

  async discoverEntities(): Promise<{ entities: Array<{ entity: string; label: string; record_count: number; has_data: boolean; available: boolean; reason?: string }> }> {
    try {
      return await this.makeRequest<{ entities: Array<{ entity: string; label: string; record_count: number; has_data: boolean; available: boolean; reason?: string }> }>('/quickbooks/discover-entities', {
        method: 'GET',
      })
    } catch (error) {
      console.error('QuickBooks discover entities error:', error)
      return { entities: [] }
    }
  }

  /**
   * Get entity field definitions from backend
   */
  async getEntityFields(entity: string): Promise<{ entity: string; fields: Array<{ key: string; label: string; description?: string; required?: boolean; data_type?: string }>; count: number }> {
    const params = new URLSearchParams({ entity, provider: 'quickbooks' })
    return await this.makeRequest(`/erp/entity-fields?${params.toString()}`, {
      method: 'GET',
    })
  }

  async aiAutoMap(fileColumns: string[], entity: string, uploadId?: string): Promise<{ mapping: Record<string, string>; columns_mapped: number; method?: string }> {
    return await this.makeRequest('/erp/ai-automap', {
      method: 'POST',
      body: JSON.stringify({ file_columns: fileColumns, entity, provider: 'quickbooks', upload_id: uploadId }),
    })
  }

  /**
   * Disconnect from QuickBooks
   */
  async disconnect(): Promise<void> {
    try {
      await this.makeRequest('/quickbooks/disconnect', {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('QuickBooks disconnect error:', error)
      throw error
    }
  }

  /**
   * Import data from QuickBooks
   * @param entity - Entity type (customers, invoices, vendors, items)
   * @param filters - Optional filters (limit, date_from, date_to)
   */
  async importData(
    entity: string,
    filters: QuickBooksImportFilters = {}
  ): Promise<QuickBooksImportResponse> {
    try {
      const response = await this.makeRequest<QuickBooksImportResponse>('/quickbooks/import', {
        method: 'POST',
        body: JSON.stringify({
          entity,
          filters,
        }),
      })
      return response
    } catch (error) {
      console.error('QuickBooks import error:', error)
      throw error
    }
  }

  /**
   * Export/Upload cleaned data to QuickBooks
   * @param uploadId - The upload ID of cleaned data
   * @param entity - Optional entity type (customers, invoices, vendors, items)
   * @param columnMapping - Optional column mapping from file columns to QB fields
   */
  async exportToQuickBooks(
    uploadId: string,
    entity?: string,
    columnMapping?: Record<string, string>
  ): Promise<QuickBooksExportResponse> {
    try {
      const response = await this.makeRequest<QuickBooksExportResponse>('/quickbooks/export', {
        method: 'POST',
        body: JSON.stringify({
          upload_id: uploadId,
          entity: entity || 'invoices',
          column_mapping: columnMapping || {},
        }),
      })
      return response
    } catch (error) {
      console.error('QuickBooks export error:', error)
      throw error
    }
  }

  /**
   * Open QuickBooks OAuth in popup window
   * Returns a promise that resolves when auth completes
   */
  async openOAuthPopup(): Promise<{ success: boolean; realmId?: string; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        const response = await this.connect()

        if (!response.auth_url) {
          resolve({ success: false, error: 'No auth URL received' })
          return
        }

        // Open popup
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        const authWindow = window.open(
          response.auth_url,
          'QuickBooks OAuth',
          `width=${width},height=${height},top=${top},left=${left}`
        )

        // Listen for message from callback window
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          if (event.data.type === 'quickbooks-auth-success') {
            clearInterval(checkWindow)
            window.removeEventListener('message', messageHandler)
            resolve({ success: true, realmId: event.data.realmId })
          } else if (event.data.type === 'quickbooks-auth-error') {
            clearInterval(checkWindow)
            window.removeEventListener('message', messageHandler)
            resolve({ success: false, error: event.data.error })
          }
        }

        window.addEventListener('message', messageHandler)

        // Poll for window closure as fallback
        const checkWindow = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkWindow)
            window.removeEventListener('message', messageHandler)
            // Return success with unknown status (will recheck connection)
            resolve({ success: true })
          }
        }, 500)
      } catch (error) {
        resolve({ success: false, error: (error as Error).message })
      }
    })
  }
}

export const quickBooksAPI = new QuickBooksService()
export default quickBooksAPI
