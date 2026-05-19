/**
 * quarantine-skipped-rows-panel.tsx
 *
 * Inspector panel for the K2 `Skipped` tab of the async F&R flow.
 *
 * Renders the `skipped_rows` array returned by the async operation poll
 * with per-row reason chips, click-to-scroll into the AG-Grid table, and a
 * CSV export button that dumps the list as
 * `<filename>_skipped_<timestamp>.csv`.
 */

'use client'

import { useMemo } from 'react'
import { Download, FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Backend reason strings collapse into 4 UI categories. */
export type SkippedReason = 'LOCKED' | 'PUSHED_TO_ERP' | 'READ_ONLY_RULE' | 'OTHER'

export interface SkippedRow {
  row_id: string
  reason: string
  column?: string | null
}

interface QuarantineSkippedRowsPanelProps {
  rows: SkippedRow[]
  /** Optional filename stem for the CSV export (defaults to "quarantine"). */
  filenameStem?: string
  /** Fires when a row chip is clicked — editor scrolls AG-Grid to row_id. */
  onScrollToRow?: (rowId: string) => void
}

/** Maps the raw backend reason string into one of the four UI buckets. */
export function classifySkippedReason(raw: string | undefined | null): SkippedReason {
  const s = String(raw ?? '').toLowerCase()
  if (s.includes('lock')) return 'LOCKED'
  if (s.includes('push') || s.includes('erp') || s.includes('export')) return 'PUSHED_TO_ERP'
  if (s.includes('read_only') || s.includes('read-only') || s.includes('readonly') || s.includes('rule')) {
    return 'READ_ONLY_RULE'
  }
  return 'OTHER'
}

const CHIP_STYLES: Record<SkippedReason, string> = {
  LOCKED: 'bg-amber-100 text-amber-800 border-amber-300',
  PUSHED_TO_ERP: 'bg-sky-100 text-sky-800 border-sky-300',
  READ_ONLY_RULE: 'bg-violet-100 text-violet-800 border-violet-300',
  OTHER: 'bg-muted text-muted-foreground border-border',
}

/** Builds the CSV body for the skipped rows. Exposed for unit tests. */
export function buildSkippedRowsCsv(rows: SkippedRow[]): string {
  const header = 'row_id,column,reason,category'
  const lines = rows.map((r) => {
    const cat = classifySkippedReason(r.reason)
    const cells = [r.row_id, r.column ?? '', r.reason ?? '', cat].map((v) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    })
    return cells.join(',')
  })
  return [header, ...lines].join('\n')
}

export function QuarantineSkippedRowsPanel({
  rows,
  filenameStem = 'quarantine',
  onScrollToRow,
}: QuarantineSkippedRowsPanelProps) {
  const counts = useMemo(() => {
    const c: Record<SkippedReason, number> = {
      LOCKED: 0, PUSHED_TO_ERP: 0, READ_ONLY_RULE: 0, OTHER: 0,
    }
    rows.forEach((r) => { c[classifySkippedReason(r.reason)] += 1 })
    return c
  }, [rows])

  const handleExport = () => {
    const csv = buildSkippedRowsCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `${filenameStem}_skipped_${ts}.csv`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  if (rows.length === 0) {
    return (
      <div
        data-testid="skipped-rows-panel-empty"
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
      >
        <FileX className="h-3 w-3" /> No rows skipped.
      </div>
    )
  }

  return (
    <div data-testid="skipped-rows-panel" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {rows.length.toLocaleString()} skipped
        </span>
        <Button
          data-testid="skipped-rows-export-btn"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px]"
          onClick={handleExport}
        >
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 text-[9px]">
        {(['LOCKED', 'PUSHED_TO_ERP', 'READ_ONLY_RULE', 'OTHER'] as SkippedReason[])
          .filter((k) => counts[k] > 0)
          .map((k) => (
            <span
              key={k}
              className={`px-1.5 py-0.5 rounded border ${CHIP_STYLES[k]}`}
            >
              {k} · {counts[k]}
            </span>
          ))}
      </div>
      <ul className="max-h-36 overflow-auto space-y-0.5 text-[10px]">
        {rows.slice(0, 200).map((r, i) => {
          const cat = classifySkippedReason(r.reason)
          return (
            <li
              key={`${r.row_id}-${i}`}
              data-testid="skipped-row-item"
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => onScrollToRow?.(r.row_id)}
                className="font-mono truncate hover:underline text-left"
                title={`Scroll to row ${r.row_id}`}
              >
                {r.row_id}
              </button>
              <span
                data-testid={`skipped-row-chip-${cat}`}
                className={`px-1 rounded text-[9px] border ${CHIP_STYLES[cat]}`}
              >
                {cat}
              </span>
              {r.reason && r.reason.toLowerCase() !== cat.toLowerCase() && (
                <span className="text-muted-foreground truncate">— {r.reason}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
