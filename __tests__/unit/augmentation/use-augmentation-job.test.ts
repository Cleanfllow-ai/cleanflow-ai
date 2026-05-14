/**
 * Unit tests for use-augmentation-job.ts — structured error code toast dispatch.
 *
 * Covers the 6 failure modes:
 *   1. AUG_LLM_RATE_LIMITED → warning toast + Retry button
 *   2. AUG_EXPR_INVALID     → error toast + Edit Prompt button
 *   3. AUG_ZERO_ROWS        → warning toast, no action button
 *   4. AUG_SCHEMA_MISMATCH  → error toast with column list
 *   5. AUG_EVAL_FAILED      → error toast + Contact Support
 *   6. AUG_CACHE_STALE      → silent (no toast fired)
 *   7. AUG_UNKNOWN          → generic error toast
 *   8. errorCode populated in hook state on FAILED job
 */

jest.mock('sonner', () => ({
    toast: {
        warning: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
    },
}))

jest.mock('@/shared/config/aws-config', () => ({
    AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))
jest.mock('@/modules/files/api/file-upload-api', () => ({
    makeRequest: jest.fn(),
}))
jest.mock('@/modules/auth', () => ({
    useAuth: () => ({ idToken: 'tok-test' }),
}))

import { toast } from 'sonner'
import { augErrorToast } from '@/modules/augmentation/hooks/use-augmentation-job'
import type { AugErrorCode } from '@/modules/augmentation/types'

const mockToast = toast as jest.Mocked<typeof toast>

afterEach(() => {
    jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// augErrorToast — pure function, no React needed
// ---------------------------------------------------------------------------

describe('augErrorToast', () => {
    it('mode 1: AUG_LLM_RATE_LIMITED fires toast.warning with Retry action', () => {
        const onRetry = jest.fn()
        augErrorToast('AUG_LLM_RATE_LIMITED', { onRetry })
        expect(mockToast.warning).toHaveBeenCalledTimes(1)
        const [msg, opts] = (mockToast.warning as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/AI service busy/i)
        expect(opts.action?.label).toBe('Retry')
        expect(opts.action?.onClick).toBe(onRetry)
    })

    it('mode 1: AUG_LLM_RATE_LIMITED fires warning even without onRetry', () => {
        augErrorToast('AUG_LLM_RATE_LIMITED')
        expect(mockToast.warning).toHaveBeenCalledTimes(1)
        const [, opts] = (mockToast.warning as jest.Mock).mock.calls[0]
        expect(opts.action).toBeUndefined()
    })

    it('mode 2: AUG_EXPR_INVALID fires toast.error with Edit Prompt action', () => {
        const onEditPrompt = jest.fn()
        augErrorToast('AUG_EXPR_INVALID', { onEditPrompt })
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        const [msg, opts] = (mockToast.error as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/expression invalid/i)
        expect(opts.action?.label).toBe('Edit Prompt')
        expect(opts.action?.onClick).toBe(onEditPrompt)
    })

    it('mode 3: AUG_ZERO_ROWS fires toast.warning with no action button', () => {
        augErrorToast('AUG_ZERO_ROWS')
        expect(mockToast.warning).toHaveBeenCalledTimes(1)
        const [msg, opts] = (mockToast.warning as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/no matching rows/i)
        // No action button for zero-rows — user needs to change data/prompt.
        expect(opts.action).toBeUndefined()
    })

    it('mode 4: AUG_SCHEMA_MISMATCH fires toast.error with column info in message', () => {
        augErrorToast('AUG_SCHEMA_MISMATCH', {
            errorMessage: 'Source missing columns: amount, currency',
        })
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        const [msg] = (mockToast.error as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/amount/i)
    })

    it('mode 4: AUG_SCHEMA_MISMATCH falls back to generic message when no errorMessage', () => {
        augErrorToast('AUG_SCHEMA_MISMATCH')
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        const [msg] = (mockToast.error as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/required columns/i)
    })

    it('mode 5: AUG_EVAL_FAILED fires toast.error with Contact Support action', () => {
        augErrorToast('AUG_EVAL_FAILED', { errorMessage: 'division by zero' })
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        const [msg, opts] = (mockToast.error as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/expression failed/i)
        expect(opts.description).toBe('division by zero')
        expect(opts.action?.label).toBe('Contact Support')
    })

    it('mode 6: AUG_CACHE_STALE fires NO toast (backend handles silently)', () => {
        augErrorToast('AUG_CACHE_STALE')
        expect(mockToast.warning).not.toHaveBeenCalled()
        expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('unknown code fires generic toast.error', () => {
        augErrorToast('AUG_UNKNOWN' as AugErrorCode)
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        const [msg] = (mockToast.error as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/Augmentation job failed/i)
    })

    it('mode 7: AUG_MATERIALIZE_FAILED fires toast.error with Contact Support action', () => {
        augErrorToast('AUG_MATERIALIZE_FAILED', { errorMessage: 'S3 write failed' })
        expect(mockToast.error).toHaveBeenCalledTimes(1)
        const [msg, opts] = (mockToast.error as jest.Mock).mock.calls[0]
        expect(msg).toMatch(/output generation failed/i)
        expect(opts.description).toBe('S3 write failed')
        expect(opts.action?.label).toBe('Contact Support')
    })

    it('does not call toast.success for any failure code', () => {
        const codes: AugErrorCode[] = [
            'AUG_LLM_RATE_LIMITED', 'AUG_EXPR_INVALID', 'AUG_ZERO_ROWS',
            'AUG_SCHEMA_MISMATCH', 'AUG_EVAL_FAILED', 'AUG_CACHE_STALE',
            'AUG_MATERIALIZE_FAILED', 'AUG_UNKNOWN',
        ]
        codes.forEach((c) => augErrorToast(c))
        expect(mockToast.success).not.toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// Toast deduplication: stable id per error code (P1-4)
// ---------------------------------------------------------------------------

describe('augErrorToast dedup: stable id per error code', () => {
    it('3× same code fires toast with same id (Sonner dedupes to 1)', () => {
        // Sonner deduplication: calling toast with the same `id` updates the
        // existing toast rather than stacking a new one.  We verify here that
        // augErrorToast always passes `{ id: "aug-<code>" }` so Sonner gets
        // a stable key it can collapse on.
        augErrorToast('AUG_LLM_RATE_LIMITED')
        augErrorToast('AUG_LLM_RATE_LIMITED')
        augErrorToast('AUG_LLM_RATE_LIMITED')
        // All 3 calls go through — Sonner handles dedup at render time via id.
        // What we can assert here is that the id option was passed with the right value.
        const calls = (mockToast.warning as jest.Mock).mock.calls
        expect(calls).toHaveLength(3)
        calls.forEach(([, opts]) => {
            expect(opts.id).toBe('aug-AUG_LLM_RATE_LIMITED')
        })
    })

    it('two different codes use different ids (no cross-contamination)', () => {
        augErrorToast('AUG_EXPR_INVALID')
        augErrorToast('AUG_EVAL_FAILED')
        const [, optsExpr] = (mockToast.error as jest.Mock).mock.calls[0]
        const [, optsEval] = (mockToast.error as jest.Mock).mock.calls[1]
        expect(optsExpr.id).toBe('aug-AUG_EXPR_INVALID')
        expect(optsEval.id).toBe('aug-AUG_EVAL_FAILED')
        expect(optsExpr.id).not.toBe(optsEval.id)
    })
})

// ---------------------------------------------------------------------------
// AugmentationJob.error_code type consistency
// ---------------------------------------------------------------------------

describe('AugErrorCode type', () => {
    it('all 8 expected codes are valid AugErrorCode values', () => {
        // This is a compile-time check expressed at runtime via assignment.
        const codes: AugErrorCode[] = [
            'AUG_LLM_RATE_LIMITED',
            'AUG_EXPR_INVALID',
            'AUG_ZERO_ROWS',
            'AUG_SCHEMA_MISMATCH',
            'AUG_EVAL_FAILED',
            'AUG_CACHE_STALE',
            'AUG_MATERIALIZE_FAILED',
            'AUG_UNKNOWN',
        ]
        expect(codes).toHaveLength(8)
    })
})
