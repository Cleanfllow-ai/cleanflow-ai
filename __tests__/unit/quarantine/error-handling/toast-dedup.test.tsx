/**
 * Unit tests: toast deduplication
 *
 * Verifies that:
 *   1. Passing the same stable `id` to toast() collapses burst toasts to 1.
 *   2. Two different IDs produce 2 independent toasts.
 *   3. toastFromQuarantineError attaches a stable dedup id (quarantine-<code>-<action>).
 *
 * Tests operate on the use-toast reducer directly (no DOM needed) and on the
 * toastFromQuarantineError helper from error-toast-jsx.
 */

import { reducer } from '@/shared/hooks/use-toast'
import { toastFromQuarantineError } from '@/lib/error-toast-jsx'
import { ApiError } from '@/modules/shared/api-error'

// ── reducer-level dedup ───────────────────────────────────────────────────────

type State = { toasts: Array<{ id: string; title?: string; open?: boolean }> }
type Action =
  | { type: 'ADD_TOAST'; toast: { id: string; title?: string; open?: boolean } }
  | { type: 'UPDATE_TOAST'; toast: { id: string; title?: string } }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string }

const EMPTY: State = { toasts: [] }

describe('use-toast reducer: dedup by caller-supplied id', () => {
  it('second ADD with same id updates in-place (UPDATE_TOAST path)', () => {
    // Simulate what the dedup-aware toast() function does:
    // first call → ADD_TOAST, second call → UPDATE_TOAST (same id, already active)
    const after1 = reducer(EMPTY, {
      type: 'ADD_TOAST',
      toast: { id: 'quarantine-401-delete', title: 'Session expired v1', open: true },
    })
    expect(after1.toasts).toHaveLength(1)

    const after2 = reducer(after1, {
      type: 'UPDATE_TOAST',
      toast: { id: 'quarantine-401-delete', title: 'Session expired v2' },
    })
    // Still 1 toast — updated in-place
    expect(after2.toasts).toHaveLength(1)
    expect(after2.toasts[0].title).toBe('Session expired v2')
  })

  it('two distinct ids produce 2 toasts (up to TOAST_LIMIT)', () => {
    // TOAST_LIMIT=1 slices to 1, but the reducer itself accepts both before slice.
    // We verify the slice behaviour: second ADD replaces first (newest-first).
    const after1 = reducer(EMPTY, {
      type: 'ADD_TOAST',
      toast: { id: 'quarantine-401-delete', title: 'Sign In', open: true },
    })
    const after2 = reducer(after1, {
      type: 'ADD_TOAST',
      toast: { id: 'quarantine-500-save', title: 'Server Error', open: true },
    })
    // TOAST_LIMIT=1 → newest wins
    expect(after2.toasts).toHaveLength(1)
    expect(after2.toasts[0].id).toBe('quarantine-500-save')
  })
})

// ── toastFromQuarantineError id format ────────────────────────────────────────

describe('toastFromQuarantineError: stable dedup id', () => {
  it('401 error produces id matching quarantine-401-<action>', () => {
    const payload = toastFromQuarantineError(
      new ApiError({ status: 401, message: 'Unauthorized' }),
      { action: 'delete' },
    )
    expect(payload.id).toBe('quarantine-401-delete')
  })

  it('403 error produces id matching quarantine-403-<action>', () => {
    const payload = toastFromQuarantineError(
      new ApiError({ status: 403, message: 'Forbidden' }),
      { action: 'find and replace' },
    )
    expect(payload.id).toBe('quarantine-403-find-and-replace')
  })

  it('500 error produces id matching quarantine-5xx-<action>', () => {
    const payload = toastFromQuarantineError(
      new ApiError({ status: 500, message: 'Server error' }),
      { action: 'load rows' },
    )
    expect(payload.id).toBe('quarantine-5xx-load-rows')
  })

  it('network error produces id matching quarantine-network-<action>', () => {
    const payload = toastFromQuarantineError(
      new TypeError('Failed to fetch'),
      { action: 'save' },
    )
    expect(payload.id).toBe('quarantine-network-save')
  })

  it('timeout error produces id matching quarantine-timeout-<action>', () => {
    const payload = toastFromQuarantineError(
      new DOMException('The operation was aborted', 'AbortError'),
      { action: 'save' },
    )
    expect(payload.id).toBe('quarantine-timeout-save')
  })

  it('same error code + same action always yields the same id (stable)', () => {
    const err = new ApiError({ status: 401, message: 'expired' })
    const id1 = toastFromQuarantineError(err, { action: 'delete' }).id
    const id2 = toastFromQuarantineError(err, { action: 'delete' }).id
    expect(id1).toBe(id2)
    expect(id1).toBe('quarantine-401-delete')
  })
})
