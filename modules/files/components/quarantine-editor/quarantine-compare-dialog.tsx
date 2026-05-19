/**
 * quarantine-compare-dialog.tsx
 *
 * Side-by-side row diff (Original vs Cleaned) for the Quarantine Editor.
 *
 * UI-only: reads from rows that the editor already loaded into AG Grid.
 * The backend ships post-DQ values plus `{col}_dq_status` and a row-level
 * `fixes_applied` rule list — it does NOT ship a pre-DQ snapshot of cell
 * values. So:
 *   - For cells the user edited locally we DO have the prior value (the
 *     server-shipped value before our edits), so we render a real diff.
 *   - For cells the engine auto-fixed we render "(no change recorded)" on
 *     the original side, with the matching `fixes_applied` rule as caption,
 *     because no pre-fix value is available client-side.
 *   - For clean/quarantined cells we show the same value on both sides.
 *
 * Stays read-only — no save / edit handlers.
 */

'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import type { QuarantineRow } from '@/modules/files/types'

export interface QuarantineCompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: QuarantineRow[]
  /** Visible (non-meta) columns for the editor, e.g. ['row_id', 'CUSTOMER_NAME', ...] */
  columns: string[]
  /**
   * Effective value getter (pending edit > saved edit > server value).
   * Same function the AG Grid uses, so the "Cleaned" pane mirrors the grid.
   */
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any
  /** True when the user has a pending in-memory edit on this cell. */
  isCellEdited: (rowId: string, column: string) => boolean
}

interface CellDiff {
  column: string
  /** Pre-DQ value when known, else null. */
  original: string | null
  /** Current effective (post-DQ + post-edit) value. */
  cleaned: string
  /** clean | fixed | quarantined | edited | unknown */
  status: string
  /** True when we surface a meaningful diff (changed by user or engine). */
  changed: boolean
  /** True when the original value isn't reachable client-side. */
  originalUnknown: boolean
  /** Engine fix rules that touched this column (from row.fixes_applied). */
  fixRules: string[]
}

function formatCellValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Pull rule names that mention `column` out of a `fixes_applied` string of the
 * form "TRIM_WS (CUSTOMER_NAME); UPPERCASE (CUSTOMER_NAME); ...".
 */
function extractFixRulesForColumn(raw: string, column: string): string[] {
  if (!raw) return []
  const lower = column.toLowerCase()
  return raw
    .split(';')
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false
      const t = token.toLowerCase()
      return (
        t.includes(`(${lower})`) ||
        t.startsWith(`${lower}:`) ||
        t.startsWith(`${lower} :`) ||
        t.startsWith(`${lower}=`)
      )
    })
    // Strip "(ColumnName)" suffix — redundant in a per-column view.
    .map((token) => token.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean)
}

