/**
 * mapConnectorErrorToToast
 *
 * Translates a typed connector error (from the API error envelope) into a
 * human-readable toast message and a CTA action.  Called by connector UI
 * components to render actionable error toasts without duplicating the
 * branching logic in every component.
 *
 * Stable error codes (set by the backend in the ``code`` field):
 *   CONNECTOR_REAUTH_REQUIRED   — refresh token expired
 *   CONNECTOR_RATE_LIMITED      — provider 429
 *   CONNECTOR_SCHEMA_DRIFT      — entity field renamed/removed
 *   CONNECTOR_TIMEOUT           — network timeout to provider
 *   CONNECTOR_SERVER_ERROR      — provider 5xx
 *   CONNECTOR_ENV_MISMATCH      — sandbox vs production
 *
 * Legacy class-name codes (backwards compat):
 *   ConnectionExpiredError      — access token expired, refresh succeeded (silent)
 *   AuthenticationError         — auth revoked
 *   RateLimitError              — 429 (legacy, before typed codes)
 *   ProviderAPIError            — 502 (legacy)
 *
 * DOM element IDs follow the pattern: connector-<provider>-<code-slug>
 * so that automated tests can find them without relying on message text.
 */

import { isApiError } from "@/modules/shared/api-error"

export interface ConnectorToast {
    /** The message to display in the toast body */
    message: string
    /** CTA label for the action button (null = no button) */
    actionLabel: string | null
    /** Action discriminator for the calling component */
    action: "reconnect" | "retry" | "open_mapping" | null
    /** Stable DOM id for the toast element */
    toastId: string
    /** Toast severity level */
    severity: "error" | "warning" | "info"
    /** Countdown in seconds before auto-retry (for rate-limit toasts) */
    retryAfterSeconds: number | null
}

/**
 * Format a provider name for display: capitalise the first letter, expand
 * known short-codes to friendly names.
 */
function formatProvider(raw: string | null | undefined): string {
    if (!raw) return "Provider"
    const map: Record<string, string> = {
        quickbooks: "QuickBooks",
        zohobooks: "Zoho Books",
        snowflake: "Snowflake",
        googledrive: "Google Drive",
    }
    return map[raw.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
}

/**
 * Slugify an error code for stable DOM IDs.
 * e.g. "CONNECTOR_REAUTH_REQUIRED" → "connector-reauth-required"
 */
function codeToSlug(code: string | null | undefined): string {
    return (code ?? "unknown")
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/[^a-z0-9-]/g, "")
}

