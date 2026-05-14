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
}

function descToPayload(desc: ErrorToastDescriptor): ToastFromErrorPayload {
    if (desc.action) {
        return {
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
 * Usage inside any quarantine hook:
 *   catch (err) { toast(toastFromQuarantineError(err, { action: 'load rows', retryFn: () => fetchRows() })) }
 */
export function toastFromQuarantineError(
    err: unknown,
    ctx: QuarantineErrorContext,
): ToastFromErrorPayload {
    return descToPayload(mapQuarantineErrorToToast(err, ctx))
}
