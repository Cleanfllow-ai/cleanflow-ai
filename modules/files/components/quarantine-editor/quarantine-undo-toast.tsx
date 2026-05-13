'use client'

/**
 * QuarantineUndoToast — 8-second per-edit toast with a "↶ Undo edit to <col>"
 * button. Rendered after every successful cell edit. On click, the caller
 * pops the latest entry from `useEditHistory` and fires the revert through
 * the same EDITS_BATCH path as a normal edit.
 *
 * Uses @radix-ui/react-toast directly (no @/components/ui/toast dependency)
 * so the toast is self-contained and the page doesn't need a global Provider.
 */
import { Provider, Root, Title, Action, Viewport } from '@radix-ui/react-toast'

interface QuarantineUndoToastProps {
  /** Column of the most recent edit — drives the button label. */
  column: string | null
  /** True while the toast should be visible. Caller controls dismissal. */
  open: boolean
  /** Called when Radix auto-dismisses (8s) or the X is clicked. */
  onOpenChange: (open: boolean) => void
  /** Called when the user clicks "↶ Undo edit to <column>". */
  onUndo: () => void
}

const AUTO_DISMISS_MS = 8000

export function QuarantineUndoToast({
  column,
  open,
  onOpenChange,
  onUndo,
}: QuarantineUndoToastProps) {
  return (
    <Provider duration={AUTO_DISMISS_MS} swipeDirection="right">
      <Root
        open={open}
        onOpenChange={onOpenChange}
        duration={AUTO_DISMISS_MS}
        data-testid="quarantine-undo-toast"
        className="pointer-events-auto flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-lg"
      >
        <Title className="font-medium">
          Edited {column ? <span className="font-mono">{column}</span> : 'cell'}
        </Title>
        <Action
          altText="Undo last edit"
          asChild
          onClick={(e) => {
            e.preventDefault()
            onUndo()
            onOpenChange(false)
          }}
        >
          <button
            type="button"
            data-testid="quarantine-undo-button"
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <span aria-hidden>↶</span>
            <span>Undo edit to {column ?? 'cell'}</span>
          </button>
        </Action>
      </Root>
      <Viewport className="fixed bottom-4 right-4 z-[100] flex w-[360px] flex-col gap-2" />
    </Provider>
  )
}

export default QuarantineUndoToast
