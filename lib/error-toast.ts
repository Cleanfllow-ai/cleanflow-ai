/**
 * Map any error (typed `ApiError` or plain `Error`) to a structured toast
 * payload with a title, description, variant, and an optional action button.
 *
 * Usage:
 *   import { mapErrorToToast } from "@/lib/error-toast"
 *   try { ... } catch (err) { toast(mapErrorToToast(err)) }
 *
 * The toast component supports an `action` slot of type `ToastActionElement`
 * (a React element). Hooks/components are responsible for rendering the
 * action — `ErrorToastDescriptor.action` is just `{ label, onClick }` so the
 * mapper stays UI-framework-agnostic and easily unit-testable.
 *
 * Provider navigation (Reconnect / Connect / Sign-in) is plugged in at app
 * boot via `setReconnectHandler` / `setConnectHandler` / `setSigninHandler`.
 */

import { ApiError } from "@/modules/shared/api-error"

// ─── Toast descriptor ─────────────────────────────────────────────────

export interface ErrorToastAction {
    label: string
    onClick: () => void
}

export interface ErrorToastDescriptor {
    title: string
    description: string
    variant: "default" | "destructive"
    action?: ErrorToastAction
}

// ─── Provider display names ───────────────────────────────────────────

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    googledrive: "Google Drive",
    onedrive: "OneDrive",
    dropbox: "Dropbox",
    quickbooks: "QuickBooks",
    zohobooks: "Zoho Books",
    snowflake: "Snowflake",
}

function providerLabel(provider: string | null | undefined): string {
    if (!provider) return "Connector"
    const known = PROVIDER_DISPLAY_NAMES[provider.toLowerCase()]
    if (known) return known
    return provider.charAt(0).toUpperCase() + provider.slice(1)
}

// ─── Pluggable navigation handlers ─────────────────────────────────────

type ProviderHandler = (provider: string | null) => void
type SignoutHandler = () => void
type SignOutBeforeRedirect = () => void | Promise<void>

let reconnectHandler: ProviderHandler | null = null
let connectHandler: ProviderHandler | null = null
let signinHandler: SignoutHandler | null = null
let signOutHandler: SignOutBeforeRedirect | null = null

/** Wire the "Reconnect" button. Called once at app boot from `AuthProvider`. */
export function setReconnectHandler(fn: ProviderHandler | null): void {
    reconnectHandler = fn
}

/** Wire the "Connect" button. Called once at app boot from `AuthProvider`. */
export function setConnectHandler(fn: ProviderHandler | null): void {
    connectHandler = fn
}

/** Wire the "Sign in" button. Called once at app boot from `AuthProvider`. */
export function setSigninHandler(fn: SignoutHandler | null): void {
    signinHandler = fn
}

/**
 * Wire the sign-out helper invoked BEFORE redirecting to /auth/login.
 * Without this, a stale (broken) JWT remains in localStorage, and a user
 * who hits "Back" after the redirect lands in the same broken state.
 *
 * The handler must clear all auth tokens + reset in-memory state. Called
 * once at app boot from `AuthProvider`.
 */
export function setSignOutHandler(fn: SignOutBeforeRedirect | null): void {
    signOutHandler = fn
}

function navigateToReconnect(provider: string | null): void {
    if (reconnectHandler) {
        reconnectHandler(provider)
        return
    }
    // Best-effort fallback for environments where the handler hasn't been
    // wired yet (SSR, tests, isolated stories).
    if (typeof window !== "undefined") {
        const qs = provider ? `?reconnect=${encodeURIComponent(provider)}` : ""
        window.location.href = `/connectors${qs}`
    }
}

function navigateToConnect(provider: string | null): void {
    if (connectHandler) {
        connectHandler(provider)
        return
    }
    if (typeof window !== "undefined") {
        const qs = provider ? `?connect=${encodeURIComponent(provider)}` : ""
        window.location.href = `/connectors${qs}`
    }
}

function goToLogin(): void {
    // CRITICAL: clear stale JWT + auth state BEFORE navigating, otherwise
    // a "Back" button press lands the user in the same broken-session loop.
    // Fire-and-forget — local store clearing is synchronous; don't block navigation.
    if (signOutHandler) {
        try {
            Promise.resolve(signOutHandler()).catch(() => {
                // Best-effort — local storage already cleared.
            })
        } catch {
            // Never let sign-out failure block the redirect.
        }
    }

    if (signinHandler) {
        signinHandler()
        return
    }
    if (typeof window !== "undefined") {
        window.location.href = "/auth/login"
    }
}

