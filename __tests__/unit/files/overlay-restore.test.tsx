/**
 * Unit tests for useOverlayPersist — sessionStorage-backed restore of
 * unsaved quarantine cell edits across browser refreshes.
 *
 * Covers four cases:
 *   1. Writes to sessionStorage on edit (after debounce).
 *   2. Restores from sessionStorage on mount.
 *   3. discardRestored() clears sessionStorage.
 *   4. clearPersisted() clears sessionStorage (post-save path).
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

import { act, renderHook } from '@testing-library/react'
import { useOverlayPersist } from '@/modules/files/hooks/use-overlay-persist'

const FILE_ID = 'upl-abc'
const KEY = `quarantine_overlay_${FILE_ID}`

beforeEach(() => {
  window.sessionStorage.clear()
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('useOverlayPersist', () => {
  it('write on edit: persists editsMap to sessionStorage after debounce', () => {
    const editsMap = { 'row-1': { col_a: 'new-value' } }
    renderHook(() =>
      useOverlayPersist({
        fileId: FILE_ID,
        sessionId: 'sess-1',
        editsMap,
        debounceMs: 100,
      }),
    )
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    act(() => {
      jest.advanceTimersByTime(120)
    })
    const stored = window.sessionStorage.getItem(KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.edits_map['row-1'].col_a).toBe('new-value')
    expect(parsed.session_id).toBe('sess-1')
  })

  it('restore on mount: reads existing entry from sessionStorage', () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        session_id: 'sess-old',
        edits_map: { 'row-7': { col_x: 'restored' } },
        saved_at: '2025-01-01T00:00:00Z',
      }),
    )
    const { result } = renderHook(() =>
      useOverlayPersist({
        fileId: FILE_ID,
        sessionId: 'sess-new',
        editsMap: {},
      }),
    )
    expect(result.current.restoredCount).toBe(1)
    expect(result.current.restored?.edits_map['row-7'].col_x).toBe('restored')
  })

  it('discardRestored: clears sessionStorage', () => {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        session_id: '',
        edits_map: { 'row-1': { c: 'v' } },
        saved_at: '',
      }),
    )
    const { result } = renderHook(() =>
      useOverlayPersist({ fileId: FILE_ID, sessionId: undefined, editsMap: {} }),
    )
    act(() => {
      result.current.discardRestored()
    })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(result.current.restoredCount).toBe(0)
  })

  it('clearPersisted: post-save clears sessionStorage entry', () => {
    const editsMap = { 'row-1': { col_a: 'x' } }
    const { result } = renderHook(() =>
      useOverlayPersist({
        fileId: FILE_ID,
        sessionId: 'sess',
        editsMap,
        debounceMs: 50,
      }),
    )
    act(() => {
      jest.advanceTimersByTime(80)
    })
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull()
    act(() => {
      result.current.clearPersisted()
    })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })
})
