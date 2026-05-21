/**
 * use-quarantine-shortcuts.ts
 *
 * Power-user keyboard shortcuts for the quarantine editor.
 *
 * Single global `keydown` listener wired while the editor is mounted.
 * Cleanup happens on unmount via the standard `removeEventListener` effect.
 *
 * Shortcuts:
 *   ⌘/Ctrl + S       → save the current edit (preventDefault on the browser
 *                       Save dialog).  Falls back to blurring the focused
 *                       grid cell, which AG-Grid commits via its standard
 *                       stop-editing flow.
 *   ⌘/Ctrl + Enter   → commit the current edit and advance to the next
 *                       quarantined cell (Tab semantics inside AG-Grid).
 *   ⌘/Ctrl + F       → toggle the Find / Replace panel.
 *   Esc              → close the topmost open sub-dialog without losing
 *                       other state; if no dialog is open, deselect the
 *                       focused cell.
 *   ?                → open the keyboard-shortcut cheatsheet popover.
 *
 * Behaviour notes:
 *   - Skipped when focus is inside a text input / textarea / contentEditable
 *     element so the user can still ⌘A / ⌘C inside editors.  Exception:
 *     ⌘S / ⌘Enter still fire inside AG-Grid cell editors so the user can
 *     save without first pressing Esc.  AG-Grid cell editors use plain
 *     <input> elements that we identify via the closest `.ag-cell` ancestor.
 */

import { useEffect } from 'react'

export interface QuarantineShortcutHandlers {
  /** Bound to ⌘S / Ctrl+S. */
  onSave?: () => void
  /** Bound to ⌘Enter / Ctrl+Enter — commit edit + advance to the next
   *  quarantined cell (Tab semantics).  No-op when no cell is focused. */
  onAdvanceToNextCell?: () => void
  /** Bound to ⌘F / Ctrl+F — toggle Find / Replace panel. */
  onOpenFindReplace?: () => void
  /** Bound to Esc when no sub-dialog is open. */
  onDeselectCell?: () => void
  /** Bound to `?` — opens the cheatsheet popover. */
  onShowCheatsheet?: () => void
}

interface UseQuarantineShortcutsOptions extends QuarantineShortcutHandlers {
  /** When false the listener is unmounted entirely.  Default: true. */
  enabled?: boolean
}

function isInsideAgGridCellEditor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('.ag-cell-edit-wrapper, .ag-cell-inline-editing'))
}

function isInsideEditableInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function findTopmostOpenDialog(): HTMLElement | null {
  // Radix-UI dialogs render `[role="dialog"][data-state="open"]` inside a
  // portal.  The last one in document order is the topmost (Radix stacks
  // in mount order).  We restrict to dialogs that have an explicit close
  // button so we don't accidentally try to close a dialog that's modal-by-
  // design and meant to be dismissed only through its own buttons.
  const nodes = document.querySelectorAll<HTMLElement>(
    '[role="dialog"][data-state="open"]',
  )
  if (nodes.length === 0) return null
  return nodes[nodes.length - 1]
}

function closeTopmostDialog(): boolean {
  const dialog = findTopmostOpenDialog()
  if (!dialog) return false
  // Prefer a button that's explicitly an aria-label="Close" (Radix default).
  const closeBtn =
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]') ||
    dialog.querySelector<HTMLButtonElement>('button[data-state="open"]') ||
    null
  if (closeBtn) {
    closeBtn.click()
    return true
  }
  // Fall back: Radix dialogs respond to Escape natively, so dispatch one
  // at the dialog itself.  We mark the event so our own listener ignores
  // it on the next tick (prevents recursion).
  const synth = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  dialog.dispatchEvent(synth)
  return true
}

function findActiveGridCell(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.ag-cell-focus')
}

export function useQuarantineShortcuts(
  options: UseQuarantineShortcutsOptions,
): void {
  const {
    enabled = true,
    onSave,
    onAdvanceToNextCell,
    onOpenFindReplace,
    onDeselectCell,
    onShowCheatsheet,
  } = options

  useEffect(() => {
    if (!enabled) return undefined

    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const key = e.key
      const target = e.target

      // ⌘S / Ctrl+S — always preventDefault to kill the browser Save dialog.
      if (mod && (key === 's' || key === 'S')) {
        e.preventDefault()
        // If a cell editor is open, blur it first so AG-Grid commits the
        // pending value into our edit map.
        if (isInsideAgGridCellEditor(target)) {
          ;(target as HTMLElement).blur()
        }
        onSave?.()
        return
      }

      // ⌘Enter / Ctrl+Enter — apply edit + advance.
      if (mod && key === 'Enter') {
        e.preventDefault()
        if (isInsideAgGridCellEditor(target)) {
          ;(target as HTMLElement).blur()
        }
        onAdvanceToNextCell?.()
        return
      }

      // ⌘F / Ctrl+F — open Find / Replace.  Skip when typing inside a
      // regular input so the user can still type 'f' characters freely.
      if (mod && (key === 'f' || key === 'F')) {
        // We still want this even inside the grid cell editor — the user
        // is asking for find-replace, not character entry.
        e.preventDefault()
        onOpenFindReplace?.()
        return
      }

      // Esc — close topmost dialog, otherwise deselect cell.
      if (key === 'Escape') {
        const dialog = findTopmostOpenDialog()
        if (dialog) {
          // Let Radix handle native Escape if the focus is already inside
          // the dialog (its built-in onEscapeKeyDown will run).  We only
          // step in when focus is OUTSIDE so the user can dismiss a modal
          // from anywhere on the page.
          if (!dialog.contains(target as Node)) {
            e.preventDefault()
            closeTopmostDialog()
          }
          return
        }
        // No dialog — fall through to deselect, but only when focus is
        // not inside an active cell editor (so Esc still cancels the
        // edit normally per AG-Grid's built-in behaviour).
        if (isInsideAgGridCellEditor(target)) return
        // Don't intercept Esc inside other inputs.
        if (isInsideEditableInput(target)) return
        const focused = findActiveGridCell()
        if (focused) {
          e.preventDefault()
          onDeselectCell?.()
        }
        return
      }

      // ? — cheatsheet.  Only when the user isn't typing.  Shift+/ on most
      // keyboards produces '?'.
      if (key === '?' && !isInsideEditableInput(target) && !isInsideAgGridCellEditor(target)) {
        e.preventDefault()
        onShowCheatsheet?.()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    enabled,
    onSave,
    onAdvanceToNextCell,
    onOpenFindReplace,
    onDeselectCell,
    onShowCheatsheet,
  ])
}