function buildRowDiff(
  row: QuarantineRow,
  columns: string[],
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any,
  isCellEdited: (rowId: string, column: string) => boolean,
): CellDiff[] {
  const rowId = String(row.row_id ?? '')
  const fixesAppliedRaw = String(row.fixes_applied ?? '')

  return columns
    .filter((c) => c !== 'row_id')
    .map<CellDiff>((column) => {
      const cleanedRaw = getCellValue(rowId, column, row)
      const cleaned = formatCellValue(cleanedRaw)
      const status = String(row[`${column}_dq_status`] ?? 'unknown').toLowerCase()
      const fixRules = extractFixRulesForColumn(fixesAppliedRaw, column)

      // Pending or saved user edit: row[column] is still the server value
      // before our edits because the AG Grid valueGetter overlays edits via
      // getCellValue, and the underlying row record isn't mutated in-place
      // for new edits. So we have a real diff.
      if (isCellEdited(rowId, column)) {
        const serverValue = formatCellValue(row[column])
        return {
          column,
          original: serverValue,
          cleaned,
          status: 'edited',
          changed: serverValue !== cleaned,
          originalUnknown: false,
          fixRules,
        }
      }

      if (status === 'fixed') {
        // Engine auto-fixed this cell. We have the post-fix value (= cleaned),
        // and we know which rules ran (fixRules), but no pre-fix raw value.
        return {
          column,
          original: null,
          cleaned,
          status,
          changed: true,
          originalUnknown: true,
          fixRules,
        }
      }

      // clean, quarantined, or unknown — value is unchanged client-side.
      return {
        column,
        original: cleaned,
        cleaned,
        status,
        changed: false,
        originalUnknown: false,
        fixRules,
      }
    })
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'fixed':
      return 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400'
    case 'edited':
      return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-400'
    case 'quarantined':
      return 'border-red-400/40 bg-red-400/10 text-red-800'
    case 'clean':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

export function QuarantineCompareDialog({
  open,
  onOpenChange,
  rows,
  columns,
  getCellValue,
  isCellEdited,
}: QuarantineCompareDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset to first row whenever the dialog reopens with a new row set.
  useEffect(() => {
    if (open) setActiveIndex(0)
  }, [open, rows])

  const total = rows.length
  const safeIndex = total === 0 ? 0 : Math.min(activeIndex, total - 1)
  const activeRow = total > 0 ? rows[safeIndex] : null

  const diffs = useMemo(() => {
    if (!activeRow) return []
    return buildRowDiff(activeRow, columns, getCellValue, isCellEdited)
  }, [activeRow, columns, getCellValue, isCellEdited])

  const changedCount = diffs.filter((d) => d.changed).length
  const totalEditableCount = diffs.length

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1))
  const goNext = () => setActiveIndex((i) => Math.min(total - 1, i + 1))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold">
                Compare row {activeRow ? <span className="font-mono text-sm text-muted-foreground">#{String(activeRow.row_id)}</span> : null}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {activeRow
                  ? `${changedCount} of ${totalEditableCount} columns changed`
                  : 'No row selected'}
              </DialogDescription>
            </div>
            {total > 1 && (
              <div className="flex items-center gap-1.5 pr-8">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safeIndex === 0}
                  onClick={goPrev}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums px-1">
                  Compare {safeIndex + 1} of {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safeIndex >= total - 1}
                  onClick={goNext}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {!activeRow ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No row available to compare. Click a row in the grid first.
            </div>
          ) : diffs.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              This row has no comparable columns.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card border-b z-10">
                <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="text-left px-4 py-2 w-[22%]">Column</th>
                  <th className="text-left px-4 py-2 w-[36%]">Original</th>
                  <th className="w-6"></th>
                  <th className="text-left px-4 py-2 w-[36%]">Cleaned</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((d) => {
                  const rowBg = d.changed ? 'bg-amber-100/70' : ''
                  return (
                    <tr key={d.column} className={`border-b border-border/60 ${rowBg}`}>
                      <td className="align-top px-4 py-2.5">
                        <div className="font-medium text-foreground">{d.column}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[9.5px] px-1.5 py-0 h-4 font-medium uppercase tracking-wide ${statusBadgeClass(
                              d.status,
                            )}`}
                          >
                            {d.status}
                          </Badge>
                        </div>
                        {d.fixRules.length > 0 && (
                          <div className="mt-1 text-[10px] text-muted-foreground leading-snug">
                            {d.fixRules.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="align-top px-4 py-2.5">
                        {d.originalUnknown ? (
                          <span className="italic text-muted-foreground/70">
                            (no change recorded)
                          </span>
                        ) : (
                          <span className="font-mono break-all whitespace-pre-wrap text-foreground/90">
                            {d.original ?? ''}
                          </span>
                        )}
                      </td>
                      <td className="align-top pt-3 text-muted-foreground/60">
                        {d.changed ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                      </td>
                      <td className="align-top px-4 py-2.5">
                        <span
                          className={`font-mono break-all whitespace-pre-wrap ${
                            d.changed ? 'text-foreground font-medium' : 'text-foreground/90'
                          }`}
                        >
                          {d.cleaned}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Read-only view. Use the grid to make further edits.</span>
          <Button variant="outline" size="sm" className="h-7" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
