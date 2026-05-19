"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/modules/auth"
import { submitJobAndPoll } from "@/modules/augmentation/api/augmentation-api"
import type { AugErrorCode, AugmentationJob, AugmentationJobStatus, SubmitJobBody } from "@/modules/augmentation/types"

export interface UseAugmentationJobState {
    status: AugmentationJobStatus | "IDLE"
    progress: number  // 0..1, coarse: 0 (submitted) / 0.5 (running) / 1 (terminal)
    result: AugmentationJob | null
    error: string | null
    errorCode: AugErrorCode | null
    isPolling: boolean
}

const INITIAL: UseAugmentationJobState = {
    status: "IDLE", progress: 0, result: null, error: null, errorCode: null, isPolling: false,
}

/**
 * Map a structured AugErrorCode to a user-facing toast descriptor.
 * Returns `null` for AUG_CACHE_STALE (handled silently by the backend).
 */
export function augErrorToast(
    code: AugErrorCode,
    opts: { errorMessage?: string; onRetry?: () => void; onEditPrompt?: () => void } = {},
): void {
    switch (code) {
        case "AUG_LLM_RATE_LIMITED":
            toast.warning("AI service busy. Please wait a moment and retry.", {
                id: `aug-${code}`,
                description: "The AI service is handling too many requests right now.",
                action: opts.onRetry
                    ? { label: "Retry", onClick: opts.onRetry }
                    : undefined,
                duration: 10_000,
            })
            break

        case "AUG_EXPR_INVALID":
            toast.error("Generated expression invalid. Try rephrasing your prompt.", {
                id: `aug-${code}`,
                description: "Adjust your prompt and try again.",
                action: opts.onEditPrompt
                    ? { label: "Edit Prompt", onClick: opts.onEditPrompt }
                    : undefined,
                duration: 12_000,
            })
            break

        case "AUG_ZERO_ROWS": {
            // Use warning (not error) — the expression ran; data just matched nothing.
            toast.warning("No matching rows found. Check your filter or source data.", {
                id: `aug-${code}`,
                // No action button — user needs to adjust their data or prompt.
                duration: 10_000,
            })
            break
        }

        case "AUG_SCHEMA_MISMATCH":
            toast.error("Source file is missing required columns.", {
                id: `aug-${code}`,
                description: "Update your source file to include the expected columns and retry.",
                duration: 12_000,
            })
            break

        case "AUG_EVAL_FAILED":
            toast.error("Expression failed at runtime. Try a simpler prompt or smaller file.", {
                id: `aug-${code}`,
                action: {
                    label: "Contact Support",
                    onClick: () => window.open("mailto:support@infiniqon.com?subject=AUG_EVAL_FAILED", "_blank"),
                },
                duration: 15_000,
            })
            break

        case "AUG_CACHE_STALE":
            // Silent — backend already invalidated the cache and retried.
            break

        case "AUG_MATERIALIZE_FAILED":
            toast.error("Output generation failed — try a smaller batch or contact support.", {
                id: `aug-${code}`,
                action: {
                    label: "Contact Support",
                    onClick: () => window.open("mailto:support@infiniqon.com?subject=AUG_MATERIALIZE_FAILED", "_blank"),
                },
                duration: 15_000,
            })
            break

        default:
            toast.error("Augmentation job failed. Please try again.", {
                id: `aug-${code}`,
                duration: 10_000,
            })
            break
    }
}

/**
 * React hook: kick off an augmentation job and watch its lifecycle.
 * Returns `{state, submitAndWatch, cancel}` — `submitAndWatch` resolves with
 * the terminal job. `cancel()` aborts polling and leaves the job running
 * server-side (no DELETE call — backend lifecycle).
 *
 * On FAILED the hook automatically fires a Sonner toast with the right
 * message and action button based on `job.error_code`.
 */
export function useAugmentationJob(opts: {
    onRetry?: () => void
    onEditPrompt?: () => void
} = {}) {
    const { idToken } = useAuth()
    const [state, setState] = useState<UseAugmentationJobState>(INITIAL)
    const controllerRef = useRef<AbortController | null>(null)

    const cancel = useCallback(() => {
        controllerRef.current?.abort()
        controllerRef.current = null
        setState((s) => ({ ...s, isPolling: false }))
    }, [])

    const submitAndWatch = useCallback(async (body: SubmitJobBody): Promise<AugmentationJob> => {
        if (!idToken) {
            const err = "Not authenticated"
            setState({ ...INITIAL, error: err, errorCode: null })
            throw new Error(err)
        }
        controllerRef.current?.abort()
        const controller = new AbortController()
        controllerRef.current = controller

        setState({ status: "PENDING", progress: 0, result: null, error: null, errorCode: null, isPolling: true })
        try {
            const final = await submitJobAndPoll({
                body, authToken: idToken, signal: controller.signal,
                onUpdate: (job) => setState((s) => ({
                    ...s, status: job.status, result: job,
                    progress: job.status === "RUNNING" ? 0.5 : s.progress,
                })),
            })

            if (final.status === "FAILED") {
                const code: AugErrorCode = final.error_code ?? "AUG_UNKNOWN"
                setState({
                    status: final.status, progress: 1, result: final, isPolling: false,
                    error: final.error_message || "Job failed",
                    errorCode: code,
                })
                // Fire the structured toast so any mounted consumer gets it,
                // regardless of whether the caller also shows inline error text.
                augErrorToast(code, {
                    errorMessage: final.error_message,
                    onRetry: opts.onRetry,
                    onEditPrompt: opts.onEditPrompt,
                })
            } else {
                setState({
                    status: final.status, progress: 1, result: final, isPolling: false,
                    error: null, errorCode: null,
                })
            }
            return final
        } catch (err) {
            const isAbort = (err as { name?: string })?.name === "AbortError"
            setState((s) => ({
                ...s, isPolling: false,
                error: isAbort ? null : (err as Error).message,
                errorCode: null,
            }))
            throw err
        } finally {
            if (controllerRef.current === controller) controllerRef.current = null
        }
    }, [idToken, opts.onRetry, opts.onEditPrompt])

    return { state, submitAndWatch, cancel }
}
