/**
 * Settings-surface error → toast descriptor mapper.
 *
 * Mirrors mapQuarantineErrorToToast in lib/error-toast.ts but is scoped to the
 * 6 DQ-preset failure modes:
 *
 *   SETTINGS_RULE_SPEC_INVALID   → "Rule definition is invalid. {reason}."     [Edit]
 *   SETTINGS_PRESET_NAME_TAKEN   → "Preset name already used. Pick another."   [Rename]
 *   SETTINGS_PRESET_STALE        → "Someone changed this preset. Refresh."     [Refresh]
 *   SETTINGS_COLUMN_NOT_FOUND    → "Rule references missing column: {col}."    [Edit]
 *   SETTINGS_PRESET_IN_USE       → "This preset is being used by a running DQ job. Try again in a moment." [Retry]
 *   SETTINGS_PERMISSION_DENIED   → "Only admins can delete presets."           [Contact Admin]
 *
 * Toast IDs follow the pattern `settings-<code>` for dedup so rapid
 * retries don't stack duplicate toasts.
 *
 * Usage:
 *   import { mapSettingsErrorToToast } from "@/modules/settings"
 *   const { title, description, variant, action, toastId } = mapSettingsErrorToToast(err, ctx)
 */

import { ApiError } from "@/modules/shared/api-error"
import { ErrorToastDescriptor } from "@/lib/error-toast"

// ─── Extended descriptor with stable dedup ID ──────────────────────────────

export interface SettingsToastDescriptor extends ErrorToastDescriptor {
    /** Stable ID for toast dedup — callers pass this to `toast({ id, ... })`. */
    toastId: string
}

// ─── Context ────────────────────────────────────────────────────────────────

export interface SettingsErrorContext {
    /** Called when user clicks "Edit" action button. */
    onEdit?: () => void
    /** Called when user clicks "Rename" action button. */
    onRename?: () => void
    /** Called when user clicks "Refresh" action button. Defaults to window.location.reload. */
    onRefresh?: () => void
    /** Called when user clicks "Retry" action button. */
    onRetry?: () => void
}

// ─── Error code constants ───────────────────────────────────────────────────

export const SETTINGS_ERROR_CODES = {
    RULE_SPEC_INVALID: "SETTINGS_RULE_SPEC_INVALID",
    PRESET_NAME_TAKEN: "SETTINGS_PRESET_NAME_TAKEN",
    PRESET_STALE: "SETTINGS_PRESET_STALE",
    COLUMN_NOT_FOUND: "SETTINGS_COLUMN_NOT_FOUND",
    PRESET_IN_USE: "SETTINGS_PRESET_IN_USE",
    PERMISSION_DENIED: "SETTINGS_PERMISSION_DENIED",
} as const

export type SettingsErrorCode = typeof SETTINGS_ERROR_CODES[keyof typeof SETTINGS_ERROR_CODES]

// ─── Mapper ─────────────────────────────────────────────────────────────────

function defaultRefresh(): void {
    if (typeof window !== "undefined") {
        window.location.reload()
    }
}

function contactAdmin(): void {
    if (typeof window !== "undefined") {
        window.open("mailto:support@cleanflow.ai?subject=Settings+permission+issue", "_blank")
    }
}

/**
 * Map an error thrown by a settings API call to a structured toast descriptor
 * with a stable dedup ID.
 *
 * Falls back to a generic 500 / unknown toast for non-settings errors so callers
 * can use a single catch block.
 */
export function mapSettingsErrorToToast(
    err: unknown,
    ctx: SettingsErrorContext = {},
): SettingsToastDescriptor {
    if (err instanceof ApiError) {
        const code = err.code as SettingsErrorCode | null

        // F1 — malformed rule_spec
        if (code === SETTINGS_ERROR_CODES.RULE_SPEC_INVALID) {
            // Extract a brief reason from the message (everything after the first sentence)
            const reason = err.message || "Check the rule definition."
            return {
                toastId: `settings-${SETTINGS_ERROR_CODES.RULE_SPEC_INVALID}`,
                title: "Rule definition is invalid.",
                description: reason,
                variant: "destructive",
                action: ctx.onEdit
                    ? { label: "Edit", onClick: ctx.onEdit }
                    : undefined,
            }
        }

        // F2 — preset name collision
        if (code === SETTINGS_ERROR_CODES.PRESET_NAME_TAKEN) {
            return {
                toastId: `settings-${SETTINGS_ERROR_CODES.PRESET_NAME_TAKEN}`,
                title: "Preset name already used. Pick another.",
                description: "Each preset in your org must have a unique name.",
                variant: "destructive",
                action: ctx.onRename
                    ? { label: "Rename", onClick: ctx.onRename }
                    : undefined,
            }
        }

        // F3 — concurrent save / stale etag
        if (code === SETTINGS_ERROR_CODES.PRESET_STALE) {
            const refresh = ctx.onRefresh ?? defaultRefresh
            return {
                toastId: `settings-${SETTINGS_ERROR_CODES.PRESET_STALE}`,
                title: "Someone changed this preset. Refresh.",
                description: "Your changes were not saved to avoid overwriting newer edits.",
                variant: "default",
                action: { label: "Refresh", onClick: refresh },
            }
        }

        // F4 — column not found
        if (code === SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND) {
            // Backend may include the column name in the message
            const colHint = err.message?.replace(/^Rule references missing column:\s*/i, "").trim()
            const description = colHint
                ? `Column not present in the current dataset: "${colHint}".`
                : "The column referenced by this rule is not in the current dataset."
            return {
                toastId: `settings-${SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND}`,
                title: `Rule references missing column: ${colHint || "unknown"}.`,
                description,
                variant: "destructive",
                action: ctx.onEdit
                    ? { label: "Edit", onClick: ctx.onEdit }
                    : undefined,
            }
        }

        // F5 — preset in use by running DQ job
        if (code === SETTINGS_ERROR_CODES.PRESET_IN_USE) {
            return {
                toastId: `settings-${SETTINGS_ERROR_CODES.PRESET_IN_USE}`,
                title: "This preset is being used by a running DQ job.",
                description: "Try again once the job has completed.",
                variant: "default",
                action: ctx.onRetry
                    ? { label: "Retry", onClick: ctx.onRetry }
                    : undefined,
            }
        }

        // F6 — permission denied (non-admin)
        if (code === SETTINGS_ERROR_CODES.PERMISSION_DENIED || err.status === 403) {
            return {
                toastId: `settings-${SETTINGS_ERROR_CODES.PERMISSION_DENIED}`,
                title: "Only admins can delete presets.",
                description: "Contact your organization admin to request access.",
                variant: "destructive",
                action: { label: "Contact Admin", onClick: contactAdmin },
            }
        }

        // 500+ server error
        if (err.status >= 500) {
            return {
                toastId: "settings-server-error",
                title: "Server error. Please try again.",
                description: "If the problem persists, contact support.",
                variant: "destructive",
                action: ctx.onRetry
                    ? { label: "Retry", onClick: ctx.onRetry }
                    : undefined,
            }
        }
    }

    // Generic fallback
    const message = err instanceof Error ? err.message : "Something went wrong."
    return {
        toastId: "settings-unknown-error",
        title: "Error",
        description: message,
        variant: "destructive",
    }
}
