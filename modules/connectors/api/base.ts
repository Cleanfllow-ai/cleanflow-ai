import { AWS_CONFIG } from "@/shared/config/aws-config"
import { ApiError, parseApiError } from "@/modules/shared/api-error"
import { getValidTokenAsync } from "@/modules/shared/auth-token-bridge"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

/**
 * Refresh the Cognito ID token with ONE retry on transient errors.
 *
 * Why: a transient `cognitoApi.refreshSession` failure (network blip, AWS
 * Cognito 5xx, throttling) was previously converted into a permanent
 * "Session expired — sign in again" UX even though a single retry would
 * have succeeded.
 *
 * Retry rules:
 *   - Retry once with 500 ms backoff for transient errors.
 *   - Do NOT retry `NotAuthorizedException` (refresh token genuinely
 *     expired/revoked) — surrender immediately so the user re-auths.
 *   - Do NOT retry if the bridge has no getter registered (boot race).
 */
export async function refreshTokenWithRetry(): Promise<string> {
    try {
        return await getValidTokenAsync()
    } catch (err) {
        // Genuinely expired/revoked refresh token — re-auth required.
        // Cognito throws an Error whose `.name` is "NotAuthorizedException".
        const name = (err as { name?: string })?.name
        const message = (err as Error)?.message || ""
        const isTerminal =
            name === "NotAuthorizedException" ||
            message === "No token getter registered" ||
            message === "Not authenticated"
        if (isTerminal) {
            throw err
        }
        // Transient: one retry after 500 ms.
        await new Promise((resolve) => setTimeout(resolve, 500))
        return await getValidTokenAsync()
    }
}

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
            const fresh = await refreshTokenWithRetry()
            if (fresh) {
              return this.makeRequest<T>(endpoint, options, skipAuth, retries, true)
            }
          } catch {
            // Refresh definitely failed (after one retry) — fall through and
            // throw the typed ApiError below so the toast surfaces the
            // Cognito-session-expired UX.
            throw new ApiError({
              status: 401,
              message: "Your sign-in session has expired",
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
   *
   * Cross-window signalling (in order of preference):
   *   1. `postMessage` from the callback page (fastest, but blocked by some
   *      strict COOP / opener-isolation configurations).
   *   2. `BroadcastChannel` on `cleanflowai-oauth` — works even when the
   *      callback runs in a fully cross-origin-isolated context where
   *      `window.opener` is null.
   *   3. `localStorage` event on key `cleanflowai-oauth:{provider}` — last-
   *      resort fallback for environments where BroadcastChannel is also
   *      unavailable (older Safari + strict storage partitioning).
   *
   * The `authWindow.closed` poll is kept for the "user manually dismissed
   * the popup" path, but is wrapped in try/catch + a `safetyTimeout` of
   * 5 min so a COOP-blocked `closed` read can never resolve the promise
   * prematurely. If `closed` access throws, we treat that as "we can't
   * tell" — only the success/error signals (or the timeout) resolve.
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

        if (!authWindow) {
          resolve({
            success: false,
            error: "Popup blocked. Please enable popups for this site.",
          })
          return
        }

        let settled = false
        let channel: BroadcastChannel | null = null

        const cleanup = (result: { success: boolean; error?: string }) => {
          if (settled) return
          settled = true
          clearInterval(pollTimer)
          clearTimeout(safetyTimeout)
          window.removeEventListener("message", messageHandler)
          window.removeEventListener("storage", storageHandler)
          if (channel) {
            try { channel.close() } catch { /* noop */ }
          }
          try {
            // Best-effort cleanup of the localStorage fallback key.
            window.localStorage.removeItem(storageKey)
          } catch { /* noop */ }
          resolve(result)
        }

        const handleSignal = (data: { type?: string; error?: string }) => {
          if (!data || typeof data.type !== "string") return
          if (data.type === `${provider}-auth-success`) {
            cleanup({ success: true })
          } else if (data.type === `${provider}-auth-error`) {
            cleanup({
              success: false,
              error: data.error || "Authorization failed",
            })
          }
        }

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          handleSignal(event.data || {})
        }

        const storageKey = `cleanflowai-oauth:${provider}`
        const storageHandler = (event: StorageEvent) => {
          if (event.key !== storageKey || !event.newValue) return
          try {
            handleSignal(JSON.parse(event.newValue))
          } catch {
            // Malformed signal — ignore.
          }
        }

        window.addEventListener("message", messageHandler)
        window.addEventListener("storage", storageHandler)

        // BroadcastChannel is the most reliable cross-window signal under
        // COOP. Wrapped in try/catch because some browsers (Safari pre-15.4)
        // and SSR contexts don't expose the constructor.
        try {
          if (typeof BroadcastChannel !== "undefined") {
            channel = new BroadcastChannel("cleanflowai-oauth")
            channel.onmessage = (event) => handleSignal(event?.data || {})
          }
        } catch {
          channel = null
        }

        // Safety net: never let a popup poll run forever. 5 min is more
        // than enough for any OAuth round-trip; if the user wandered off
        // we fail cleanly instead of leaking the listeners.
        const safetyTimeout = setTimeout(() => {
          cleanup({
            success: false,
            error: "Authorization timed out. Please try again.",
          })
        }, 5 * 60 * 1000)

        const pollTimer = setInterval(() => {
          try {
            // Under COOP, `authWindow.closed` may throw or always return
            // `false`. We must NOT treat "can't tell" as "popup closed" —
            // doing so cancels successful auth flows. Only resolve if the
            // read both succeeds AND reports closed.
            if (authWindow && authWindow.closed === true) {
              cleanup({ success: false, error: "Auth window closed" })
            }
          } catch {
            // COOP blocked the read — rely on postMessage / BroadcastChannel
            // / storage signals (or the safety timeout).
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
