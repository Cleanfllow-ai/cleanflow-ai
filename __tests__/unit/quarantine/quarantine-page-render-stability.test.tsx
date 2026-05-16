/**
 * quarantine-page-render-stability.test.tsx
 *
 * Regression guard for React error #185 (Maximum update depth exceeded).
 *
 * Root cause (page.tsx:392 before fix):
 *   useEffect(() => { history.clear() }, [uploadId, history])
 *
 * `history` is a new object reference every render (useEditHistory returns
 * a plain `{ push, undo, clear, size }` literal). This caused the effect to
 * re-run on every render. `history.clear()` calls `setVersion(v+1)` (internal
 * state), triggering another render → new `history` object → effect fires
 * again → infinite setState loop → React error #185.
 *
 * Fix: use `history.clear` (the stable useCallback) in the dep array.
 */

import { act, renderHook } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useRef, useEffect } from 'react'
import { useEditHistory } from '@/modules/files/hooks/use-edit-history'

// ---------------------------------------------------------------------------
// Fixture: the FIXED pattern
// ---------------------------------------------------------------------------

/**
 * useClearOnUploadId — mirrors the fixed pattern from page.tsx:
 *   useEffect(() => { history.clear() }, [uploadId, history.clear])
 *
 * `history.clear` is a stable useCallback — same reference across renders,
 * so the effect only fires when uploadId changes (the intended behavior).
 */
function useClearOnUploadId(uploadId: string) {
  const history = useEditHistory()
  const firedRef = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    firedRef.current += 1
    history.clear()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadId, history.clear])

  return { history, firedCount: firedRef.current }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quarantine page render stability — React #185 regression', () => {
  /**
   * Core invariant: history.clear is referentially stable across re-renders,
   * including renders triggered by internal state changes (setVersion).
   */
  it('useEditHistory: clear callback is referentially stable across state updates', () => {
    const { result, rerender } = renderHook(() => useEditHistory())

    const clearRef1 = result.current.clear

    // Push an entry — triggers setVersion → forces a re-render
    act(() => {
      result.current.push({
        file_id: 'f1',
        row_id: 'r1',
        column: 'col',
        old_value: 'a',
        new_value: 'b',
      })
    })

    // After state update, clear must be the same function reference
    expect(result.current.clear).toBe(clearRef1)

    // Push again to ensure stability over multiple state changes
    act(() => {
      result.current.push({
        file_id: 'f1',
        row_id: 'r2',
        column: 'col',
        old_value: 'x',
        new_value: 'y',
      })
    })
    expect(result.current.clear).toBe(clearRef1)
  })

  /**
   * Fixed pattern: effect fires at most once per test (Strict Mode doubles it),
   * NOT on every re-render. Verifies the loop is closed.
   *
   * Strict Mode in React 18+ double-invokes effects in development, so we
   * allow up to 2× the expected fire count.
   */
  it('fixed pattern: effect does NOT re-fire on re-renders with the same uploadId', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useClearOnUploadId(id),
      { initialProps: { id: 'upload-1' } },
    )

    const countAfterMount = result.current.firedCount
    // Mount: fired 1–2 times (Strict Mode may double-invoke)
    expect(countAfterMount).toBeGreaterThanOrEqual(1)
    expect(countAfterMount).toBeLessThanOrEqual(4) // generous: strict + initial push

    // Simulate multiple re-renders with the same uploadId (e.g. auth token loads,
    // sessionInfo arrives, connected state changes)
    for (let i = 0; i < 5; i++) {
      act(() => {
        rerender({ id: 'upload-1' })
      })
    }

    // Effect must NOT have fired any additional times — history.clear is stable
    expect(result.current.firedCount).toBe(countAfterMount)
  })

  /**
   * Fixed pattern: changing uploadId triggers the effect exactly once more.
   * Verifies the uploadId dep still works correctly after the fix.
   */
  it('fixed pattern: effect fires once when uploadId changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useClearOnUploadId(id),
      { initialProps: { id: 'upload-1' } },
    )

    const countBefore = result.current.firedCount

    act(() => {
      rerender({ id: 'upload-2' })
    })

    // Should have fired exactly once more (±1 for Strict Mode)
    const countAfter = result.current.firedCount
    expect(countAfter).toBeGreaterThanOrEqual(countBefore + 1)
    expect(countAfter).toBeLessThanOrEqual(countBefore + 2) // Strict Mode: 2×

    // No further firing on subsequent re-renders with the same new uploadId
    act(() => {
      rerender({ id: 'upload-2' })
    })
    act(() => {
      rerender({ id: 'upload-2' })
    })
    expect(result.current.firedCount).toBe(countAfter)
  })

  /**
   * Verifies push/undo callbacks are also stable — they appear in other
   * useCallback deps throughout the page and instability would cascade.
   */
  it('useEditHistory: push and undo callbacks are referentially stable', () => {
    const { result } = renderHook(() => useEditHistory())

    const pushRef = result.current.push
    const undoRef = result.current.undo

    act(() => {
      result.current.push({
        file_id: 'f1', row_id: 'r1', column: 'c', old_value: '', new_value: 'x',
      })
    })

    expect(result.current.push).toBe(pushRef)
    expect(result.current.undo).toBe(undoRef)
  })

  /**
   * Verifies `size` correctly reflects the buffer after push/undo so any
   * consumer relying on `history.size` for gating (Ctrl+Z UX) works.
   */
  it('useEditHistory: size tracks buffer depth correctly', () => {
    const { result } = renderHook(() => useEditHistory())

    expect(result.current.size).toBe(0)

    act(() => {
      result.current.push({ file_id: 'f', row_id: 'r', column: 'c', old_value: 'a', new_value: 'b' })
    })
    expect(result.current.size).toBe(1)

    act(() => {
      result.current.undo()
    })
    expect(result.current.size).toBe(0)

    act(() => {
      result.current.clear()
    })
    expect(result.current.size).toBe(0)
  })
})
