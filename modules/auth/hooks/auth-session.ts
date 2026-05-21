/**
 * auth-session.ts
 *
 * Central auth-session utility module:
 * - Token storage helpers (loadStoredTokens / saveStoredTokens / clearStoredTokens)
 * - JWT parse & user mapping
 * - CC6 hardened session mechanics (cases 1-9):
 *   1. Near-expiry proactive refresh (<60s)
 *   2. 401 → refresh → retry in authenticatedFetch
 *   3. AuthRefreshExpiredError → onLogout + redirect /auth/login?reason=session_expired
 *   4. AuthChallengeError surface via onChallengeError callback
 *   5. Idle timeout: onWarn at 25 min, onLogout at 30 min
 *   6. BroadcastChannel multi-tab logout sync
 *   7. isLoginInFlight / setLoginInFlight double-click guard
 *   8. clearStoredTokens clears localStorage AND sessionStorage
 *   9. 401 mid-quarantine → same authenticatedFetch refresh+retry
 *
 * CRITICAL: Authorization header ALWAYS uses accessToken (not idToken).
 * Per CLAUDE.md Z2 bugfix — accessToken is for API Gateway.
 */

import { toast } from "sonner"

import type { User } from "@/modules/auth/types/auth.types"
import { cognitoApi } from "@/modules/auth/api/cognito-client"

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "authTokens"
const IDLE_WARN_MS = 25 * 60 * 1000   // 25 min → show warning
const IDLE_LOGOUT_MS = 30 * 60 * 1000  // 30 min → auto-logout
const NEAR_EXPIRY_THRESHOLD_S = 60     // seconds before expiry to proactively refresh
const LOGOUT_CHANNEL_NAME = "cleanflowai_auth_logout"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredTokens {
  idToken: string
  accessToken: string
  refreshToken: string | null
}

export interface TokenRefreshResult {
  idToken: string
  accessToken: string
  refreshToken: string | null
}

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

export const parseJWT = (token: string) => {
  try {
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error("Error parsing JWT:", error)
    return null
  }
}

export const buildUserFromPayload = (payload: any): User => {
  // Cognito always issues an ``email`` claim, but a malformed token (or a
  // future federated identity) may not. Fall back through username → ""
  // so the UI never crashes on ``payload.email.split`` when email is missing.
  const email: string = payload?.email || ""
  const username: string = payload?.["cognito:username"] || ""
  const fallbackName = email ? email.split("@")[0] : (username || "user")
  return {
    email,
    sub: payload?.sub || "",
    username,
    name: payload?.name || fallbackName,
  }
}

// ─── Token Storage ────────────────────────────────────────────────────────────

export const loadStoredTokens = (): StoredTokens | null => {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed.idToken || !parsed.accessToken) return null
    return {
      idToken: parsed.idToken,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken || null,
    }
  } catch {
    return null
  }
}

export const saveStoredTokens = (tokens: StoredTokens) => {
  if (typeof window === "undefined") return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  )
}

/** Case 8: Full cleanup — clears localStorage AND sessionStorage auth keys. */
export const clearStoredTokens = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
  // Belt-and-braces: clear any sessionStorage auth keys
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem("authUser")
}

// ─── Near-expiry Detection (case 1) ──────────────────────────────────────────

/**
 * Returns seconds until expiry for an access token.
 * Returns 0 if token is already expired or unparseable.
 */
export function accessTokenSecondsUntilExpiry(accessToken: string): number {
  const payload = parseJWT(accessToken)
  if (!payload || typeof payload.exp !== "number") return 0
  const remaining = payload.exp - Math.floor(Date.now() / 1000)
  return Math.max(0, remaining)
}

/**
 * Returns true if access token is expired or will expire within threshold.
 * Case 1: threshold = NEAR_EXPIRY_THRESHOLD_S (60s) for proactive refresh.
 */
export function isAccessTokenNearExpiry(
  accessToken: string,
  thresholdSeconds = NEAR_EXPIRY_THRESHOLD_S
): boolean {
  return accessTokenSecondsUntilExpiry(accessToken) <= thresholdSeconds
}

// ─── Error Classes ────────────────────────────────────────────────────────────

/** Thrown when the Cognito refresh token itself has expired (case 3). */
export class AuthRefreshExpiredError extends Error {
  constructor() {
    super("Session expired, sign in again")
    this.name = "AuthRefreshExpiredError"
  }
}

