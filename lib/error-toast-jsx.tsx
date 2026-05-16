"use client"

/**
 * JSX adapter for `mapErrorToToast`.
 *
 * The pure mapper in `lib/error-toast.ts` returns an `ErrorToastDescriptor`
 * with `action: { label, onClick }`. Our shadcn/ui toast component expects
 * `action` to be a `ToastActionElement` (a React element built with
 * `<ToastAction>`).
 *
 * `toastFromError(err)` returns a payload that can be passed straight into
 * `toast(...)` — including a real `<ToastAction>` when the typed error has
 * an action.
 */

import * as React from "react"

import { ToastAction } from "@/components/ui/toast"
import { mapErrorToToast, mapQuarantineErrorToToast } from "@/lib/error-toast"
import type { ErrorToastDescriptor, QuarantineErrorContext } from "@/lib/error-toast"

export interface ToastFromErrorPayload {
    title: string
    description: string
    variant: "default" | "destructive"
    action?: React.ReactElement<typeof ToastAction>
    /** Stable dedup ID — if provided and a toast with this ID is already shown,
     *  it updates in-place instead of stacking. Use format `quarantine-<code>-<action>`. */
    id?: string
}

function descToPayload(desc: ErrorToastDescriptor, id?: string): ToastFromErrorPayload {
    const base = id ? { id } : {}
    if (desc.action) {
        return {
            ...base,
            title: desc.title,
            description: desc.description,
            variant: desc.variant,
            action: (
                <ToastAction altText={desc.action.label} onClick={desc.action.onClick}>
                    {desc.action.label}
                </ToastAction>
            ),
        }
    }
    return {
        ...base,
        title: desc.title,
        description: desc.description,
        variant: desc.variant,
    }
}

export function toastFromError(err: unknown): ToastFromErrorPayload {
    return descToPayload(mapErrorToToast(err))
}

/**
 * Quarantine-aware variant of `toastFromError`.
 * Maps the 7 quarantine error classes (401/403/409-stale/409-other/500/timeout/network)
 * to the agreed toast-matrix with correct action buttons.
 *
 * Always sets a stable dedup `id` so burst errors (e.g. 3× 401 in 5 s) collapse
 * to a single toast rather than stacking. ID format: `quarantine-<code>-<action>`.
 *
 * Usage inside any quarantine hook:
 *   catch (err) { toast(toastFromQuarantineError(err, { action: 'load rows', retryFn: () => fetchRows() })) }
 */
export function toastFromQuarantineError(
    err: unknown,
    ctx: QuarantineErrorContext,
): ToastFromErrorPayload {
    const code = deriveErrorCode(err)
    const id = `quarantine-${code}-${ctx.action.replace(/\s+/g, '-')}`
    return descToPayload(mapQuarantineErrorToToast(err, ctx), id)
}

/** Derive a stable short code from the error for use in dedup IDs. */
function deriveErrorCode(err: unknown): string {
    // Import lazily to avoid circular — ApiError is already imported via error-toast.ts
    if (err && typeof err === "object") {
        const status = (err as { status?: number }).status
        if (status === 401) return "401"
        if (status === 403) return "403"
        if (status === 409) return "409"
        if (typeof status === "number" && status >= 500) return "5xx"
    }
    if (err instanceof Error) {
        if (err.name === "AbortError" || err.message.toLowerCase().includes("timeout")) return "timeout"
        if (err.name === "TypeError") return "network"
    }
    return "unknown"
}