// ─── Mapper ────────────────────────────────────────────────────────────

export function mapErrorToToast(err: unknown): ErrorToastDescriptor {
    if (err instanceof ApiError) {
        const provider = providerLabel(err.provider)

        // Backend explicitly tells us what to do
        if (err.action === "reconnect") {
            return {
                title: `${provider} session expired`,
                description: err.message,
                variant: "destructive",
                action: {
                    label: "Reconnect",
                    onClick: () => navigateToReconnect(err.provider),
                },
            }
        }

        if (err.action === "connect") {
            return {
                title: `${provider} not connected`,
                description: err.message,
                variant: "destructive",
                action: {
                    label: "Connect",
                    onClick: () => navigateToConnect(err.provider),
                },
            }
        }

        if (err.action === "signin") {
            // Default copy makes it clear this is the *app* sign-in session,
            // NOT a connector OAuth session. Without this distinction, a
            // Cognito JWT refresh failure that bubbled up through (e.g.) the
            // GoogleDrive Import dialog reads as "the GoogleDrive connector
            // session expired" — which is misleading and sends users to the
            // wrong remediation flow.
            //
            // If the backend explicitly tags the 401 with a provider, surface
            // that in the title — useful for genuine provider-scoped 401s
            // that should still re-auth via Cognito (rare, but possible).
            const titleProvider = err.provider ? providerLabel(err.provider) : null
            return {
                title: titleProvider
                    ? `${titleProvider} requires sign-in`
                    : "Your sign-in session has expired",
                description: "Please sign in again to continue.",
                variant: "destructive",
                action: {
                    label: "Sign in",
                    onClick: () => goToLogin(),
                },
            }
        }

        if (err.action === "request_new_invite") {
            // Invite expired or token invalid — the invite link is dead.
            // Inviter must send a fresh invite; the invitee cannot self-recover.
            return {
                title: err.message || "This invite is no longer valid.",
                description: "Ask the sender to create a new invitation.",
                variant: "destructive",
            }
        }

        if (err.action === "cancel") {
            // Terminal state the user cannot recover from without admin help.
            return {
                title: err.message || "Action not allowed.",
                description: "This action cannot be completed without another admin.",
                variant: "destructive",
            }
        }

        if (err.action === "retry") {
            return {
                title: err.message,
                description: "Please try again.",
                variant: "destructive",
            }
        }

        // 422 with field-level errors
        if (err.status === 422 && err.fields) {
            const firstKey = Object.keys(err.fields)[0]
            const firstMsg = firstKey ? err.fields[firstKey] : err.message
            return {
                title: "Validation error",
                description: firstKey
                    ? `${firstKey}: ${firstMsg}`
                    : err.message,
                variant: "destructive",
            }
        }

        if (err.status >= 500) {
            return {
                title: "Server error",
                description:
                    "Please try again — if the problem persists, contact support.",
                variant: "destructive",
            }
        }

        // Generic typed API error — never surface raw code/message to the user;
        // keep technical detail in the console (callers must call console.error before toast).
        return {
            title: "Something went wrong.",
            description: "Please try again.",
            variant: "destructive",
        }
    }

    // Plain Error / unknown — preserve current behaviour
    if (err instanceof Error) {
        return {
            title: "Error",
            description: err.message || "Something went wrong.",
            variant: "destructive",
        }
    }

    return {
        title: "Error",
        description: "Something went wrong.",
        variant: "destructive",
    }
}

// ─── Quarantine-specific error handler ────────────────────────────────────────
//
// Maps the 7 quarantine error classes to the agreed toast-matrix:
//   401 → "Your session expired. Sign in again."  [Sign In]
//   403 → "You don't have permission for this action."  [Contact Support]
//   409 ETAG_STALE → "Someone else changed this row. Refresh to see latest."  [Refresh]
//   409 (other)  → "Conflict: {msg}."  [Retry]
//   500+         → "Server error. Please retry in a moment."  [Retry]
//   timeout      → "Request took too long. Retry?"  [Retry]
//   network fail → "Connection lost. Check your internet."  [Retry]
//
// `action` in the context of the quarantine matrix overrides `ApiError.action`;
// 401 always shows Sign In (the only safe path if the JWT is gone).

