import { AWS_CONFIG } from "@/shared/config/aws-config"

const API_BASE_URL = AWS_CONFIG.API_BASE_URL || ""

/**
 * Shared base for all connector API modules.
 * Provides auth-token retrieval, timeout, and retry logic.
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
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`,
        )
      }

      return await response.json()
    } catch (error) {
      if ((error as Error).name === "AbortError" && retries < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, (retries + 1) * 2000),
        )
        return this.makeRequest<T>(endpoint, options, skipAuth, retries + 1)
      }
      throw error
    }
  }

  protected getAuthToken(): string | null {
    if (typeof window === "undefined") return null
    try {
      const tokensStr = localStorage.getItem("authTokens")
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
