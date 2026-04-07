/**
 * Unified Connectors API — auth & meta operations for any provider.
 *
 * Routes:
 *   POST   /connectors/{provider}/connect
 *   GET    /connectors/callback/{provider}   (public — no auth)
 *   GET    /connectors/{provider}/connections
 *   DELETE /connectors/{provider}/disconnect
 *   GET    /connectors/available
 *   GET    /connectors/connections
 */

import { ConnectorAPIBase } from "./base"

export interface PostAuthConfigOption {
  value: string
  label: string
}

export interface PostAuthConfigField {
  key: string
  label: string
  type: "select" | "text" | "toggle"
  required: boolean
  options?: PostAuthConfigOption[]
  current_value?: string
}

export interface ConnectionStatus {
  connected: boolean
  status?: string
  connection?: Record<string, unknown>
  post_auth_config?: PostAuthConfigField[]
}

export interface ProviderInfo {
  provider_id: string
  display_name: string
  category: string
  capabilities?: {
    supports_import: boolean
    supports_export: boolean
    supports_oauth: boolean
    supports_webhooks: boolean
    supports_batch: boolean
    max_batch_size: number
    auth_method: string
    rate_limit_per_second: number
  }
}

// Sample providers shown alongside real backend providers
const SAMPLE_PROVIDERS: ProviderInfo[] = [
  { provider_id: "sap", display_name: "SAP", category: "erp" },
  { provider_id: "salesforce", display_name: "Salesforce", category: "erp" },
  { provider_id: "netsuite", display_name: "NetSuite", category: "erp" },
  { provider_id: "epicor", display_name: "Epicor Kinetic", category: "erp" },
  { provider_id: "qad", display_name: "QAD", category: "erp" },
  { provider_id: "dynamics", display_name: "Microsoft Dynamics", category: "erp" },
]

class ConnectorsAPI extends ConnectorAPIBase {
  /** Initiate OAuth for any provider. Returns auth_url for popup. */
  async connect(
    provider: string,
    options?: { redirect_uri?: string; account_identifier?: string },
  ): Promise<{ auth_url: string }> {
    return await this.makeRequest<{ auth_url: string }>(
      `/connectors/${provider}/connect`,
      {
        method: "POST",
        body: JSON.stringify(options ?? {}),
      },
    )
  }

  /** Handle OAuth callback (public endpoint, no auth). */
  async handleCallback(
    provider: string,
    params: { code: string; state: string; realmId?: string },
  ): Promise<unknown> {
    const qs = new URLSearchParams({
      code: params.code,
      state: params.state,
      ...(params.realmId ? { realmId: params.realmId } : {}),
    })
    return await this.makeRequest(
      `/connectors/callback/${provider}?${qs.toString()}`,
      { method: "GET" },
      true,
    )
  }

  /** Check connection status for a specific provider. */
  async getConnectionStatus(provider: string): Promise<ConnectionStatus> {
    try {
      return await this.makeRequest<ConnectionStatus>(
        `/connectors/${provider}/connections`,
        { method: "GET" },
      )
    } catch {
      return { connected: false }
    }
  }

  /** Disconnect a specific provider. */
  async disconnect(provider: string): Promise<void> {
    await this.makeRequest(`/connectors/${provider}/disconnect`, {
      method: "DELETE",
    })
  }

  /** Save post-auth configuration (e.g. org selection). */
  async saveConfig(
    provider: string,
    config: Record<string, string>,
  ): Promise<{ message: string }> {
    return await this.makeRequest<{ message: string }>(
      `/connectors/${provider}/configure`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    )
  }

  /** List all registered providers (merges backend + sample placeholders). */
  async listProviders(): Promise<{ providers: ProviderInfo[] }> {
    const resp = await this.makeRequest<{ providers: ProviderInfo[] }>(
      "/connectors/available",
      { method: "GET" },
    )
    const realIds = new Set((resp.providers || []).map((p) => p.provider_id))
    const extras = SAMPLE_PROVIDERS.filter((s) => !realIds.has(s.provider_id))
    return { providers: [...(resp.providers || []), ...extras] }
  }

  /** List all connections for the current user. */
  async listConnections(): Promise<{ connections: Record<string, unknown>[] }> {
    return await this.makeRequest<{
      connections: Record<string, unknown>[]
    }>("/connectors/connections", { method: "GET" })
  }

  /** Open OAuth popup for any provider. */
  async openOAuthPopupForProvider(
    provider: string,
    connectOptions?: { redirect_uri?: string; account_identifier?: string },
  ): Promise<{ success: boolean; error?: string }> {
    return this.openOAuthPopup(provider, () =>
      this.connect(provider, connectOptions),
    )
  }

  /** Discover entities/tables for any provider (category-agnostic). */
  async discoverEntities(
    provider: string,
    params?: Record<string, string>,
  ): Promise<{
    provider: string
    category: string
    entities: Array<{ key: string; label: string }>
  }> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : ""
    return await this.makeRequest(
      `/connectors/${provider}/entities${qs}`,
    )
  }

  /** Get field definitions for any provider/entity (category-agnostic). */
  async getEntityFields(
    provider: string,
    entity: string,
    params?: Record<string, string>,
  ): Promise<{
    provider: string
    category: string
    entity: string
    fields: Array<{
      key: string
      label: string
      data_type: string
      required: boolean
    }>
  }> {
    const qs = new URLSearchParams({
      entity,
      ...(params || {}),
    }).toString()
    return await this.makeRequest(
      `/connectors/${provider}/fields?${qs}`,
    )
  }

  /** Auto-map source fields to destination fields with confidence scoring. */
  async autoMap(
    sourceProvider: string,
    destinationProvider: string,
    entity: string,
    sourceFields?: string[],
    sourceParams?: Record<string, string>,
    destinationEntity?: string,
    destinationParams?: Record<string, string>,
  ): Promise<{
    mappings: Array<{
      source: string
      destination: string
      confidence: number
      method: string
    }>
    unmapped_source: string[]
    unmapped_destination: string[]
  }> {
    return await this.makeRequest(
      `/connectors/${sourceProvider}/automap`,
      {
        method: "POST",
        body: JSON.stringify({
          source_provider: sourceProvider,
          destination_provider: destinationProvider,
          entity,
          source_fields: sourceFields || [],
          params: sourceParams || {},
          destination_entity: destinationEntity || entity,
          destination_params: destinationParams || {},
        }),
      },
    )
  }
}

export const connectorsAPI = new ConnectorsAPI()
export default connectorsAPI