export interface QuarantineErrorContext {
    /** Human-readable label for which operation failed (e.g. "load rows"). */
    action: string
    /** Called when the user clicks "Retry" — omit for non-retryable operations. */
    retryFn?: () => void
    /** Called when the user clicks "Refresh page". Defaults to `window.location.reload`. */
    refreshFn?: () => void
}

function isNetworkError(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    const msg = err.message.toLowerCase()
    return (
        err.name === "TypeError" && (
            msg.includes("failed to fetch") ||
            msg.includes("network request failed") ||
            msg.includes("networkerror") ||
            msg.includes("load failed") ||
            msg.includes("connection refused")
        )
    )
}

function isTimeoutError(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    const msg = err.message.toLowerCase()
    return (
        err.name === "AbortError" ||
        msg.includes("timeout") ||
        msg.includes("timed out") ||
        msg.includes("aborted")
    )
}

function isStaleEtagError(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false
    if (err.status !== 409) return false
    const msg = err.message.toLowerCase()
    const code = (err.code || "").toLowerCase()
    return (
        code === "etag_stale" ||
        code === "stale_etag" ||
        code === "conflict_stale" ||
        msg.includes("stale etag") ||
        msg.includes("etag") ||
        msg.includes("optimistic lock") ||
        msg.includes("modified since")
    )
}

export function mapQuarantineErrorToToast(
    err: unknown,
    ctx: QuarantineErrorContext,
): ErrorToastDescriptor {
    // Network failure (no HTTP response)
    if (isNetworkError(err)) {
        return {
            title: "Connection lost. Check your internet.",
            description: ctx.action
                ? `Failed to ${ctx.action}. Reconnect and try again.`
                : "Reconnect and try again.",
            variant: "destructive",
            action: ctx.retryFn
                ? { label: "Retry", onClick: ctx.retryFn }
                : undefined,
        }
    }

    // Timeout / AbortError
    if (isTimeoutError(err)) {
        return {
            title: "Request took too long. Retry?",
            description: ctx.action
                ? `The request to ${ctx.action} timed out.`
                : "The request timed out.",
            variant: "default",
            action: ctx.retryFn
                ? { label: "Retry", onClick: ctx.retryFn }
                : undefined,
        }
    }

    if (err instanceof ApiError) {
        // 401 — always sign-in regardless of what the backend says
        if (err.status === 401) {
            return {
                title: "Your session expired. Sign in again.",
                description: "Please sign in to continue editing.",
                variant: "destructive",
                action: {
                    label: "Sign In",
                    onClick: () => goToLogin(),
                },
            }
        }

        // 403 — forbidden
        if (err.status === 403) {
            return {
                title: "You don't have permission for this action.",
                description: err.message || `You lack permission to ${ctx.action}.`,
                variant: "destructive",
                action: {
                    label: "Contact Support",
                    onClick: () => {
                        if (typeof window !== "undefined") {
                            window.open("mailto:support@infiniqon.com?subject=Permission%20issue", "_blank")
                        }
                    },
                },
            }
        }

        // 409 ETAG_STALE — someone else edited this row
        if (isStaleEtagError(err)) {
            const refresh = ctx.refreshFn ?? (() => { if (typeof window !== "undefined") window.location.reload() })
            return {
                title: "Someone else changed this row. Refresh to see latest.",
                description: "Your edit was not saved to avoid overwriting a newer version.",
                variant: "default",
                action: {
                    label: "Refresh",
                    onClick: refresh,
                },
            }
        }

        // 409 other conflict
        if (err.status === 409) {
            return {
                title: `Conflict: ${err.message}.`,
                description: "Your change could not be applied because of a conflict.",
                variant: "default",
                action: ctx.retryFn
                    ? { label: "Retry", onClick: ctx.retryFn }
                    : undefined,
            }
        }

        // 500+
        if (err.status >= 500) {
            return {
                title: "Server error. Please retry in a moment.",
                description: "If the problem persists, contact support.",
                variant: "destructive",
                action: ctx.retryFn
                    ? { label: "Retry", onClick: ctx.retryFn }
                    : undefined,
            }
        }
    }

    // Fall through to the generic mapper so existing connector/auth toasts still work
    return mapErrorToToast(err)
}
