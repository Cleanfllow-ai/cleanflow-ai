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
  ui_only?: boolean
  entity_count?: number
  auth_method?: string
  connector_file?: string
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

export const UI_ONLY_PROVIDERS: ProviderInfo[] = [
  // Salesforce is now BE-registered (rightrev-demo) — flipped out of UI-only on
  // 2026-05-16 as part of the v62.0 connector scaffold. The BE deploy is
  // pending the Connected App credentials in Secrets Manager. Once
  // `cdk deploy connectors-context` completes, `/connectors/available` will
  // return salesforce in the live registry, so this entry is no longer needed.
  {
    provider_id: "netsuite",
    display_name: "NetSuite",
    category: "erp",
    ui_only: true,
    auth_method: "OAuth2",
  },
  {
    provider_id: "epicor",
    display_name: "Epicor Kinetic",
    category: "erp",
    ui_only: true,
    auth_method: "API Key",
  },
  {
    provider_id: "qad",
    display_name: "QAD ERP",
    category: "erp",
    ui_only: true,
    auth_method: "OAuth2",
  },
  {
    provider_id: "odoo",
    display_name: "Odoo",
    category: "erp",
    ui_only: true,
    entity_count: 166,
    auth_method: "API Key / XML-RPC",
    connector_file: "backend/odoo_connector.py",
  },
  {
    provider_id: "d365",
    display_name: "Microsoft Dynamics 365 BC",
    category: "erp",
    ui_only: true,
    entity_count: 88,
    auth_method: "OAuth2 / ROPC",
    connector_file: "backend/d365_connector.py",
  },
  {
    provider_id: "erpnext",
    display_name: "ERPNext / Frappe",
    category: "erp",
    ui_only: true,
    entity_count: 62,
    auth_method: "Username + Password",
    connector_file: "backend/erpnext_connector.py",
  },
  {
    provider_id: "oracleords",
    display_name: "Oracle ORDS",
    category: "erp",
    ui_only: true,
    entity_count: 57,
    auth_method: "Basic Auth",
    connector_file: "backend/oracle_connector.py",
  },
  {
    provider_id: "sap",
    display_name: "SAP S/4HANA Cloud",
    category: "erp",
    ui_only: true,
    entity_count: 53,
    auth_method: "API Key",
    connector_file: "backend/sap_connector.py",
  },
  {
    provider_id: "zohobooks",
    display_name: "Zoho Books",
    category: "erp",
    ui_only: true,
    entity_count: 42,
    auth_method: "OAuth2 / Refresh Token",
    connector_file: "backend/zoho_connector.py",
  },
  {
    provider_id: "xero",
    display_name: "Xero",
    category: "erp",
    ui_only: true,
    entity_count: 41,
    auth_method: "OAuth2 / Refresh Token",
    connector_file: "backend/xero_connector.py",
  },
  {
    provider_id: "dolibarr",
    display_name: "Dolibarr",
    category: "erp",
    ui_only: true,
    entity_count: 36,
    auth_method: "API Key / DOLAPIKEY",
    connector_file: "backend/dolibarr_connector.py",
  },
  {
    provider_id: "katana",
    display_name: "Katana MRP",
    category: "erp",
    ui_only: true,
    entity_count: 27,
    auth_method: "Bearer Token",
    connector_file: "backend/katana_connector.py",
  },
  {
    provider_id: "sage-accounting",
    display_name: "Sage Business Cloud Accounting",
    category: "erp",
    ui_only: true,
    entity_count: 19,
    auth_method: "OAuth2",
    connector_file: "backend/sage_accounting_connector.py",
  },
  {
    provider_id: "myob-acumatica",
    display_name: "MYOB Acumatica",
    category: "erp",
    ui_only: true,
    entity_count: 18,
    auth_method: "OAuth2",
    connector_file: "backend/myob_acumatica_connector.py",
  },
  {
    provider_id: "stripe",
    display_name: "Stripe",
    category: "erp",
    ui_only: true,
    entity_count: 15,
    auth_method: "API Key / Bearer Token",
    connector_file: "backend/stripe_connector.py",
  },
  {
    provider_id: "square",
    display_name: "Square",
    category: "erp",
    ui_only: true,
    entity_count: 15,
    auth_method: "Bearer Token",
    connector_file: "backend/square_connector.py",
  },
  {
    provider_id: "chargebee",
    display_name: "Chargebee",
    category: "erp",
    ui_only: true,
    entity_count: 13,
    auth_method: "API Key / HTTP Basic",
    connector_file: "backend/chargebee_connector.py",
  },
  {
    provider_id: "razorpay",
    display_name: "Razorpay",
    category: "erp",
    ui_only: true,
    entity_count: 13,
    auth_method: "API Key / HTTP Basic",
    connector_file: "backend/razorpay_connector.py",
  },
  {
    provider_id: "recurly",
    display_name: "Recurly",
    category: "erp",
    ui_only: true,
    entity_count: 13,
    auth_method: "API Key / HTTP Basic",
    connector_file: "backend/recurly_connector.py",
  },
  {
    provider_id: "bill",
    display_name: "BILL",
    category: "erp",
    ui_only: true,
    entity_count: 13,
    auth_method: "API Key / DevKey + Session",
    connector_file: "backend/bill_connector.py",
  },
  {
    provider_id: "chargeover",
    display_name: "ChargeOver",
    category: "erp",
    ui_only: true,
    entity_count: 13,
    auth_method: "API Key / HTTP Basic",
    connector_file: "backend/chargeover_connector.py",
  },
  {
    provider_id: "nolapro",
    display_name: "NolaPro",
    category: "erp",
    ui_only: true,
    entity_count: 14,
    auth_method: "HMAC-SHA1 / API Key",
    connector_file: "backend/nolapro_connector.py",
  },
  {
    provider_id: "taxjar",
    display_name: "TaxJar",
    category: "erp",
    ui_only: true,
    entity_count: 10,
    auth_method: "API Key / Bearer Token",
    connector_file: "backend/taxjar_connector.py",
  },
  {
    provider_id: "adyen",
    display_name: "Adyen",
    category: "erp",
    ui_only: true,
    entity_count: 10,
    auth_method: "API Key / X-API-Key",
    connector_file: "backend/adyen_connector.py",
  },
  {
    provider_id: "paddle",
    display_name: "Paddle",
    category: "erp",
    ui_only: true,
    entity_count: 10,
    auth_method: "Bearer Token",
    connector_file: "backend/paddle_connector.py",
  },
  {
    provider_id: "braintree",
    display_name: "Braintree",
    category: "erp",
    ui_only: true,
    entity_count: 10,
    auth_method: "API Key / SDK",
    connector_file: "backend/braintree_connector.py",
  },
  {
    provider_id: "authorizenet",
    display_name: "Authorize.Net",
    category: "erp",
    ui_only: true,
    entity_count: 8,
    auth_method: "Login ID + Transaction Key",
    connector_file: "backend/authorizenet_connector.py",
  },
  {
    provider_id: "paypal",
    display_name: "PayPal",
    category: "erp",
    ui_only: true,
    entity_count: 7,
    auth_method: "OAuth2 Client Credentials",
    connector_file: "backend/paypal_connector.py",
  },
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
    } catch (err) {
      // We swallow the error here so consumers don't have to distinguish
      // "not connected" from "endpoint failed" — but log the original so
      // support can diagnose 401/5xx vs a genuine 404. Without this, a
      // Cognito JWT expiry on this endpoint is indistinguishable from an
      // intentional "no connection yet" reply.
      // eslint-disable-next-line no-console
      console.warn(
        `[connectors] getConnectionStatus(${provider}) failed; treating as disconnected:`,
        err,
      )
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

  /** List all registered providers, optionally including UI-only placeholders. */
  async listProviders(
    options?: { includeUiOnly?: boolean },
  ): Promise<{ providers: ProviderInfo[] }> {
    const resp = await this.makeRequest<{ providers: ProviderInfo[] }>(
      "/connectors/available",
      { method: "GET" },
    )
    if (!options?.includeUiOnly) {
      return { providers: resp.providers || [] }
    }
    const realIds = new Set((resp.providers || []).map((p) => p.provider_id))
    const extras = UI_ONLY_PROVIDERS.filter((provider) => !realIds.has(provider.provider_id))
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
