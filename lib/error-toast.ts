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
    // We invoke the sign-out helper synchronously and don't await — the
    // navigation should not be blocked on token revocation, and the local
    // store clearing happens synchronously inside the helper anyway.
    if (signOutHandler) {
        try {
            const maybePromise = signOutHandler()
            // If the handler returns a Promise (network revoke etc.), don't
            // block navigation on it — we've already cleared local tokens.
            if (maybePromise && typeof (maybePromise as Promise<void>).catch === "function") {
                ;(maybePromise as Promise<void>).catch(() => {
                    // Best-effort sign-out — local storage already cleared.
                })
            }
        } catch {
            // Best-effort — never let sign-out failure block the redirect.
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

        // Generic typed API error
        return {
            title: err.message,
            description:
                err.code && err.code !== err.message
                    ? `Error code: ${err.code}`
                    : "Please try again.",
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
