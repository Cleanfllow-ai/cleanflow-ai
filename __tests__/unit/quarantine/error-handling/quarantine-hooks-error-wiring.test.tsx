/**
 * Integration tests: quarantine hooks wire API errors to toast correctly.
 *
 * Tests verify that when API calls fail with different error codes, the hook
 * produces a toast with the right message text and action label from the matrix:
 *   401 → "Your session expired"
 *   403 → "You don't have permission"
 *   409 ETAG_STALE → "Someone else changed this row"
 *   500 → "Server error"
 *   network → "Connection lost"
 *
 * We test through `mapQuarantineErrorToToast` (unit) rather than rendering
 * full hooks (which require full React + Redux wiring), verifying the
 * plumbing from ApiError → descriptor is consistent with what the hooks call.
 */

import { mapQuarantineErrorToToast } from '@/lib/error-toast'
import { ApiError } from '@/modules/shared/api-error'

// ── Shared helpers ────────────────────────────────────────────────────────────

function makeApiError(status: number, message: string, code?: string): ApiError {
  return new ApiError({ status, message, code })
}

const noOp = jest.fn()

// ── use-quarantine-rows: GET /files/{id}/quarantined/rows ─────────────────────

describe('use-quarantine-rows → load quarantined rows', () => {
  const ctx = { action: 'load quarantined rows', retryFn: noOp }

  it('401 produces session-expired toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(401, 'Unauthorized'), ctx)
    expect(d.title).toContain('session expired')
    expect(d.action?.label).toBe('Sign In')
  })

  it('403 produces permission-denied toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(403, 'Forbidden'), ctx)
    expect(d.title).toContain("don't have permission")
    expect(d.action?.label).toBe('Contact Support')
  })

  it('500 produces server-error toast with Retry', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'Internal error'), ctx)
    expect(d.title).toContain('Server error')
    expect(d.action?.label).toBe('Retry')
  })

  it('network error produces connection-lost toast', () => {
    const d = mapQuarantineErrorToToast(new TypeError('Failed to fetch'), ctx)
    expect(d.title).toContain('Connection lost')
    expect(d.action?.label).toBe('Retry')
  })

  it('timeout produces timeout toast', () => {
    const d = mapQuarantineErrorToToast(new DOMException('aborted', 'AbortError'), ctx)
    expect(d.title).toContain('took too long')
    expect(d.action?.label).toBe('Retry')
  })
})

// ── use-quarantine-session: initialize editor ─────────────────────────────────

describe('use-quarantine-session → initialize quarantine editor', () => {
  const ctx = { action: 'initialize quarantine editor' }

  it('401 produces sign-in toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(401, 'Token expired'), ctx)
    expect(d.title).toContain('session expired')
    expect(d.action?.label).toBe('Sign In')
  })

  it('403 produces permission-denied toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(403, 'Not authorized'), ctx)
    expect(d.title).toContain("don't have permission")
  })

  it('500 produces server-error toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'Lambda error'), ctx)
    expect(d.title).toContain('Server error')
  })
})

// ── PATCH /files/{id}/quarantined/cells: save edits ──────────────────────────

describe('use-quarantine-editor → save edits (PATCH cells)', () => {
  const ctx = { action: 'save edits', retryFn: noOp }

  it('409 ETAG_STALE produces stale-row toast with Refresh', () => {
    const d = mapQuarantineErrorToToast(makeApiError(409, 'stale etag', 'ETAG_STALE'), ctx)
    expect(d.title).toContain('Someone else changed this row')
    expect(d.action?.label).toBe('Refresh')
  })

  it('409 other conflict produces conflict toast with Retry', () => {
    const d = mapQuarantineErrorToToast(makeApiError(409, 'DynamoDB write conflict'), ctx)
    expect(d.title).toContain('Conflict')
    expect(d.title).toContain('DynamoDB write conflict')
    expect(d.action?.label).toBe('Retry')
  })

  it('401 produces sign-in toast even during save', () => {
    const d = mapQuarantineErrorToToast(makeApiError(401, 'Expired'), ctx)
    expect(d.action?.label).toBe('Sign In')
  })

  it('500 produces server-error toast with Retry', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'save failed'), ctx)
    expect(d.title).toContain('Server error')
    expect(d.action?.label).toBe('Retry')
  })
})

