/**
 * Tests for useAugmentationJob hook — submit, poll, terminal, AbortSignal.
 */
jest.mock('@/shared/config/aws-config', () => ({
    AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))
jest.mock('@/modules/files/api/file-upload-api', () => ({
    makeRequest: jest.fn(),
}))
jest.mock('@/modules/auth', () => ({
    useAuth: () => ({ idToken: 'tok-123' }),
}))

import { act, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useEffect } from 'react'

import { useAugmentationJob } from '@/modules/augmentation/hooks/use-augmentation-job'
import type { SubmitJobBody } from '@/modules/augmentation/types'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

function renderHook<T>(useFn: () => T): { current: T } {
    const ref: { current: T } = { current: null as unknown as T }
    function Harness() {
        ref.current = useFn()
        return null
    }
    render(<Harness />)
    return ref
}

const BODY: SubmitJobBody = {
    prompt_template_id: 't1',
    input_dataset_key: 'in', output_dataset_key: 'out',
}

afterEach(() => mockMakeRequest.mockReset())

describe('useAugmentationJob', () => {
    it('submits and reaches SUCCEEDED', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j1', status: 'PENDING' }) // submit
            .mockResolvedValueOnce({ job_id: 'j1', status: 'SUCCEEDED', created_at: 'x' }) // first poll
        const ref = renderHook(() => useAugmentationJob())
        let final
        await act(async () => { final = await ref.current.submitAndWatch(BODY) })
        expect((final as any).status).toBe('SUCCEEDED')
        expect(ref.current.state.status).toBe('SUCCEEDED')
        expect(ref.current.state.progress).toBe(1)
    })

    it('captures RUNNING during polling before terminal', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j1', status: 'PENDING' })
            .mockResolvedValueOnce({ job_id: 'j1', status: 'RUNNING', created_at: 'x' })
            .mockResolvedValueOnce({ job_id: 'j1', status: 'SUCCEEDED', created_at: 'x' })
        const ref = renderHook(() => useAugmentationJob())
        await act(async () => {
            // jitter-free fast poll via short interval (default 1000) — we use
            // jest fake timers would be heavier; assert sequence via direct call.
            const p = ref.current.submitAndWatch(BODY)
            await new Promise((r) => setTimeout(r, 5))
            await p
        })
        // 3 calls = submit + 2 polls
        expect(mockMakeRequest).toHaveBeenCalledTimes(3)
        expect(ref.current.state.status).toBe('SUCCEEDED')
    })

    it('exposes FAILED + error_message on terminal failure', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j1', status: 'PENDING' })
            .mockResolvedValueOnce({ job_id: 'j1', status: 'FAILED', created_at: 'x', error_message: 'boom' })
        const ref = renderHook(() => useAugmentationJob())
        await act(async () => {
            try { await ref.current.submitAndWatch(BODY) } catch { /* ok */ }
        })
        expect(ref.current.state.status).toBe('FAILED')
        expect(ref.current.state.error).toBe('boom')
    })

    it('cancel() aborts polling without crashing', async () => {
        mockMakeRequest
            .mockResolvedValueOnce({ job_id: 'j1', status: 'PENDING' })
            .mockImplementation(() => new Promise((resolve) => setTimeout(() =>
                resolve({ job_id: 'j1', status: 'RUNNING', created_at: 'x' }), 50)))
        const ref = renderHook(() => useAugmentationJob())
        let caught: unknown
        await act(async () => {
            const p = ref.current.submitAndWatch(BODY).catch((e) => { caught = e })
            await new Promise((r) => setTimeout(r, 10))
            ref.current.cancel()
            await p
        })
        expect((caught as { name?: string })?.name).toBe('AbortError')
        expect(ref.current.state.isPolling).toBe(false)
    })
})
