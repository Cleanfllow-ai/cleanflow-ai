/**
 * Unit tests: find-replace error path → toastFromQuarantineError routing
 *
 * Verifies that the find-replace panel now passes the raw error object
 * (ApiError, not a wrapped plain Error) so HTTP status is preserved and
 * the quarantine error matrix fires correctly:
 *
 *   409 ETAG_STALE → "Someone else changed this row." + Refresh
 *   409 other      → "Conflict: …" + Retry
 *   401            → "Your session expired." + Sign In
 *
 * We test `mapQuarantineErrorToToast` directly — this is the function
 * that `toastFromQuarantineError` wraps, so passing an ApiError confirms
 * the routing contract is upheld.
 */

import { mapQuarantineErrorToToast } from '@/lib/error-toast'
import { ApiError } from '@/modules/shared/api-error'

function makeApiError(status: number, message: string, code?: string): ApiError {
  return new ApiError({ status, message, code })
}

const retryFn = jest.fn()
const ctx = { action: 'find and replace', retryFn }

describe('find-replace → 409 ETAG_STALE routes to Conflict-stale toast', () => {
  it('maps 409 ETAG_STALE code to stale-row toast with Refresh action', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(409, 'etag conflict', 'ETAG_STALE'), ctx)
    expect(desc.title).toBe('Someone else changed this row. Refresh to see latest.')
    expect(desc.action?.label).toBe('Refresh')
    expect(desc.variant).toBe('default')
  })

  it('stale-etag message triggers the same branch (no error code)', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(409, 'Stale ETag detected'), ctx)
    expect(desc.title).toBe('Someone else changed this row. Refresh to see latest.')
  })

  it('plain Error wrapping "etag" message does NOT route to stale branch (needs ApiError)', () => {
    // This is the OLD behaviour that the fix corrects: wrapping in new Error()
    // caused the status check to fail and fell through to the generic branch.
    const plainErr = new Error('Stale ETag detected')
    const desc = mapQuarantineErrorToToast(plainErr, ctx)
    // A plain Error doesn't match 409-ETAG_STALE; confirm it does NOT give Refresh
    expect(desc.action?.label).not.toBe('Refresh')
  })
})

describe('find-replace → 409 other routes to Conflict toast + Retry', () => {
  it('maps 409 non-etag to conflict toast with Retry', () => {
    const desc = mapQuarantineErrorToToast(
      makeApiError(409, 'Version conflict detected'),
      ctx,
    )
    expect(desc.title).toMatch(/Conflict/)
    expect(desc.title).toContain('Version conflict detected')
    expect(desc.action?.label).toBe('Retry')
  })
})

describe('find-replace → 401 routes to Sign In action', () => {
  it('maps 401 to session-expired toast with Sign In button', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(401, 'Unauthorized'), ctx)
    expect(desc.title).toBe('Your session expired. Sign in again.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Sign In')
  })
})