// ── POST /files/{id}/quarantined/reprocess: submit reprocess ─────────────────

describe('use-quarantine-editor → submit reprocess', () => {
  const ctx = { action: 'submit reprocess' }

  it('403 produces permission-denied toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(403, 'Not authorized'), ctx)
    expect(d.title).toContain("don't have permission")
    expect(d.action?.label).toBe('Contact Support')
  })

  it('500 produces server-error toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'SFN error'), ctx)
    expect(d.title).toContain('Server error')
  })

  it('network error produces connection-lost toast', () => {
    const d = mapQuarantineErrorToToast(new TypeError('Network request failed'), ctx)
    expect(d.title).toContain('Connection lost')
  })
})

// ── POST /files/{id}/quarantined/find-replace (async) ────────────────────────

describe('find-replace async (use-quarantine-find-replace)', () => {
  const ctx = { action: 'find and replace', retryFn: noOp }

  it('401 produces sign-in toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(401, 'Expired'), ctx)
    expect(d.title).toContain('session expired')
    expect(d.action?.label).toBe('Sign In')
  })

  it('500 produces server-error toast with Retry', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'Op failed'), ctx)
    expect(d.title).toContain('Server error')
    expect(d.action?.label).toBe('Retry')
  })

  it('FAILED_TERMINAL message maps via plain Error to error toast', () => {
    const d = mapQuarantineErrorToToast(new Error('Operation failed on shard 3'), ctx)
    // Falls through to generic mapErrorToToast for plain Error
    expect(d.description).toBe('Operation failed on shard 3')
    expect(d.variant).toBe('destructive')
  })
})

// ── POST dry-run (POST /files/{id}/quarantined/dry-run) ───────────────────────

describe('dry-run preview', () => {
  const ctx = { action: 'preview find-replace', retryFn: noOp }

  it('401 produces sign-in toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(401, 'Expired'), ctx)
    expect(d.action?.label).toBe('Sign In')
  })

  it('500 produces server-error toast with Retry', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'Lambda OOM'), ctx)
    expect(d.title).toContain('Server error')
    expect(d.action?.label).toBe('Retry')
  })
})

// ── GET /files/{id}/quarantined/versions ──────────────────────────────────────

describe('version list', () => {
  const ctx = { action: 'load versions' }

  it('403 produces permission-denied toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(403, 'Forbidden'), ctx)
    expect(d.title).toContain("don't have permission")
  })

  it('network error produces connection-lost toast', () => {
    const d = mapQuarantineErrorToToast(new TypeError('Failed to fetch'), ctx)
    expect(d.title).toContain('Connection lost')
  })
})

// ── DELETE /files/{id}: async delete ─────────────────────────────────────────

describe('async delete', () => {
  const ctx = { action: 'delete file', retryFn: noOp }

  it('403 produces permission-denied toast', () => {
    const d = mapQuarantineErrorToToast(makeApiError(403, 'Forbidden'), ctx)
    expect(d.title).toContain("don't have permission")
    expect(d.action?.label).toBe('Contact Support')
  })

  it('500 produces server-error with Retry', () => {
    const d = mapQuarantineErrorToToast(makeApiError(500, 'Delete SFN error'), ctx)
    expect(d.title).toContain('Server error')
    expect(d.action?.label).toBe('Retry')
  })
})

// ── No silent failures: all error classes produce a title ─────────────────────

describe('No silent failures', () => {
  const classes: [string, unknown][] = [
    ['401', makeApiError(401, 'x')],
    ['403', makeApiError(403, 'x')],
    ['409-stale', makeApiError(409, 'stale etag', 'ETAG_STALE')],
    ['409-other', makeApiError(409, 'other conflict')],
    ['500', makeApiError(500, 'x')],
    ['timeout', new DOMException('aborted', 'AbortError')],
    ['network', new TypeError('Failed to fetch')],
  ]

  test.each(classes)('%s produces non-empty title', (_label, err) => {
    const d = mapQuarantineErrorToToast(err, { action: 'any' })
    expect(d.title.length).toBeGreaterThan(0)
    // Must never say "Something went wrong" without any context
    expect(d.title).not.toBe('Something went wrong.')
  })
})
