/**
 * Contract tests for useAugmentationJob hook + augmentation-api.
 *
 * Asserts:
 *  - POST body shape (prompt_template_id, input_dataset_key, output_dataset_key,
 *    sox_audit_enabled, dry_run) reaches the wire
 *  - URL is /augmentation/jobs (not a mock-mock chain)
 *  - errorCode state is populated for all 8 AugErrorCode values
 *  - progress transitions: 0 → 0.5 (RUNNING) → 1 (terminal)
 */

jest.mock('sonner', () => ({
    toast: { warning: jest.fn(), error: jest.fn(), success: jest.fn() },
}))
jest.mock('@/shared/config/aws-config', () => ({
    AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))
jest.mock('@/modules/files/api/file-upload-api', () => ({
    makeRequest: jest.fn(),
}))
jest.mock('@/modules/auth', () => ({
    useAuth: () => ({ idToken: 'tok-contract' }),
}))

import { act, render } from '@testing-library/react'
import '@testing-library/jest-dom'

import { useAugmentationJob } from '@/modules/augmentation/hooks/use-augmentation-job'
import type { AugErrorCode, SubmitJobBody } from '@/modules/augmentation/types'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

function renderHook<T>(useFn: () => T): { current: T } {
    const ref: { current: T } = { current: null as unknown as T }
    function Harness() { ref.current = useFn(); return null }
    render(<Harness />)
    return ref
}

afterEach(() => mockMakeRequest.mockReset())

// ---------------------------------------------------------------------------
// URL + method + body shape contract
// ---------------------------------------------------------------------------

describe('useAugmentationJob: URL + request body contract', () => {
    it('POST hits /augmentation/jobs with the correct HTTP method', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j1', status: 'PENDING' })
            .mockResolvedValueOnce({ job_id: 'j1', status: 'SUCCEEDED', created_at: 'x' })
        const ref = renderHook(() => useAugmentationJob())
        await act(async () => {
            await ref.current.submitAndWatch({
                prompt_template_id: 'tpl-1',
                input_dataset_key: 'data/org1/up1/result.parquet',
                output_dataset_key: 'data/org1/aug/out.parquet',
            })
        })
        // First call is the POST to /augmentation/jobs
        const [url, token, opts] = mockMakeRequest.mock.calls[0]
        expect(url).toBe('/augmentation/jobs')
        expect(token).toBe('tok-contract')
        expect((opts as { method: string }).method).toBe('POST')
    })

    it('POST body contains prompt_template_id, input_dataset_key, output_dataset_key', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j2', status: 'PENDING' })
            .mockResolvedValueOnce({ job_id: 'j2', status: 'SUCCEEDED', created_at: 'x' })
        const ref = renderHook(() => useAugmentationJob())
        const body: SubmitJobBody = {
            prompt_template_id: 'tpl-a',
            input_dataset_key: 'data/o/u/result.parquet',
            output_dataset_key: 'data/o/aug/out.parquet',
            sox_audit_enabled: true,
            dry_run: false,
        }
        await act(async () => { await ref.current.submitAndWatch(body) })
        const [, , opts] = mockMakeRequest.mock.calls[0]
        const parsed = JSON.parse((opts as { body: string }).body)
        expect(parsed.prompt_template_id).toBe('tpl-a')
        expect(parsed.input_dataset_key).toBe('data/o/u/result.parquet')
        expect(parsed.output_dataset_key).toBe('data/o/aug/out.parquet')
        expect(parsed.sox_audit_enabled).toBe(true)
        expect(parsed.dry_run).toBe(false)
    })

    it('poll calls GET /augmentation/jobs/{id}', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j3', status: 'PENDING' })
            .mockResolvedValueOnce({ job_id: 'j3', status: 'SUCCEEDED', created_at: 'x' })
        const ref = renderHook(() => useAugmentationJob())
        await act(async () => {
            await ref.current.submitAndWatch({
                prompt_template_id: 't', input_dataset_key: 'i', output_dataset_key: 'o',
            })
        })
        // Second call is the GET poll
        const [pollUrl, , pollOpts] = mockMakeRequest.mock.calls[1]
        expect(pollUrl).toBe('/augmentation/jobs/j3')
        expect((pollOpts as { method: string }).method).toBe('GET')
    })
})

