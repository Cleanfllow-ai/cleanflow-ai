/**
 * quarantine-version-compare-dialog.tsx
 *
 * Between-VERSIONS comparison for the Quarantine Editor.
 *
 * NOTE: this is intentionally a SEPARATE dialog from `quarantine-compare-dialog.tsx`,
 * which does row-level (Original vs Cleaned) diff inside a single version. This
 * one diffs two snapshots of the SAME file across versions: v1 vs v2, v2 vs v3, etc.
 *
 * Backend contract used:
 *   POST /files/{id}/quarantined/query
 *   body: { version: <upload_id of target version>, cursor, limit }
 *   The `version` field accepts an arbitrary version's upload_id (not just "latest").
 *   See contexts/remediation/application/use_cases/_versioning.py:resolve_version_item.
 *
 * Caveat: this endpoint returns only the QUARANTINED rows of each version. So the
 * comparison is rows-quarantined-in-A vs rows-quarantined-in-B keyed by row_id.
 *   - "removed" = quarantined in A, not in B (likely cleaned/fixed in B)
 *   - "added"   = quarantined in B, not in A (regression or new quarantine)
 *   - "changed" = quarantined in both, but at least one cell value differs
 *   - "identical" = quarantined in both with same values for all displayed cols
 *
 * The dialog is read-only.
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { queryQuarantinedRows } from '@/modules/files/api'
import type { FileVersionSummary, QuarantineRow } from '@/modules/files/types'

const ROWS_PER_PAGE = 50
const FETCH_LIMIT = 500
const MAX_PAGES = 10 // safety cap; ROWS_PER_PAGE * MAX_PAGES = 5000 rows per version

type DiffStatus = 'changed' | 'added' | 'removed' | 'identical'

interface RowDiff {
  rowId: string
  status: DiffStatus
  /** Columns whose cell value differs between A and B. Empty for added/removed. */
  changedColumns: string[]
  rowA: QuarantineRow | null
  rowB: QuarantineRow | null
}

export interface QuarantineVersionCompareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploadId: string
  authToken: string | null
  /** Sorted ascending by version_number. */
  lineage: FileVersionSummary[]
  /** Visible (non-meta) columns to show in the diff. */
  columns: string[]
}

function normalizeCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function statusBadgeClass(status: DiffStatus): string {
  switch (status) {
    case 'added':
      return 'border-emerald-500/40 bg-emerald-1000/10 text-emerald-800'
    case 'removed':
      return 'border-red-500/40 bg-red-1000/10 text-red-800'
    case 'changed':
      return 'border-amber-500/40 bg-amber-1000/10 text-amber-800'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function statusRowClass(status: DiffStatus): string {
  switch (status) {
    case 'added':
      return 'bg-emerald-100/60'
    case 'removed':
      return 'bg-red-100/60'
    case 'changed':
      return 'bg-amber-100/40'
    default:
      return ''
  }
}

async function loadAllRows(
  uploadId: string,
  authToken: string,
  versionUploadId: string,
): Promise<{ rows: QuarantineRow[]; capped: boolean }> {
  const acc: QuarantineRow[] = []
  let cursor: string | undefined
  let capped = false
  for (let i = 0; i < MAX_PAGES; i++) {
    const resp = await queryQuarantinedRows(uploadId, authToken, {
      version: versionUploadId,
      // session_id intentionally omitted: cross-version peek; the active
      // session is bound to a single base_upload_id and would 409 otherwise.
      cursor,
      limit: FETCH_LIMIT,
    })
    const rows = resp.rows || []
    acc.push(...rows)
    if (!resp.next_cursor) break
    cursor = String(resp.next_cursor)
    // If we've exhausted MAX_PAGES and the server still has more rows,
    // mark capped so the dialog can warn the user that the diff is partial.
    if (i === MAX_PAGES - 1 && resp.next_cursor) capped = true
  }
  return { rows: acc, capped }
}

function buildDiff(
  aRows: QuarantineRow[],
  bRows: QuarantineRow[],
  columns: string[],
): RowDiff[] {
  const aMap = new Map<string, QuarantineRow>()
  const bMap = new Map<string, QuarantineRow>()
  for (const r of aRows) aMap.set(String(r.row_id), r)
  for (const r of bRows) bMap.set(String(r.row_id), r)

  const allIds = new Set<string>([...aMap.keys(), ...bMap.keys()])
  const diffColumns = columns.filter((c) => c !== 'row_id')
  const ids = Array.from(allIds).sort((x, y) => {
    const nx = Number(x)
    const ny = Number(y)
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny
    return x.localeCompare(y)
  })

  const out: RowDiff[] = []
  for (const id of ids) {
    const a = aMap.get(id) || null
    const b = bMap.get(id) || null
    if (a && !b) {
      out.push({ rowId: id, status: 'removed', changedColumns: [], rowA: a, rowB: null })
      continue
    }
    if (!a && b) {
      out.push({ rowId: id, status: 'added', changedColumns: [], rowA: null, rowB: b })
      continue
    }
    if (a && b) {
      const changedColumns = diffColumns.filter(
        (c) => normalizeCell(a[c]) !== normalizeCell(b[c]),
      )
      out.push({
        rowId: id,
        status: changedColumns.length > 0 ? 'changed' : 'identical',
        changedColumns,
        rowA: a,
        rowB: b,
      })
    }
  }
  return out
}

export function QuarantineVersionCompareDialog({
  open,
  onOpenChange,
  uploadId,
  authToken,
  lineage,
  columns,
}: QuarantineVersionCompareDialogProps) {
  // Sort once for the pickers; lineage prop is already ascending.
  const sortedLineage = useMemo(
    () => [...lineage].sort((x, y) => (x.version_number || 0) - (y.version_number || 0)),
    [lineage],
  )

  const defaultA = sortedLineage[0]?.upload_id ?? ''
  const defaultB = sortedLineage[sortedLineage.length - 1]?.upload_id ?? defaultA

  const [versionA, setVersionA] = useState(defaultA)
  const [versionB, setVersionB] = useState(defaultB)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aRows, setARows] = useState<QuarantineRow[] | null>(null)
  const [bRows, setBRows] = useState<QuarantineRow[] | null>(null)
  // Sides whose row fetch hit the safety cap (5000 rows). Surfaced as a
  // warning so users don't mistake a partial diff for a complete one.
  const [cappedSides, setCappedSides] = useState<('A' | 'B')[]>([])

  // Reset selection whenever the dialog reopens with a fresh lineage.
  useEffect(() => {
    if (!open) return
    setVersionA(defaultA)
    setVersionB(defaultB)
    setPage(0)
    setShowUnchanged(false)
    setError(null)
    setARows(null)
    setBRows(null)
    setCappedSides([])
  }, [open, defaultA, defaultB])

  // Fetch rows for both versions whenever picker selection changes.
  useEffect(() => {
    if (!open || !authToken || !versionA || !versionB) return
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch in parallel; both endpoints are independent.
        const [a, b] = await Promise.all([
          loadAllRows(uploadId, authToken, versionA),
          loadAllRows(uploadId, authToken, versionB),
        ])
        if (cancelled) return
        setARows(a.rows)
        setBRows(b.rows)
        const capped: ('A' | 'B')[] = []
        if (a.capped) capped.push('A')
        if (b.capped) capped.push('B')
        setCappedSides(capped)
        setPage(0)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || 'Failed to load version data')
        setARows(null)
        setBRows(null)
        setCappedSides([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [open, authToken, uploadId, versionA, versionB])

  const diff = useMemo(() => {
    if (!aRows || !bRows) return [] as RowDiff[]
    return buildDiff(aRows, bRows, columns)
  }, [aRows, bRows, columns])

  const filteredDiff = useMemo(
    () => (showUnchanged ? diff : diff.filter((d) => d.status !== 'identical')),
    [diff, showUnchanged],
  )

  const totalDiffering = diff.filter((d) => d.status !== 'identical').length
  const totalRows = diff.length
  const affectedColumnSet = useMemo(() => {
    const s = new Set<string>()
    for (const d of diff) for (const c of d.changedColumns) s.add(c)
    return s
  }, [diff])

  const totalPages = Math.max(1, Math.ceil(filteredDiff.length / ROWS_PER_PAGE))
  const safePage = Math.min(page, totalPages - 1)
  const pagedDiff = useMemo(() => {
    const start = safePage * ROWS_PER_PAGE
    return filteredDiff.slice(start, start + ROWS_PER_PAGE)
  }, [filteredDiff, safePage])

  const labelFor = useCallback(
    (uid: string) => {
      const v = sortedLineage.find((x) => x.upload_id === uid)
      if (!v) return uid.slice(0, 8)
      return `v${v.version_number}${v.is_latest ? ' (latest)' : ''}`
    },
    [sortedLineage],
  )

  const sameVersion = versionA === versionB

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">Compare versions</DialogTitle>
          <DialogDescription className="text-xs">
            Diff quarantined rows between two versions of this file.
          </DialogDescription>
        </DialogHeader>

        {/* Pickers */}
        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Version A
            </Label>
            <Select value={versionA} onValueChange={setVersionA}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {sortedLineage.map((v) => (
                  <SelectItem key={v.upload_id} value={v.upload_id} className="text-xs">
                    v{v.version_number}
                    {v.is_latest ? ' (latest)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="h-4 w-4 mb-2 text-muted-foreground" />

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Version B
            </Label>
            <Select value={versionB} onValueChange={setVersionB}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {sortedLineage.map((v) => (
                  <SelectItem key={v.upload_id} value={v.upload_id} className="text-xs">
                    v{v.version_number}
                    {v.is_latest ? ' (latest)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="show-unchanged"
              checked={showUnchanged}
              onCheckedChange={setShowUnchanged}
            />
            <Label htmlFor="show-unchanged" className="text-xs cursor-pointer">
              Show unchanged rows
            </Label>
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-2 border-b text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading rows…
            </span>
          ) : sameVersion ? (
            <span>Pick two different versions to see a diff.</span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <>
              <span>
                <span className="font-semibold text-foreground tabular-nums">{totalDiffering.toLocaleString()}</span>{' '}
                of{' '}
                <span className="font-semibold text-foreground tabular-nums">{totalRows.toLocaleString()}</span>{' '}
                rows differ
              </span>
              <span>
                <span className="font-semibold text-foreground tabular-nums">
                  {affectedColumnSet.size.toLocaleString()}
                </span>{' '}
                columns affected
              </span>
              <span className="text-muted-foreground/70">
                {labelFor(versionA)} → {labelFor(versionB)}
              </span>
            </>
          )}
        </div>

        {/* Truncation warning — when either side hit the 5000-row safety cap,
            the diff is a partial view of the data. Make it loud so users
            don't mistake the partial diff for a complete reconciliation. */}
        {!loading && !error && cappedSides.length > 0 && (
          <div className="px-5 py-2 border-b bg-amber-1000/10 text-amber-800 dark:text-amber-400 text-xs flex items-center gap-2">
            <span aria-hidden>⚠</span>
            <span>
              Partial diff —{' '}
              {cappedSides.length === 2
                ? 'both versions'
                : `version ${cappedSides[0] === 'A' ? labelFor(versionA) : labelFor(versionB)}`}{' '}
              {cappedSides.length === 2 ? 'have' : 'has'} more than{' '}
              <span className="font-semibold">{(MAX_PAGES * FETCH_LIMIT).toLocaleString()}</span>{' '}
              quarantined rows. Showing the first{' '}
              {(MAX_PAGES * FETCH_LIMIT).toLocaleString()} per side; rows
              beyond that are not included in this comparison.
            </span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading version data…
            </div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center text-sm text-destructive">
              {error}
            </div>
          ) : sameVersion ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Select two different versions above.
            </div>
          ) : pagedDiff.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {showUnchanged
                ? 'No quarantined rows in either version.'
                : 'No row-level differences. Toggle "Show unchanged rows" to inspect identical rows.'}
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card border-b z-10">
                <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="text-left px-4 py-2 w-[10%]">Row</th>
                  <th className="text-left px-4 py-2 w-[10%]">Change</th>
                  <th className="text-left px-4 py-2 w-[20%]">Column</th>
                  <th className="text-left px-4 py-2 w-[30%]">{labelFor(versionA)}</th>
                  <th className="w-6"></th>
                  <th className="text-left px-4 py-2 w-[30%]">{labelFor(versionB)}</th>
                </tr>
              </thead>
              <tbody>
                {pagedDiff.flatMap((d) => {
                  const rowBg = statusRowClass(d.status)
                  if (d.status === 'added' || d.status === 'removed' || d.status === 'identical' || d.changedColumns.length === 0) {
                    return [
                      <tr key={d.rowId} className={`border-b border-border/60 ${rowBg}`}>
                        <td className="align-top px-4 py-2.5 font-mono text-foreground/80">
                          #{d.rowId}
                        </td>
                        <td className="align-top px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-[9.5px] px-1.5 py-0 h-4 font-medium uppercase tracking-wide ${statusBadgeClass(d.status)}`}
                          >
                            {d.status}
                          </Badge>
                        </td>
                        <td className="align-top px-4 py-2.5 italic text-muted-foreground/70" colSpan={4}>
                          {d.status === 'added' && 'Row appeared in B (was not quarantined in A)'}
                          {d.status === 'removed' && 'Row disappeared in B (was quarantined in A)'}
                          {d.status === 'identical' && 'No cell values changed'}
                          {d.status === 'changed' && d.changedColumns.length === 0 && 'No cell values changed'}
                        </td>
                      </tr>,
                    ]
                  }
                  // changed: emit one sub-row per differing column
                  return d.changedColumns.map((col, idx) => (
                    <tr key={`${d.rowId}:${col}`} className={`border-b border-border/60 ${rowBg}`}>
                      <td className="align-top px-4 py-2.5 font-mono text-foreground/80">
                        {idx === 0 ? `#${d.rowId}` : ''}
                      </td>
                      <td className="align-top px-4 py-2.5">
                        {idx === 0 ? (
                          <Badge
                            variant="outline"
                            className={`text-[9.5px] px-1.5 py-0 h-4 font-medium uppercase tracking-wide ${statusBadgeClass(d.status)}`}
                          >
                            {d.status}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="align-top px-4 py-2.5 font-medium text-foreground">{col}</td>
                      <td className="align-top px-4 py-2.5 font-mono break-all whitespace-pre-wrap text-foreground/80">
                        {normalizeCell(d.rowA?.[col])}
                      </td>
                      <td className="align-top pt-3 text-muted-foreground/60">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </td>
                      <td className="align-top px-4 py-2.5 font-mono break-all whitespace-pre-wrap font-medium text-foreground">
                        {normalizeCell(d.rowB?.[col])}
                      </td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Read-only view. Showing rows from each version's quarantined snapshot.
          </span>
          <div className="flex items-center gap-2">
            {filteredDiff.length > ROWS_PER_PAGE && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safePage === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-medium tabular-nums px-1">
                  Page {safePage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={safePage >= totalPages - 1 || loading}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="h-7" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
