/**
 * quarantine-bulk-apply-dialog.tsx
 *
 * Bug 21 (Bulk Fix UI) — "Apply value to all" dialog.
 *
 * Renders a column-picker + value-input.  The actual edit fan-out
 * (selectedRowIds × column → value) is performed by the parent page via
 * the existing `useQuarantineEditor` hook, so this dialog stays a thin,
 * uncontrolled-mode-friendly piece of UI.  It only exposes:
 *   - column: selected column (must be one of the editable columns)
 *   - value: new value (free text)
 *   - confirm-large-batch: extra modal when >500 rows are selected
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Wand2, AlertTriangle } from 'lucide-react'

interface QuarantineBulkApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Columns the user can pick from — should be the manifest's
   *  editable_columns (minus 'row_id').  Empty list → disabled state. */
  editableColumns: string[]
  /** Row IDs that will receive the value.  Used to render the
   *  confirmation count + drive the warning at >500 rows. */
  selectedRowCount: number
  /** Called with the chosen (column, value) once the user confirms.
   *  Parent owns the fan-out + close; this dialog only collects input. */
  onApply: (column: string, value: string) => void | Promise<void>
  applying?: boolean
}

const LARGE_BATCH_THRESHOLD = 500

export function QuarantineBulkApplyDialog({
  open,
  onOpenChange,
  editableColumns,
  selectedRowCount,
  onApply,
  applying = false,
}: QuarantineBulkApplyDialogProps) {
  const [column, setColumn] = useState<string>('')
  const [value, setValue] = useState<string>('')
  const [confirmLargeBatch, setConfirmLargeBatch] = useState<boolean>(false)

  const sortedColumns = useMemo(
    () => editableColumns.filter((c) => c !== 'row_id'),
    [editableColumns],
  )

  // Reset on (re)open so stale state doesn't leak across invocations.
  useEffect(() => {
    if (open) {
      setColumn(sortedColumns[0] ?? '')
      setValue('')
      setConfirmLargeBatch(false)
    }
  }, [open, sortedColumns])

  const isLargeBatch = selectedRowCount > LARGE_BATCH_THRESHOLD
  const canConfirm =
    !!column && (!isLargeBatch || confirmLargeBatch) && !applying

  const handleConfirm = async () => {
    if (!column || applying) return
    await onApply(column, value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        data-testid="bulk-apply-dialog"
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-blue-600" />
            Apply value to all
          </DialogTitle>
          <DialogDescription>
            The chosen value will be written to every selected row for the
            chosen column.  The change is autosaved through the standard
            quarantine edits batch endpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-apply-column" className="text-xs font-medium">
              Column
            </Label>
            <Select value={column} onValueChange={setColumn} disabled={applying}>
              <SelectTrigger
                id="bulk-apply-column"
                data-testid="bulk-apply-column-select"
                className="h-8 text-xs"
              >
                <SelectValue placeholder="Choose a column" />
              </SelectTrigger>
              <SelectContent>
                {sortedColumns.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No editable columns
                  </div>
                ) : (
                  sortedColumns.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-apply-value" className="text-xs font-medium">
              Value
            </Label>
            <Input
              id="bulk-apply-value"
              data-testid="bulk-apply-value-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="New value (leave blank to clear)"
              disabled={applying}
              className="h-8 text-xs"
            />
            <p className="text-[10.5px] text-muted-foreground">
              Will be applied to{' '}
              <span className="font-medium text-foreground">
                {selectedRowCount.toLocaleString()}
              </span>{' '}
              selected row{selectedRowCount === 1 ? '' : 's'}.
            </p>
          </div>

          {isLargeBatch && (
            <div
              data-testid="bulk-apply-large-batch-warning"
              className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <p className="font-medium">
                  Apply to {selectedRowCount.toLocaleString()} rows? This may
                  take up to 30s.
                </p>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={confirmLargeBatch}
                    onChange={(e) => setConfirmLargeBatch(e.target.checked)}
                    disabled={applying}
                    data-testid="bulk-apply-large-batch-confirm"
                    className="h-3 w-3 accent-amber-600"
                  />
                  <span>Yes, I want to apply to all selected rows</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={applying}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            data-testid="bulk-apply-confirm-button"
            className="h-7 text-xs"
          >
            {applying ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3 mr-1.5" />
            )}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QuarantineBulkApplyDialog
