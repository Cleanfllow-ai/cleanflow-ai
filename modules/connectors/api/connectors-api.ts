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

  /** List all registered providers. */
  async listProviders(): Promise<{ providers: ProviderInfo[] }> {
    return await this.makeRequest<{ providers: ProviderInfo[] }>(
      "/connectors/available",
      { method: "GET" },
    )
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
}

export const connectorsAPI = new ConnectorsAPI()
export default connectorsAPI
