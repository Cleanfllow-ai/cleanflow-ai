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
 *
 * W5B-2 (2026-05-19) — Preview-before-apply.
 *   The persona ask (Sarah, VP RevOps): "When I select 100 rows and click Fix,
 *   it just goes — no preview of what will change. Scary on the first try."
 *
 *   Two-step flow:
 *     Step 1 (input):   column-picker + value-input + (optional) >500 warning
 *                       → "Preview changes" button
 *     Step 2 (preview): shows up to 10 (rowId, column, oldValue → newValue)
 *                       diffs derived client-side via the parent-supplied
 *                       `getPreviewRows` callback.  Buttons: Cancel | Back |
 *                       Apply N Changes.  Only the Apply button fires the
 *                       actual mutation.
 *
 *   The preview is local-only (no BE call).  The "proposed new value" is
 *   literally the user-typed value — same value that would be written by
 *   `editor.handleCellEdit(rowId, column, value)`.  Future enhancement
 *   (registry-driven preview from rule expression) can plug into the same
 *   `getPreviewRows` callback shape without changing this component.
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
import { Loader2, Wand2, AlertTriangle, ArrowLeft, Eye } from 'lucide-react'

/** One row of the change preview table.  `oldValue` is read from the live
 *  grid (with edit overlay) by the parent's `getPreviewRows`.  `newValue`
 *  is the literal value the user typed — same value the BE will receive. */
export interface BulkApplyPreviewRow {
  rowId: string
  column: string
  oldValue: string
  newValue: string
}

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
  /** W5B-2: parent-supplied preview builder.  Called when the user clicks
   *  "Preview changes".  Should return a small (≤10) sample of selected rows
   *  with their current (old) value for the chosen column.  Dialog tacks on
   *  the user-typed newValue.  Parent reads cell values via the AG Grid
   *  row-node cache + editor.getCellValue. */
  getPreviewRows?: (column: string, sampleSize: number) => BulkApplyPreviewRow[]
}

const LARGE_BATCH_THRESHOLD = 500
const PREVIEW_SAMPLE_SIZE = 10

export function QuarantineBulkApplyDialog({
  open,
  onOpenChange,
  editableColumns,
  selectedRowCount,
  onApply,
  applying = false,
  getPreviewRows,
}: QuarantineBulkApplyDialogProps) {
  const [column, setColumn] = useState<string>('')
  const [value, setValue] = useState<string>('')
  const [confirmLargeBatch, setConfirmLargeBatch] = useState<boolean>(false)
  // W5B-2: 'input' = column+value form, 'preview' = diff preview before fire.
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [previewRows, setPreviewRows] = useState<BulkApplyPreviewRow[]>([])

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
      setStep('input')
      setPreviewRows([])
    }
  }, [open, sortedColumns])

  const isLargeBatch = selectedRowCount > LARGE_BATCH_THRESHOLD
  const canPreview =
    !!column && (!isLargeBatch || confirmLargeBatch) && !applying

  /** Build the preview locally from parent-supplied row sampler and the
   *  user-typed value.  Each entry is `{ rowId, column, oldValue, newValue }`
   *  so the table can show a clean before/after diff. */
  const handleOpenPreview = () => {
    if (!column || !canPreview) return
    const sampler = getPreviewRows
    const rows = sampler ? sampler(column, PREVIEW_SAMPLE_SIZE) : []
    const enriched = rows.map((r) => ({ ...r, newValue: value }))
    setPreviewRows(enriched)
    setStep('preview')
  }

  const handleConfirm = async () => {
    if (!column || applying) return
    await onApply(column, value)
  }

  const handleBack = () => {
    if (applying) return
    setStep('input')
  }

  // The remainder count for the "...and N more" line in the preview table.
  const previewRemainder = Math.max(0, selectedRowCount - previewRows.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px]"
        data-testid="bulk-apply-dialog"
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2">
            {step === 'input' ? (
              <Wand2 className="h-4 w-4 text-blue-600" />
            ) : (
              <Eye className="h-4 w-4 text-blue-600" />
            )}
            {step === 'input' ? 'Apply value to all' : 'Preview changes'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'The chosen value will be written to every selected row for the chosen column. Review the preview before applying.'
              : `Review the first ${previewRows.length} of ${selectedRowCount.toLocaleString()} change${selectedRowCount === 1 ? '' : 's'} that will be written. Nothing has been saved yet.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="bulk-apply-column"
                className="text-xs font-medium"
              >
                Column
              </Label>
              <Select
                value={column}
                onValueChange={setColumn}
                disabled={applying}
              >
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
              <Label
                htmlFor="bulk-apply-value"
                className="text-xs font-medium"
              >
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
        )}

        {step === 'preview' && (
          <div
            className="space-y-3 py-2"
            data-testid="bulk-apply-preview-panel"
          >
            <div
              className="overflow-auto rounded border border-slate-200 bg-slate-50/40"
              style={{ maxHeight: 280 }}
            >
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-[1] bg-slate-100 text-[10.5px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Row</th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      Column
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      Old value
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      New value
                    </th>
                  </tr>
                </thead>
                <tbody data-testid="bulk-apply-preview-table-body">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-3 text-center text-slate-500"
                      >
                        Preview not available — values will still be applied to
                        {' '}
                        {selectedRowCount.toLocaleString()} row
                        {selectedRowCount === 1 ? '' : 's'}.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((r, i) => (
                      <tr
                        key={`${r.rowId}-${i}`}
                        className="border-t border-slate-200/70 align-top"
                        data-testid="bulk-apply-preview-row"
                      >
                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">
                          {r.rowId}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">
                          {r.column}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500 line-through">
                          {r.oldValue === '' ? '(empty)' : r.oldValue}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-slate-900">
                          {r.newValue === '' ? '(empty)' : r.newValue}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {previewRemainder > 0 && (
              <p
                className="text-[10.5px] text-muted-foreground"
                data-testid="bulk-apply-preview-remainder"
              >
                Showing {previewRows.length} of{' '}
                {selectedRowCount.toLocaleString()} — and{' '}
                {previewRemainder.toLocaleString()} more will receive the same
                value.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'preview' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={applying}
              data-testid="bulk-apply-back-button"
              className="h-7 text-xs"
            >
              <ArrowLeft className="h-3 w-3 mr-1.5" />
              Back
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={applying}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          {step === 'input' ? (
            <Button
              size="sm"
              onClick={handleOpenPreview}
              disabled={!canPreview}
              data-testid="bulk-apply-preview-button"
              className="h-7 text-xs"
            >
              <Eye className="h-3 w-3 mr-1.5" />
              Preview changes
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={applying}
              data-testid="bulk-apply-confirm-button"
              className="h-7 text-xs"
            >
              {applying ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3 mr-1.5" />
              )}
              Apply {selectedRowCount.toLocaleString()} change
              {selectedRowCount === 1 ? '' : 's'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QuarantineBulkApplyDialog
