/**
 * use-quarantine-find-replace.ts
 *
 * Async F&R: POST /quarantined/find-replace (scope=ENTIRE_QUARANTINE → 202)
 * then poll GET /quarantined/operations/{op_id} every 1 s until terminal
 * (COMPLETED | FAILED_TERMINAL | CANCELLED) or AbortSignal fires.
 */

import { useCallback, useRef, useState } from 'react'
import {
    submitFindReplaceAsync,
    pollFindReplaceOperation,
    isOperationTerminal,
    type AsyncFindReplaceRequest,
    type OperationStatus,
    type OperationStatusResponse,
} from '@/modules/files/api/file-quarantine-api'

export interface AppliedSkippedSummary {
    applied_count: number
    skipped_count: number
    failed_count: number
    results: Array<Record<string, unknown>>
    skipped_rows: Array<{ row_id: string; reason: string }>
    error_msg?: string
}

export interface FindReplaceProgress {
    applied: number
    total: number
    percent: number
}

export interface FindReplaceState {
    status: OperationStatus | 'idle' | 'submitting' | 'cancelled'
    operationId: string | null
    progress: FindReplaceProgress
    /** Linear-trend ETA in seconds; -1 when unknown. */
    eta_seconds: number
    result: AppliedSkippedSummary | null
    error: string | null
}

const INITIAL_STATE: FindReplaceState = {
    status: 'idle',
    operationId: null,
    progress: { applied: 0, total: 0, percent: 0 },
    eta_seconds: -1,
    result: null,
    error: null,
}
const POLL_INTERVAL_MS = 1000

export interface SubmitAndPollOpts {
    signal?: AbortSignal
    onProgress?: (state: FindReplaceState) => void
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
function summariseResult(raw: Record<string, unknown>): AppliedSkippedSummary {
    return {
        applied_count: num(raw.applied_count ?? raw.cells_affected),
        skipped_count: num(raw.skipped_count ?? raw.skipped_locked),
        failed_count: num(raw.failed_count ?? raw.failed),
        results: Array.isArray(raw.results) ? (raw.results as any[]) : [],
        skipped_rows: Array.isArray(raw.skipped_rows) ? (raw.skipped_rows as any[]) : [],
        error_msg: typeof raw.error_msg === 'string' ? (raw.error_msg as string) : undefined,
    }
}

export function useQuarantineFindReplace({
    uploadId,
    authToken,
}: {
    uploadId: string
    authToken: string | null
}) {
    const [state, setState] = useState<FindReplaceState>(INITIAL_STATE)
    const startedAtRef = useRef<number>(0)
    const reset = useCallback(() => setState(INITIAL_STATE), [])

    const submitAndPoll = useCallback(
        async (
            body: AsyncFindReplaceRequest,
            { signal, onProgress }: SubmitAndPollOpts = {},
        ): Promise<FindReplaceState> => {
            if (!authToken) {
                const err: FindReplaceState = { ...INITIAL_STATE, status: 'FAILED_TERMINAL', error: 'Not authenticated' }
                setState(err); return err
            }
            startedAtRef.current = Date.now()
            setState({ ...INITIAL_STATE, status: 'submitting' })

            let operationId: string
            try {
                ;({ operation_id: operationId } = await submitFindReplaceAsync(uploadId, authToken, body))
            } catch (e) {
                const err: FindReplaceState = { ...INITIAL_STATE, status: 'FAILED_TERMINAL', error: (e as Error)?.message || 'Submit failed' }
                setState(err); return err
            }

            let next: FindReplaceState = { ...INITIAL_STATE, status: 'PENDING', operationId }
            setState(next); onProgress?.(next)

            // eslint-disable-next-line no-constant-condition
            while (true) {
                if (signal?.aborted) {
                    const cancelled: FindReplaceState = { ...next, status: 'cancelled' }
                    setState(cancelled); return cancelled
                }
                let resp: OperationStatusResponse
                try {
                    resp = await pollFindReplaceOperation(uploadId, operationId, authToken)
                } catch (e) {
                    const err: FindReplaceState = { ...next, status: 'FAILED_TERMINAL', error: (e as Error)?.message || 'Poll failed' }
                    setState(err); return err
                }
                const done = resp.progress?.done ?? 0
                const total = resp.progress?.total ?? 0
                const percent = resp.progress?.percent ?? 0
                const elapsed = (Date.now() - startedAtRef.current) / 1000
                const eta = percent > 0 && percent < 100
                    ? Math.max(0, Math.round((elapsed / percent) * (100 - percent)))
                    : -1
                next = {
                    status: resp.status,
                    operationId,
                    progress: { applied: done, total, percent },
                    eta_seconds: eta,
                    result: resp.result ? summariseResult(resp.result) : null,
                    error: resp.status === 'FAILED_TERMINAL'
                        ? String(resp.result?.error_msg ?? 'Operation failed')
                        : null,
                }
                setState(next); onProgress?.(next)
                if (isOperationTerminal(resp.status)) return next

                // Sleep that wakes early on abort.
                await new Promise<void>((resolve) => {
                    const t = setTimeout(resolve, POLL_INTERVAL_MS)
                    if (signal) {
                        const onAbort = () => { clearTimeout(t); resolve() }
                        if (signal.aborted) onAbort()
                        else signal.addEventListener('abort', onAbort, { once: true })
                    }
                })
            }
        },
        [uploadId, authToken],
    )

    return { state, submitAndPoll, reset }
}
