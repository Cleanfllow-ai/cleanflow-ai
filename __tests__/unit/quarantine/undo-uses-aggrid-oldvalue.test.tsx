/**
 * Regression test (2026-05-15):
 *   Edit → Undo must restore the ORIGINAL value, not blank out the cell.
 *
 * Production bug: handleCellEditWithBroadcast called
 *   editor.getCellValue(rowId, column, {})  // empty row → always falls to ''
 * so every undo wrote '' back. The fix routes AG-Grid's
 * CellValueChangedEvent.oldValue through onCellEdit as a 4th argument,
 * and the page wires that into useEditHistory.push({old_value}).
 *
 * We don't render the full editor (AG-Grid + WebSocket + Cognito). We
 * mirror the same wiring with a tiny harness and assert that the entry
 * pushed onto the undo stack carries the AG-Grid-supplied oldValue.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import React, { useCallback, useState } from 'react'

import { useEditHistory } from '@/modules/files/hooks/use-edit-history'

function Harness({ onEntry }: { onEntry: (e: any) => void }) {
  const history = useEditHistory()
  const [lastUndo, setLastUndo] = useState<any>(null)

  // Mirrors page.tsx::handleCellEditWithBroadcast after the fix:
  // - 4th arg `oldValue` is forwarded from AG-Grid
  // - falls back to a stub lookup ONLY when oldValue is undefined
  const handleCellEdit = useCallback(
    (rowId: string, column: string, value: string, oldValue?: string) => {
      const stubLookup = '' // simulates the empty-row bug — getCellValue(_,_,{}) → ''
      const previous = oldValue !== undefined ? oldValue : stubLookup
      history.push({
        file_id: 'f1',
        row_id: rowId,
        column,
        old_value: previous,
        new_value: value,
      })
      onEntry({ row_id: rowId, column, old_value: previous, new_value: value })
    },
    [history, onEntry],
  )

  const doUndo = useCallback(() => {
    const entry = history.undo()
    setLastUndo(entry)
  }, [history])

  return (
    <div>
      <button
        data-testid="edit-with-oldvalue"
        onClick={() => handleCellEdit('r1', 'OrderType', 'NEW', 'ORIGINAL_VALUE')}
      />
      <button
        data-testid="edit-without-oldvalue"
        onClick={() => handleCellEdit('r2', 'OrderType', 'NEW')}
      />
      <button data-testid="trigger-undo" onClick={doUndo} />
      <output data-testid="undo-result">{lastUndo ? lastUndo.old_value : ''}</output>
    </div>
  )
}

describe('undo restores AG-Grid oldValue (not blank)', () => {
  it('handleCellEdit receives oldValue → undo restores ORIGINAL_VALUE', () => {
    const onEntry = jest.fn()
    render(<Harness onEntry={onEntry} />)
    act(() => { fireEvent.click(screen.getByTestId('edit-with-oldvalue')) })
    expect(onEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({ old_value: 'ORIGINAL_VALUE', new_value: 'NEW' }),
    )
    act(() => { fireEvent.click(screen.getByTestId('trigger-undo')) })
    // The undo stack returns the same old_value — which is what the page
    // then writes back through editor.handleCellEdit on undo. The fix
    // means this is the ORIGINAL value, not ''.
    expect(screen.getByTestId('undo-result').textContent).toBe('ORIGINAL_VALUE')
  })

  it('regression: prior to fix, missing oldValue blanked the cell', () => {
    // This documents the OLD broken behaviour — when the page passed `{}`
    // to getCellValue, oldValue was '' and undo blanked the cell.  After
    // the fix, AG-Grid always supplies oldValue, so this code path only
    // triggers in tests / programmatic edits with no prior value.
    const onEntry = jest.fn()
    render(<Harness onEntry={onEntry} />)
    act(() => { fireEvent.click(screen.getByTestId('edit-without-oldvalue')) })
    expect(onEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({ old_value: '', new_value: 'NEW' }),
    )
  })
})
