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
import { mapErrorToToast } from "@/lib/error-toast"
import type { ErrorToastDescriptor } from "@/lib/error-toast"

export interface ToastFromErrorPayload {
    title: string
    description: string
    variant: "default" | "destructive"
    action?: React.ReactElement<typeof ToastAction>
}

export function toastFromError(err: unknown): ToastFromErrorPayload {
    const desc: ErrorToastDescriptor = mapErrorToToast(err)
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
