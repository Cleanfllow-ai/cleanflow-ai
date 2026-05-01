import { AWS_CONFIG } from "@/shared/config/aws-config"
import { ApiError, parseApiError } from "@/modules/shared/api-error"
import { getValidTokenAsync } from "@/modules/shared/auth-token-bridge"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

/**
 * Shared base for all connector API modules.
 * Provides auth-token retrieval, timeout, and retry logic.
 *
 * Throws `ApiError` (not plain `Error`) on non-2xx responses so callers can
 * branch on `status` / `code` / `action` / `provider` and surface actionable
 * toasts. Includes a transparent 401 retry: if the backend returns 401 and
 * `getValidTokenAsync()` produces a fresh token, the original request is
 * retried once before the error is propagated.
 */
export class ConnectorAPIBase {
  protected baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth: boolean = false,
    retries: number = 0,
    didReauth: boolean = false,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
    }

    // The OAuth callback page handles 401 in its own way; never silently
    // refresh tokens for it.
    const isOAuthCallback = endpoint.startsWith("/connectors/callback")

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

        // Transparent 401 token-refresh: try once if we haven't already.
        if (
          response.status === 401 &&
          !skipAuth &&
          !didReauth &&
          !isOAuthCallback
        ) {
          try {
            const fresh = await getValidTokenAsync()
            if (fresh) {
              return this.makeRequest<T>(endpoint, options, skipAuth, retries, true)
            }
          } catch {
            // Refresh failed — fall through and throw the typed ApiError below
            throw new ApiError({
              status: 401,
              message: "Session expired",
              action: "signin",
              raw: errorData,
            })
          }
        }

        throw parseApiError(response, errorData)
      }

      return await response.json()
    } catch (error) {
      if ((error as Error).name === "AbortError" && retries < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, (retries + 1) * 2000),
        )
        return this.makeRequest<T>(endpoint, options, skipAuth, retries + 1, didReauth)
      }
      throw error
    }
  }

  protected getAuthToken(): string | null {
    if (typeof window === "undefined") return null
    try {
      // Primary: authTokens stored by our auth module
      const tokensStr = localStorage.getItem("authTokens")
      if (tokensStr) {
        const tokens = JSON.parse(tokensStr)
        if (tokens.idToken) return tokens.idToken
      }
      // Fallback: scan Cognito session keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes(".idToken")) {
          const val = localStorage.getItem(key)
          if (val) return val
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  /**
   * Open an OAuth popup for any provider.
   * Listens for postMessage events with `{type: "{provider}-auth-success"}` or `"-auth-error"`.
   */
  async openOAuthPopup(
    provider: string,
    connectFn: () => Promise<{ auth_url: string }>,
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        const response = await connectFn()

        if (!response.auth_url) {
          resolve({ success: false, error: "No auth URL received" })
          return
        }

        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        const authWindow = window.open(
          response.auth_url,
          `${provider} OAuth`,
          `width=${width},height=${height},top=${top},left=${left}`,
        )

        const cleanup = (result: { success: boolean; error?: string }) => {
          clearInterval(pollTimer)
          window.removeEventListener("message", messageHandler)
          resolve(result)
        }

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          if (event.data.type === `${provider}-auth-success`) {
            cleanup({ success: true })
          } else if (event.data.type === `${provider}-auth-error`) {
            cleanup({
              success: false,
              error: event.data.error || "Authorization failed",
            })
          }
        }

        window.addEventListener("message", messageHandler)

        const pollTimer = setInterval(() => {
          try {
            if (authWindow && authWindow.closed) {
              cleanup({ success: false, error: "Auth window closed" })
            }
          } catch {
            // COOP policy may block access — rely on postMessage
          }
        }, 500)
      } catch (error) {
        resolve({
          success: false,
          error: (error as Error).message || "Connection failed",
        })
      }
    })
  }
}