export function mapConnectorErrorToToast(
    err: unknown,
    /** Provider hint when the error object itself doesn't carry one */
    providerHint?: string,
): ConnectorToast {
    // ── Non-ApiError (network failure, parsing error, etc.) ──────────────────
    if (!isApiError(err)) {
        const msg = err instanceof Error ? err.message : "Unexpected error"
        // Detect AbortError (browser-side timeout) and map to TIMEOUT toast
        if (err instanceof Error && err.name === "AbortError") {
            const p = formatProvider(providerHint)
            return {
                message: `${p} took too long. Retry?`,
                actionLabel: "Retry",
                action: "retry",
                toastId: `connector-${(providerHint ?? "unknown").toLowerCase()}-connector-timeout`,
                severity: "warning",
                retryAfterSeconds: null,
            }
        }
        return {
            message: msg || "Something went wrong",
            actionLabel: null,
            action: null,
            toastId: "connector-unknown-error",
            severity: "error",
            retryAfterSeconds: null,
        }
    }

    const provider = err.provider ?? providerHint ?? null
    const p = formatProvider(provider)
    const providerSlug = (provider ?? "unknown").toLowerCase()
    const code = err.code

    // ── Mode 1: transparent access-token refresh (silent log, no toast) ──────
    // ConnectionExpiredError with action=reconnect but status=401 and the
    // token refresh succeeded → caller should not show a toast at all.
    // We surface a minimal info toast here; callers may choose to suppress it.
    if (err.status === 401 && code === "ConnectionExpiredError" && err.action === "reconnect") {
        return {
            message: `Reconnecting to ${p}…`,
            actionLabel: null,
            action: null,
            toastId: `connector-${providerSlug}-connection-expired-error`,
            severity: "info",
            retryAfterSeconds: null,
        }
    }

    // ── Mode 7 (checked early): CONNECTOR_ENV_MISMATCH ───────────────────────
    // Must be checked before the generic reconnect check (Mode 2) because
    // EnvMismatchError also carries action="reconnect".
    if (code === "CONNECTOR_ENV_MISMATCH") {
        const raw = err.raw as Record<string, string> | null
        const expected = raw?.expected ?? "expected"
        const actual = raw?.actual ?? "actual"
        return {
            message: `Connect a ${expected} account, not ${actual}.`,
            actionLabel: "Reconnect",
            action: "reconnect",
            toastId: `connector-${providerSlug}-connector-env-mismatch`,
            severity: "error",
            retryAfterSeconds: null,
        }
    }

    // ── Mode 2: CONNECTOR_REAUTH_REQUIRED — refresh token expired ────────────
    if (code === "CONNECTOR_REAUTH_REQUIRED" || err.action === "reconnect") {
        return {
            message: `Reconnect your ${p} account.`,
            actionLabel: "Reconnect",
            action: "reconnect",
            toastId: `connector-${providerSlug}-${codeToSlug(code)}`,
            severity: "error",
            retryAfterSeconds: null,
        }
    }

    // ── Mode 3: CONNECTOR_RATE_LIMITED — 429 ─────────────────────────────────
    if (code === "CONNECTOR_RATE_LIMITED" || code === "RateLimitError" || err.status === 429) {
        const retryAfter: number | null =
            (err.raw as Record<string, unknown> | null)?.retry_after_seconds as number ?? null
        const countdown = retryAfter ? ` Retrying in ${retryAfter}s.` : ""
        return {
            message: `${p} is busy.${countdown}`,
            actionLabel: "Retry",
            action: "retry",
            toastId: `connector-${providerSlug}-${codeToSlug(code ?? "connector-rate-limited")}`,
            severity: "warning",
            retryAfterSeconds: retryAfter,
        }
    }

    // ── Mode 4: CONNECTOR_SCHEMA_DRIFT ───────────────────────────────────────
    if (code === "CONNECTOR_SCHEMA_DRIFT") {
        return {
            message: `${p} changed their data format. Update your mapping.`,
            actionLabel: "Open Mapping",
            action: "open_mapping",
            toastId: `connector-${providerSlug}-connector-schema-drift`,
            severity: "error",
            retryAfterSeconds: null,
        }
    }

    // ── Mode 5: CONNECTOR_TIMEOUT ─────────────────────────────────────────────
    if (code === "CONNECTOR_TIMEOUT" || err.status === 504) {
        return {
            message: `${p} took too long. Retry?`,
            actionLabel: "Retry",
            action: "retry",
            toastId: `connector-${providerSlug}-connector-timeout`,
            severity: "warning",
            retryAfterSeconds: null,
        }
    }

    // ── Mode 6: CONNECTOR_SERVER_ERROR — 5xx ─────────────────────────────────
    if (code === "CONNECTOR_SERVER_ERROR" || code === "ProviderAPIError" || err.status === 502 || err.status === 503) {
        return {
            message: `${p} returned an error. Try again later.`,
            actionLabel: "Retry",
            action: "retry",
            toastId: `connector-${providerSlug}-${codeToSlug(code ?? "connector-server-error")}`,
            severity: "error",
            retryAfterSeconds: null,
        }
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return {
        message: err.message || `${p} returned an error.`,
        actionLabel: err.action === "retry" ? "Retry" : null,
        action: err.action === "retry" ? "retry" : null,
        toastId: `connector-${providerSlug}-${codeToSlug(code)}`,
        severity: "error",
        retryAfterSeconds: null,
    }
}
