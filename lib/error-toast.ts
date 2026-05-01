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

let reconnectHandler: ProviderHandler | null = null
let connectHandler: ProviderHandler | null = null
let signinHandler: SignoutHandler | null = null

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
            return {
                title: "Session expired",
                description: "Sign in again to continue.",
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
