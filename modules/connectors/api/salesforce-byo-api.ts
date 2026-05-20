/**
 * Salesforce Bring-Your-Own Connected App (BYO-CA) setup API.
 *
 * Backend contract (rightrev-demo branch, parallel agent):
 *   GET    /connectors/salesforce/setup-info       (JWT)
 *   POST   /connectors/salesforce/init             (JWT) — body: BYO or shared mode
 *   POST   /connectors/salesforce/test-config      (JWT) — optional pre-OAuth validation
 *
 * The init endpoint returns an auth_url which the FE must navigate to via a
 * FULL PAGE redirect (window.location.assign). Salesforce blocks iframed
 * auth screens, so popup flows fail; we use the existing
 * /connectors/callback?provider=salesforce route on return.
 */

import { ConnectorAPIBase } from "./base"

export type SalesforceEnvironment = "production" | "sandbox"
export type SalesforceOAuthMode = "byo" | "shared"

export interface SalesforceSetupInfo {
  callback_url: string
  required_scopes: string[]
  supported_environments: SalesforceEnvironment[]
  login_urls: {
    production: string
    sandbox: string
  }
  setup_doc_url: string
  shared_app_available: boolean
  shared_app_status: "active" | "permitted_users_restricted"
}

export interface SalesforceByoInitRequest {
  mode: "byo"
  client_id: string
  client_secret: string
  login_url: string
  environment: SalesforceEnvironment
}

export interface SalesforceSharedInitRequest {
  mode: "shared"
  environment: SalesforceEnvironment
}

export type SalesforceInitRequest =
  | SalesforceByoInitRequest
  | SalesforceSharedInitRequest

export interface SalesforceInitResponse {
  auth_url: string
  state: string
  expires_at: string
}

export interface SalesforceInitError {
  code: string
  message: string
}

export interface SalesforceTestConfigResponse {
  ok: boolean
  error?: string
}

class SalesforceByoAPI extends ConnectorAPIBase {
  /** Fetch setup metadata: callback URL, scopes, environments, shared-app availability. */
  async getSetupInfo(): Promise<SalesforceSetupInfo> {
    return await this.makeRequest<SalesforceSetupInfo>(
      "/connectors/salesforce/setup-info",
      { method: "GET" },
    )
  }

  /**
   * Initiate OAuth for either mode.
   *
   * BYO: backend stores credentials, signs OAuth state, returns auth_url for
   *      the customer's own Connected App.
   * shared: backend uses CleanFlowAI's shared Connected App (only works when
   *      shared_app_available=true).
   */
  async init(request: SalesforceInitRequest): Promise<SalesforceInitResponse> {
    return await this.makeRequest<SalesforceInitResponse>(
      "/connectors/salesforce/init",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    )
  }

  /**
   * Optional pre-OAuth validation: checks that the BYO Consumer Key + Secret
   * actually resolve at the provided login URL. Returns ok=true on green,
   * ok=false + error message on red. Errors are non-throwing — the caller
   * inspects the `ok` boolean.
   */
  async testConfig(
    request: SalesforceByoInitRequest,
  ): Promise<SalesforceTestConfigResponse> {
    try {
      return await this.makeRequest<SalesforceTestConfigResponse>(
        "/connectors/salesforce/test-config",
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      )
    } catch (err) {
      // Convert thrown API errors into the same { ok, error } shape so the
      // UI doesn't need a separate try/catch path.
      const message =
        (err as Error)?.message || "Could not reach the test endpoint."
      return { ok: false, error: message }
    }
  }
}

export const salesforceByoAPI = new SalesforceByoAPI()
export default salesforceByoAPI