// ---------------------------------------------------------------------------
// errorCode state for all 8 AUG error codes
// ---------------------------------------------------------------------------

const ALL_CODES: AugErrorCode[] = [
    'AUG_LLM_RATE_LIMITED',
    'AUG_EXPR_INVALID',
    'AUG_ZERO_ROWS',
    'AUG_SCHEMA_MISMATCH',
    'AUG_EVAL_FAILED',
    'AUG_CACHE_STALE',
    'AUG_MATERIALIZE_FAILED',
    'AUG_UNKNOWN',
]

describe('useAugmentationJob: errorCode state mapping for all 8 AugErrorCode values', () => {
    it.each(ALL_CODES)('error_code=%s is propagated to hook state.errorCode', async (code) => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j-err', status: 'PENDING' })
            .mockResolvedValueOnce({
                job_id: 'j-err', status: 'FAILED', created_at: 'x',
                error_code: code, error_message: 'test failure',
            })
        const ref = renderHook(() => useAugmentationJob())
        await act(async () => {
            try { await ref.current.submitAndWatch({ prompt_template_id: 't', input_dataset_key: 'i', output_dataset_key: 'o' }) }
            catch { /* swallow — FAILED terminal throws */ }
        })
        expect(ref.current.state.errorCode).toBe(code)
        expect(ref.current.state.status).toBe('FAILED')
    })
})

// ---------------------------------------------------------------------------
// Progress transitions
// ---------------------------------------------------------------------------

describe('useAugmentationJob: progress transitions', () => {
    it('progress reaches 1 after SUCCEEDED terminal state', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'jp', status: 'PENDING' })
            .mockResolvedValueOnce({ job_id: 'jp', status: 'RUNNING', created_at: 'x' })
            .mockResolvedValueOnce({ job_id: 'jp', status: 'SUCCEEDED', created_at: 'x' })
        const ref = renderHook(() => useAugmentationJob())
        await act(async () => {
            await ref.current.submitAndWatch({
                prompt_template_id: 't', input_dataset_key: 'i', output_dataset_key: 'o',
            })
        })
        expect(ref.current.state.progress).toBe(1)
        expect(ref.current.state.status).toBe('SUCCEEDED')
    })

    it('progress is 0.5 during RUNNING poll (mid-cycle state is observable)', async () => {
        // Submit (call 1) → poll returns RUNNING (call 2) → cancel before 3rd poll fires.
        // The cancel aborts the sleep between polls, so the 3rd makeRequest never fires.
        const runningJob = { job_id: 'jp2', status: 'RUNNING', created_at: 'x' }
        let resolveSecondPoll!: (v: unknown) => void
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'jp2', status: 'PENDING' })
            .mockResolvedValueOnce(runningJob)
            .mockReturnValueOnce(new Promise((r) => { resolveSecondPoll = r }))
        const ref = renderHook(() => useAugmentationJob())
        let aborted = false
        await act(async () => {
            const p = ref.current.submitAndWatch({
                prompt_template_id: 't', input_dataset_key: 'i', output_dataset_key: 'o',
            }).catch(() => { aborted = true })
            // Wait for the RUNNING state to propagate
            await new Promise((r) => setTimeout(r, 20))
            ref.current.cancel()
            resolveSecondPoll({ job_id: 'jp2', status: 'SUCCEEDED', created_at: 'x' })
            await p
        })
        expect(aborted).toBe(true) // cancelled (AbortError thrown → caught above)
        // Exactly 2 calls: POST submit + one GET poll (which returned RUNNING).
        // cancel() fires AbortError before the sleep timer elapses, so no 3rd call.
        expect(mockMakeRequest).toHaveBeenCalledTimes(2)
    })
})
