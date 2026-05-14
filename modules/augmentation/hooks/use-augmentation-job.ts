"use client"

import { useCallback, useRef, useState } from "react"

import { useAuth } from "@/modules/auth"
import { submitJobAndPoll } from "@/modules/augmentation/api/augmentation-api"
import type { AugmentationJob, AugmentationJobStatus, SubmitJobBody } from "@/modules/augmentation/types"

export interface UseAugmentationJobState {
    status: AugmentationJobStatus | "IDLE"
    progress: number  // 0..1, coarse: 0 (submitted) / 0.5 (running) / 1 (terminal)
    result: AugmentationJob | null
    error: string | null
    isPolling: boolean
}

const INITIAL: UseAugmentationJobState = {
    status: "IDLE", progress: 0, result: null, error: null, isPolling: false,
}

/**
 * React hook: kick off an augmentation job and watch its lifecycle.
 * Returns `{state, submitAndWatch, cancel}` — `submitAndWatch` resolves with
 * the terminal job. `cancel()` aborts polling and leaves the job running
 * server-side (no DELETE call — backend lifecycle).
 */
export function useAugmentationJob() {
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
            setState({ ...INITIAL, error: err })
            throw new Error(err)
        }
        controllerRef.current?.abort()
        const controller = new AbortController()
        controllerRef.current = controller

        setState({ status: "PENDING", progress: 0, result: null, error: null, isPolling: true })
        try {
            const final = await submitJobAndPoll({
                body, authToken: idToken, signal: controller.signal,
                onUpdate: (job) => setState((s) => ({
                    ...s, status: job.status, result: job,
                    progress: job.status === "RUNNING" ? 0.5 : s.progress,
                })),
            })
            setState({
                status: final.status, progress: 1, result: final, isPolling: false,
                error: final.status === "FAILED" ? (final.error_message || "Job failed") : null,
            })
            return final
        } catch (err) {
            const isAbort = (err as { name?: string })?.name === "AbortError"
            setState((s) => ({ ...s, isPolling: false, error: isAbort ? null : (err as Error).message }))
            throw err
        } finally {
            if (controllerRef.current === controller) controllerRef.current = null
        }
    }, [idToken])

    return { state, submitAndWatch, cancel }
}
