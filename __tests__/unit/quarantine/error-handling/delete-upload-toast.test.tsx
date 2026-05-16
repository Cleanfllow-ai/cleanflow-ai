/**
 * Unit tests: delete-upload error path → mapQuarantineErrorToToast routing
 *
 * Verifies that the delete handler in use-files-page routes errors through
 * toastFromQuarantineError so the error matrix is honoured:
 *   401 → "Your session expired…" + Sign In action
 *   403 → "You don't have permission…" + Contact Support action
 *   500 → "Server error…" + Retry action
 *
 * We test `mapQuarantineErrorToToast` directly (the function the handler now
 * delegates to), confirming the routing contract that replaced the old bespoke
 * if/else block.
 */

import { mapQuarantineErrorToToast } from '@/lib/error-toast'
import { ApiError } from '@/modules/shared/api-error'

function makeApiError(status: number, message: string, code?: string): ApiError {
  return new ApiError({ status, message, code })
}

const retryFn = jest.fn()
const ctx = { action: 'delete', retryFn }

describe('delete-upload → 401 routes to Sign In action', () => {
  it('maps 401 to session-expired toast with Sign In button', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(401, 'Unauthorized'), ctx)
    expect(desc.title).toBe('Your session expired. Sign in again.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Sign In')
  })

  it('401 always shows Sign In regardless of action field on error', () => {
    const err = new ApiError({ status: 401, message: 'token expired', action: 'retry' })
    const desc = mapQuarantineErrorToToast(err, ctx)
    expect(desc.action?.label).toBe('Sign In')
  })
})

describe('delete-upload → 403 routes to Contact Support action', () => {
  it('maps 403 Forbidden to permission-denied toast with Contact Support', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(403, 'Forbidden'), ctx)
    expect(desc.title).toBe("You don't have permission for this action.")
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Contact Support')
  })

  it('uses error message in description when provided', () => {
    const desc = mapQuarantineErrorToToast(
      makeApiError(403, 'You lack the delete:file permission'),
      ctx,
    )
    expect(desc.description).toContain('delete:file')
  })
})

describe('delete-upload → 500 routes to Server Error + Retry action', () => {
  it('maps 500 to server-error toast with Retry action', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(500, 'Internal Server Error'), ctx)
    expect(desc.title).toBe('Server error. Please retry in a moment.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Retry')
  })

  it('maps 503 Service Unavailable to same server-error toast', () => {
    const desc = mapQuarantineErrorToToast(makeApiError(503, 'Service Unavailable'), ctx)
    expect(desc.title).toBe('Server error. Please retry in a moment.')
    expect(desc.action?.label).toBe('Retry')
  })
})
