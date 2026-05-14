/**
 * Unit tests for lib/error-toast.ts :: mapQuarantineErrorToToast
 *
 * Verifies the 7-class quarantine error matrix:
 *   401  → "Your session expired. Sign in again."           [Sign In]
 *   403  → "You don't have permission for this action."     [Contact Support]
 *   409 ETAG_STALE → "Someone else changed this row…"       [Refresh]
 *   409 other      → "Conflict: {msg}."                     [Retry]
 *   500+ → "Server error. Please retry in a moment."        [Retry]
 *   timeout        → "Request took too long. Retry?"        [Retry]
 *   network        → "Connection lost. Check your internet."[Retry]
 */

import { mapQuarantineErrorToToast } from '@/lib/error-toast'
import { ApiError } from '@/modules/shared/api-error'

// ── helpers ───────────────────────────────────────────────────────────────────

function apiErr(status: number, message: string, code?: string): ApiError {
  return new ApiError({ status, message, code })
}

const ctx = { action: 'test action', retryFn: jest.fn() }

// ── 401 ──────────────────────────────────────────────────────────────────────

describe('401 Unauthorized', () => {
  it('maps to session-expired toast with Sign In action', () => {
    const desc = mapQuarantineErrorToToast(apiErr(401, 'Unauthorized'), ctx)
    expect(desc.title).toBe('Your session expired. Sign in again.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Sign In')
  })

  it('ignores action from ApiError — always Sign In for 401', () => {
    const err = new ApiError({ status: 401, message: 'token expired', action: 'retry' })
    const desc = mapQuarantineErrorToToast(err, ctx)
    expect(desc.action?.label).toBe('Sign In')
  })
})

// ── 403 ──────────────────────────────────────────────────────────────────────

describe('403 Forbidden', () => {
  it('maps to permission-denied toast with Contact Support action', () => {
    const desc = mapQuarantineErrorToToast(apiErr(403, 'Forbidden'), ctx)
    expect(desc.title).toBe("You don't have permission for this action.")
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Contact Support')
  })
})

// ── 409 ETAG_STALE ────────────────────────────────────────────────────────────

describe('409 ETAG_STALE', () => {
  it('maps via error code ETAG_STALE', () => {
    const desc = mapQuarantineErrorToToast(apiErr(409, 'etag conflict', 'ETAG_STALE'), ctx)
    expect(desc.title).toBe('Someone else changed this row. Refresh to see latest.')
    expect(desc.action?.label).toBe('Refresh')
    expect(desc.variant).toBe('default')
  })

  it('maps via error message containing "stale etag"', () => {
    const desc = mapQuarantineErrorToToast(apiErr(409, 'Stale ETag detected'), ctx)
    expect(desc.title).toBe('Someone else changed this row. Refresh to see latest.')
  })

  it('uses caller-supplied refreshFn over default reload', () => {
    const refreshFn = jest.fn()
    const desc = mapQuarantineErrorToToast(apiErr(409, 'stale etag', 'ETAG_STALE'), {
      action: 'save',
      refreshFn,
    })
    desc.action?.onClick()
    expect(refreshFn).toHaveBeenCalledTimes(1)
  })
})

// ── 409 other conflict ────────────────────────────────────────────────────────

describe('409 other conflict', () => {
  it('maps to conflict toast with server message and Retry action', () => {
    const desc = mapQuarantineErrorToToast(apiErr(409, 'Version conflict detected'), ctx)
    expect(desc.title).toMatch(/Conflict/)
    expect(desc.title).toContain('Version conflict detected')
    expect(desc.action?.label).toBe('Retry')
  })
})

// ── 500+ ─────────────────────────────────────────────────────────────────────

describe('500 Server Error', () => {
  it('maps to server-error toast with Retry action', () => {
    const desc = mapQuarantineErrorToToast(apiErr(500, 'Internal Server Error'), ctx)
    expect(desc.title).toBe('Server error. Please retry in a moment.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Retry')
  })

  it('maps 503 as well', () => {
    const desc = mapQuarantineErrorToToast(apiErr(503, 'Service Unavailable'), ctx)
    expect(desc.title).toBe('Server error. Please retry in a moment.')
  })
})

// ── Timeout ───────────────────────────────────────────────────────────────────

describe('Timeout', () => {
  it('maps AbortError to timeout toast with Retry action', () => {
    const err = new DOMException('The operation was aborted', 'AbortError')
    const desc = mapQuarantineErrorToToast(err, ctx)
    expect(desc.title).toBe('Request took too long. Retry?')
    expect(desc.variant).toBe('default')
    expect(desc.action?.label).toBe('Retry')
  })

  it('maps plain Error with "timeout" in message', () => {
    const err = new Error('Request timeout after 30s')
    const desc = mapQuarantineErrorToToast(err, ctx)
    expect(desc.title).toBe('Request took too long. Retry?')
  })
})

// ── Network failure ───────────────────────────────────────────────────────────

describe('Network failure', () => {
  it('maps "Failed to fetch" TypeError to network toast with Retry action', () => {
    const err = Object.assign(new TypeError('Failed to fetch'), {})
    const desc = mapQuarantineErrorToToast(err, ctx)
    expect(desc.title).toBe('Connection lost. Check your internet.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Retry')
  })

  it('maps "Network request failed" TypeError', () => {
    const err = new TypeError('Network request failed')
    const desc = mapQuarantineErrorToToast(err, ctx)
    expect(desc.title).toBe('Connection lost. Check your internet.')
  })

  it('calls retryFn when Retry button clicked', () => {
    const retryFn = jest.fn()
    const err = new TypeError('Failed to fetch')
    const desc = mapQuarantineErrorToToast(err, { action: 'load rows', retryFn })
    desc.action?.onClick()
    expect(retryFn).toHaveBeenCalledTimes(1)
  })
})

// ── No retryFn ────────────────────────────────────────────────────────────────

describe('No retryFn provided', () => {
  it('omits action button for network error when no retryFn', () => {
    const err = new TypeError('Failed to fetch')
    const desc = mapQuarantineErrorToToast(err, { action: 'load rows' })
    expect(desc.action).toBeUndefined()
  })

  it('omits action button for 500 when no retryFn', () => {
    const desc = mapQuarantineErrorToToast(apiErr(500, 'oops'), { action: 'save' })
    expect(desc.action).toBeUndefined()
  })
})