/** Thrown when Cognito returns a challenge during token refresh (case 4). */
export class AuthChallengeError extends Error {
  public challengeName: string
  constructor(challengeName: string) {
    super(`Re-authentication needed: ${challengeName}`)
    this.name = "AuthChallengeError"
    this.challengeName = challengeName
  }
}

// ─── Token Refresh (cases 3 & 4) ─────────────────────────────────────────────

/**
 * Calls Cognito REFRESH_TOKEN_AUTH and returns new tokens.
 * Throws AuthRefreshExpiredError if refresh token itself is expired (case 3).
 * Throws AuthChallengeError if Cognito returns a mid-session challenge (case 4).
 */
export async function refreshTokens(
  refreshToken: string
): Promise<TokenRefreshResult> {
  if (!refreshToken) {
    throw new AuthRefreshExpiredError()
  }
  try {
    const result = await cognitoApi.refreshSession(refreshToken)

    // Case 4: server returned a new challenge mid-session
    if (result.ChallengeName) {
      throw new AuthChallengeError(result.ChallengeName)
    }

    if (!result.AuthenticationResult) {
      throw new AuthRefreshExpiredError()
    }

    return {
      idToken: result.AuthenticationResult.IdToken!,
      accessToken: result.AuthenticationResult.AccessToken!,
      // Cognito does NOT return a new refresh token on REFRESH_TOKEN_AUTH; keep existing
      refreshToken,
    }
  } catch (err: any) {
    if (
      err instanceof AuthRefreshExpiredError ||
      err instanceof AuthChallengeError
    ) {
      throw err
    }
    // NotAuthorizedException or TokenExpiredException → refresh token expired
    if (
      err?.name === "NotAuthorizedException" ||
      err?.name === "TokenExpiredException" ||
      err?.message?.includes("Refresh Token has expired")
    ) {
      throw new AuthRefreshExpiredError()
    }
    throw err
  }
}

// ─── Multi-tab Logout Sync (case 6) ──────────────────────────────────────────

let _logoutChannel: BroadcastChannel | null = null

export function getLogoutChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null
  if (!_logoutChannel) {
    _logoutChannel = new BroadcastChannel(LOGOUT_CHANNEL_NAME)
  }
  return _logoutChannel
}

/**
 * Broadcast a logout event to all other tabs (case 6).
 * Call this AFTER clearing local tokens.
 */
export function broadcastLogout(): void {
  const channel = getLogoutChannel()
  if (channel) {
    channel.postMessage({ type: "LOGOUT" })
  }
}

/**
 * Subscribe to cross-tab logout events.
 * @returns cleanup function
 */
export function subscribeToLogoutBroadcast(onLogout: () => void): () => void {
  const channel = getLogoutChannel()
  if (!channel) return () => {}
  const handler = (evt: MessageEvent) => {
    if (evt.data?.type === "LOGOUT") {
      onLogout()
    }
  }
  channel.addEventListener("message", handler)
  return () => channel.removeEventListener("message", handler)
}

// ─── Login in-flight lock (case 7) ───────────────────────────────────────────

let _loginInFlight = false

export function isLoginInFlight(): boolean {
  return _loginInFlight
}

export function setLoginInFlight(value: boolean): void {
  _loginInFlight = value
}

// ─── Idle Timeout (case 5) ───────────────────────────────────────────────────

export interface IdleTimerHandle {
  reset: () => void
  destroy: () => void
}

/**
 * Sets up an idle-timeout watcher.
 * @param onWarn  called at 25 min with seconds remaining until auto-logout
 * @param onLogout called at 30 min if user hasn't responded
 */
export function startIdleTimer(
  onWarn: (secondsRemaining: number) => void,
  onLogout: () => void
): IdleTimerHandle {
  let warnTimer: ReturnType<typeof setTimeout> | null = null
  let logoutTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (warnTimer) clearTimeout(warnTimer)
    if (logoutTimer) clearTimeout(logoutTimer)
    warnTimer = null
    logoutTimer = null
  }

  const schedule = () => {
    clearTimers()
    warnTimer = setTimeout(() => {
      const remaining = Math.round((IDLE_LOGOUT_MS - IDLE_WARN_MS) / 1000)
      onWarn(remaining)
    }, IDLE_WARN_MS)

    logoutTimer = setTimeout(() => {
      onLogout()
    }, IDLE_LOGOUT_MS)
  }

  const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"]

  if (typeof window !== "undefined") {
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, schedule, { passive: true }))
    schedule() // arm immediately
  }

  return {
    reset: schedule,
    destroy: () => {
      clearTimers()
      if (typeof window !== "undefined") {
        ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, schedule))
      }
    },
  }
}

