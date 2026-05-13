/**
 * Unit tests for the quarantine per-cell undo feature:
 * - useEditHistory ring buffer (depth 20)
 * - Ctrl+Z global binding
 * - QuarantineUndoToast (auto-dismiss + click-revert)
 *
 * We don't render the full QuarantineEditorPage — it pulls in WebSocket,
 * Cognito, AG Grid, and ~15 hooks. Instead we drive a thin harness that
 * mirrors the same wiring used in app/files/[uploadId]/quarantine/page.tsx:
 *   useEditHistory + Ctrl+Z listener + QuarantineUndoToast.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React, { useCallback, useEffect, useState } from 'react'

import { useEditHistory } from '@/modules/files/hooks/use-edit-history'
import { QuarantineUndoToast } from '@/modules/files/components/quarantine-editor/quarantine-undo-toast'

describe('useEditHistory', () => {
  it('push then undo returns the last edit', () => {
    const { result } = renderHook(() => useEditHistory())
    act(() => {
      result.current.push({ file_id: 'f1', row_id: '1', column: 'email', old_value: 'a', new_value: 'b' })
    })
    let popped: any
    act(() => {
      popped = result.current.undo()
    })
    expect(popped).toMatchObject({ row_id: '1', column: 'email', old_value: 'a', new_value: 'b' })
    expect(result.current.size).toBe(0)
  })

  it('21st push evicts the oldest entry', () => {
    const { result } = renderHook(() => useEditHistory())
    act(() => {
      for (let i = 0; i < 21; i++) {
        result.current.push({ file_id: 'f1', row_id: String(i), column: 'c', old_value: i, new_value: i + 1 })
      }
    })
    expect(result.current.size).toBe(20)
    // The latest 20 should remain — undo returns row_id 20, then 19, ..., 1.
    // row_id 0 (the oldest) must have been evicted.
    const popped: any[] = []
    act(() => {
      for (let i = 0; i < 20; i++) {
        popped.push(result.current.undo())
      }
    })
    expect(popped[0].row_id).toBe('20')
    expect(popped[19].row_id).toBe('1')
    let extra: any
    act(() => { extra = result.current.undo() })
    expect(extra).toBeNull()
  })
})

/**
 * Harness mirroring page.tsx wiring: a fake "save" recorder takes the place of
 * editor.handleCellEdit + collab.broadcastCellUpdate, and we expose buttons to
 * push edits + show the toast.
 */
function UndoHarness({ onRevert }: { onRevert: (e: any) => void }) {
  const history = useEditHistory()
  const [toast, setToast] = useState<{ open: boolean; column: string | null }>({ open: false, column: null })

  const handleEdit = useCallback(
    (row_id: string, column: string, old_value: any, new_value: any) => {
      history.push({ file_id: 'f1', row_id, column, old_value, new_value })
      setToast({ open: true, column })
    },
    [history],
  )

  const handleUndo = useCallback(() => {
    const entry = history.undo()
    if (entry) onRevert(entry)
  }, [history, onRevert])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (history.size === 0) return
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, history.size])

  return (
    <div>
      <button onClick={() => handleEdit('7', 'email', 'old@x.io', 'new@x.io')} data-testid="seed-edit">
        seed
      </button>
      <QuarantineUndoToast
        column={toast.column}
        open={toast.open}
        onOpenChange={(open) => setToast((s) => ({ ...s, open }))}
        onUndo={handleUndo}
      />
    </div>
  )
}

describe('Quarantine undo wiring', () => {
  beforeEach(() => { jest.useRealTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('Ctrl+Z fires undo and emits a revert with the old_value', () => {
    const onRevert = jest.fn()
    render(<UndoHarness onRevert={onRevert} />)
    fireEvent.click(screen.getByTestId('seed-edit'))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(onRevert).toHaveBeenCalledTimes(1)
    expect(onRevert).toHaveBeenCalledWith(
      expect.objectContaining({ row_id: '7', column: 'email', old_value: 'old@x.io', new_value: 'new@x.io' }),
    )
  })

  it('toast auto-dismisses after 8 seconds', async () => {
    jest.useFakeTimers()
    const onRevert = jest.fn()
    render(<UndoHarness onRevert={onRevert} />)
    act(() => { fireEvent.click(screen.getByTestId('seed-edit')) })
    expect(screen.queryByTestId('quarantine-undo-toast')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(8100) })
    // Radix Toast may keep the node mounted briefly for exit animation; assert
    // it has either unmounted or been flagged closed.
    await waitFor(() => {
      const el = screen.queryByTestId('quarantine-undo-toast')
      if (!el) return // unmounted — pass
      expect(el.getAttribute('data-state')).not.toBe('open')
    })
  })

  it('clicking the toast undo button fires revert and closes the toast', async () => {
    const onRevert = jest.fn()
    render(<UndoHarness onRevert={onRevert} />)
    fireEvent.click(screen.getByTestId('seed-edit'))
    fireEvent.click(screen.getByTestId('quarantine-undo-button'))
    expect(onRevert).toHaveBeenCalledTimes(1)
    expect(onRevert).toHaveBeenCalledWith(expect.objectContaining({ old_value: 'old@x.io' }))
    await waitFor(() => {
      const el = screen.queryByTestId('quarantine-undo-toast')
      if (!el) return
      expect(el.getAttribute('data-state')).not.toBe('open')
    })
  })

  it('Ctrl+Z with empty history is a no-op (no revert fired)', () => {
    const onRevert = jest.fn()
    render(<UndoHarness onRevert={onRevert} />)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(onRevert).not.toHaveBeenCalled()
  })
})