// ─── Session-expired user notification ───────────────────────────────────────

// Throttle the toast: if several in-flight requests all 401 at the same
// moment, we don't want to stack N copies of the same message. A 5-second
// window is plenty — the redirect to /auth/login fires immediately after,
// so the next legitimate session-expiry toast will be on a fresh page load.
let _lastExpiredToastAt = 0

/**
 * Show a single "Your session has expired" toast before the redirect to
 * /auth/login. Wave-3B regression: users were silently bounced to the
 * login screen with no explanation. Called from every onLogout path in
 * this module (proactive near-expiry refresh failure + 401-retry refresh
 * failure + still-401-after-retry).
 *
 * Safe to call from any browser context; no-ops on the server and when
 * called more than once within 5 seconds.
 */
function notifySessionExpired(): void {
  if (typeof window === "undefined") return
  const now = Date.now()
  if (now - _lastExpiredToastAt < 5_000) return
  _lastExpiredToastAt = now
  try {
    toast.error("Your session has expired. Please sign in again.")
  } catch {
    // sonner not mounted yet — silently ignore; the redirect still happens.
  }
}

// ─── Authenticated fetch wrapper (cases 1, 2, 9) ─────────────────────────────

type LogoutFn = () => void
type OnChallengeErrorFn = (challengeName: string) => void

/**
 * Authenticated fetch that:
 * 1. Proactively refreshes if access token expires in <60s (case 1)
 * 2. Retries once on 401 after refreshing (cases 2 & 9)
 * 3. Logs out and redirects on refresh-token-expired (case 3)
 * 4. Surfaces challenge errors (case 4) via onChallengeError
 *
 * ALWAYS sends `Authorization: Bearer <accessToken>` (not the id token).
 */
export async function authenticatedFetch(
  input: RequestInfo,
  init: RequestInit = {},
  options: {
    onLogout: LogoutFn
    onChallengeError?: OnChallengeErrorFn
  }
): Promise<Response> {
  const { onLogout, onChallengeError } = options

  const doRefreshAndSave = async (): Promise<string> => {
    const tokens = loadStoredTokens()
    if (!tokens?.refreshToken) throw new AuthRefreshExpiredError()
    const refreshed = await refreshTokens(tokens.refreshToken)
    saveStoredTokens({
      idToken: refreshed.idToken,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    })
    return refreshed.accessToken
  }

  const buildHeaders = (accessToken: string): HeadersInit => ({
    ...(init.headers ?? {}),
    Authorization: `Bearer ${accessToken}`,
  })

  const performRequest = async (accessToken: string): Promise<Response> =>
    fetch(input, { ...init, headers: buildHeaders(accessToken) })

  let tokens = loadStoredTokens()
  let accessToken = tokens?.accessToken ?? ""

  // Case 1: proactive refresh if near expiry
  if (accessToken && isAccessTokenNearExpiry(accessToken)) {
    try {
      accessToken = await doRefreshAndSave()
    } catch (err) {
      if (err instanceof AuthRefreshExpiredError) {
        notifySessionExpired()
        onLogout()
        throw err
      }
      if (err instanceof AuthChallengeError) {
        onChallengeError?.(err.challengeName)
        throw err
      }
      throw err
    }
  }

  // First attempt
  let response = await performRequest(accessToken)

  // Cases 2 & 9: retry on 401
  if (response.status === 401) {
    try {
      accessToken = await doRefreshAndSave()
      response = await performRequest(accessToken)
    } catch (err) {
      if (err instanceof AuthRefreshExpiredError) {
        notifySessionExpired()
        onLogout()
        throw err
      }
      if (err instanceof AuthChallengeError) {
        onChallengeError?.(err.challengeName)
        throw err
      }
      throw err
    }

    // If still 401 after retry → log out
    if (response.status === 401) {
      notifySessionExpired()
      onLogout()
      throw new AuthRefreshExpiredError()
    }
  }

  return response
}

