/**
 * quarantine-custom-rule-dialog.tsx
 *
 * Dialog for applying an AI-generated transformation rule to ALL quarantined
 * cells across ALL columns. Two-phase flow:
 *   1. Generate & Preview  — sends loaded sample rows to the backend to generate
 *      the Python fix_row() function and preview a few before/after diffs.
 *   2. Apply to All        — server-side: backend paginates the full read model,
 *      applies the cached rule to every quarantined row, and saves the edits in
 *      etag-chained batches.
 *
 * No column selection — fix_row(row: dict) -> dict handles all columns at once.
 * Typing @ in the description opens a column-name autocomplete dropdown.
 */

'use client'

import { useState, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Wand2, Loader2, Code2, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import { applyColumnRule, applyColumnRuleAll } from '@/modules/files/api/file-quarantine-api'
import type { CrossRuleFix, QuarantineRow, QuarantineSession } from '@/modules/files/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuarantineCustomRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rows currently loaded in the editor (used for preview sample + column list) */
  rows: QuarantineRow[]
  uploadId: string
  authToken: string | null
  /** Active session — required for server-side apply-all */
  session: QuarantineSession | null
  /** Called after server-side apply-all so the editor can refresh */
  onApplied: (newEtag: string, rowsAffected: number) => void
}

// ─── @ mention token parser ───────────────────────────────────────────────────

/** Split description text into text / @mention segments for overlay highlighting. */
function parseDescriptionTokens(
  text: string
): Array<{ type: 'text' | 'mention'; value: string }> {
  const tokens: Array<{ type: 'text' | 'mention'; value: string }> = []
  const regex = /@\w*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    tokens.push({ type: 'mention', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return tokens
}

// Shared metrics so the mirror div and textarea stay in perfect sync
const TEXTAREA_STYLE: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  lineHeight: '1.5rem',
  padding: '0.625rem 0.75rem',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuarantineCustomRuleDialog({
  open,
  onOpenChange,
  rows,
  uploadId,
  authToken,
  session,
  onApplied,
}: QuarantineCustomRuleDialogProps) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyProgress, setApplyProgress] = useState(0)
  const [crossFixes, setCrossFixes] = useState<CrossRuleFix[] | null>(null)
  const [ruleCode, setRuleCode] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [debugInfo, setDebugInfo] = useState<any | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [applyDebug, setApplyDebug] = useState<any | null>(null)

  // ── @ mention autocomplete ─────────────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMention, setShowMention] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)

  /** Column names from loaded rows, stripped of DQ metadata columns */
  const columnNames = useMemo(() => {
    if (!rows.length) return []
    return Object.keys(rows[0]).filter(
      (k) =>
        !k.endsWith('_dq_status') &&
        !k.endsWith('_dq_fixed') &&
        !k.endsWith('_dq_quarantined') &&
        k !== 'row_id' &&
        !k.startsWith('row_')
    )
  }, [rows])

  const filteredColumns = useMemo(() => {
    const showAll = !mentionQuery || "all".startsWith(mentionQuery.toLowerCase())
    const base = mentionQuery
      ? columnNames.filter((c) => c.toLowerCase().includes(mentionQuery.toLowerCase()))
      : columnNames
    const cols = base.slice(0, showAll ? 7 : 8)
    return showAll ? ["all", ...cols] : cols
  }, [columnNames, mentionQuery])

  // ── Mention helpers ────────────────────────────────────────────────

  const closeMention = () => {
    setShowMention(false)
    setMentionStart(-1)
    setMentionQuery('')
  }

  const insertColumn = (colName: string) => {
    if (mentionStart < 0) return
    // Replace "@query" with "@colName" — keep the @ so the highlight stays
    const before = description.slice(0, mentionStart)
    const after = description.slice(mentionStart + 1 + mentionQuery.length)
    const newText = before + '@' + colName + after
    setDescription(newText)
    closeMention()
    // Restore cursor right after the inserted @name
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = mentionStart + 1 + colName.length // +1 for the @
        textareaRef.current.setSelectionRange(pos, pos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  // ── Change / key handlers ──────────────────────────────────────────

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setDescription(val)
    setCrossFixes(null)
    setError(null)
    setSuccessCount(null)
    setDebugInfo(null)

    // Detect @ mention trigger: look for @ followed by word chars before cursor
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length)
      setMentionQuery(atMatch[1])
      setShowMention(true)
      setMentionIndex(0)
    } else {
      closeMention()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention navigation takes priority over all other keys
    if (showMention && filteredColumns.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => Math.min(i + 1, filteredColumns.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertColumn(filteredColumns[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMention()
        return
      }
    }
    // Cmd/Ctrl+Enter → generate
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleGenerate()
  }

  // Rows with at least one quarantined cell (for preview count)
  const quarantinedRows = rows.filter((row) =>
    Object.entries(row).some(
      ([k, v]) => k.endsWith('_dq_status') && String(v ?? '').toLowerCase() === 'quarantined'
    )
  )

  // ── Phase 1: Generate & Preview ───────────────────────────────────

  const handleGenerate = async () => {
    if (!description.trim() || !authToken) return
    setLoading(true)
    setCrossFixes(null)
    setRuleCode(null)
    setError(null)
    setSuccessCount(null)
    try {
      const result = await applyColumnRule(uploadId, authToken, {
        column: '',
        description: description.trim(),
        rows: quarantinedRows.map((row) => ({
          row_id: String(row.row_id),
          value: '',
          row: Object.fromEntries(
            Object.entries(row)
              .filter(([k]) => !k.endsWith('_dq_status') && k !== 'row_id')
              .map(([k, v]) => [k, String(v ?? '')])
          ),
        })),
      })
      setCrossFixes(result.cross_fixes ?? [])
      setRuleCode(result.rule_code)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((result as any)._debug) setDebugInfo((result as any)._debug)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI rule generation failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Phase 2: Apply to ALL rows (chunked, chains cursor across calls) ─

  const handleApplyAll = async () => {
    if (!session?.session_id || !authToken || !description.trim()) return
    setApplying(true)
    setApplyProgress(0)
    setError(null)
    setApplyDebug(null)

    let cursor: string | null | undefined = undefined
    let etag: string | undefined = undefined
    let totalFixed = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastDebug: any = null

    try {
      do {
        const result = await applyColumnRuleAll(uploadId, authToken, {
          column: '',
          description: description.trim(),
          session_id: session.session_id,
          cursor,
          if_match_etag: etag,
        })
        totalFixed += result.rows_affected
        cursor = result.next_cursor
        etag = result.new_etag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((result as any)._debug) lastDebug = (result as any)._debug
        setApplyProgress(totalFixed)
      } while (cursor)

      setSuccessCount(totalFixed)
      if (lastDebug) setApplyDebug(lastDebug)
      onApplied(etag ?? '', totalFixed)
      // Only auto-close when rows were actually changed; if 0, leave dialog open
      // so the user can see the diagnostic info.
      if (totalFixed > 0) setTimeout(handleClose, 1800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Apply to all failed')
    } finally {
      setApplying(false)
    }
  }

  const handleClose = () => {
    setCrossFixes(null)
    setRuleCode(null)
    setDescription('')
    setError(null)
    setShowCode(false)
    setSuccessCount(null)
    setApplyProgress(0)
    setApplyDebug(null)
    closeMention()
    onOpenChange(false)
  }

  // ── Derived values ────────────────────────────────────────────────

  const changedFixes = crossFixes?.filter((f) => f.fixed !== f.original) ?? []
  const sampleFixes = changedFixes.slice(0, 8)
  const canGenerate =
    Boolean(description.trim()) && quarantinedRows.length > 0 && !loading && !applying
  const canApplyAll =
    Boolean(description.trim()) && Boolean(session?.session_id) && !loading && !applying

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-violet-500 shrink-0" />
            AI Fix
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* ── Row count hint ─────────────────────────────────────── */}
          <p className="text-xs text-muted-foreground">
            {quarantinedRows.length > 0
              ? `${quarantinedRows.length} quarantined ${quarantinedRows.length === 1 ? 'row' : 'rows'} loaded for preview`
              : 'No quarantined rows loaded yet — scroll the grid to load rows, then preview'}
          </p>

          {/* ── Description textarea with @ mention ────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Describe the fix</label>
            {/*
              Overlay technique: the wrapper provides border + bg.
              An absolutely-positioned mirror div renders the same text with
              @mention tokens highlighted; all non-mention text is transparent
              so only the violet chip backgrounds show through.
              The real textarea floats on top with bg-transparent so highlights
              are visible behind the typed text.
            */}
            <div className="relative rounded-lg border border-violet-200 bg-violet-50/40 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-violet-400 focus-within:bg-white">
              {/* Mirror — highlight backgrounds only, all text is invisible */}
              <div
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none"
                style={TEXTAREA_STYLE}
              >
                {parseDescriptionTokens(description).map((token, i) =>
                  token.type === 'mention' ? (
                    <mark
                      key={i}
                      style={{
                        background: 'rgb(221 214 254 / 0.8)',
                        color: 'transparent',
                        borderRadius: '4px',
                        padding: '1px 3px',
                      }}
                    >
                      {token.value}
                    </mark>
                  ) : (
                    <span key={i} style={{ color: 'transparent' }}>
                      {token.value}
                    </span>
                  )
                )}
                {/* sentinel keeps mirror height in sync with textarea */}
                <span style={{ color: 'transparent' }}>{'\u200b'}</span>
              </div>

              {/* Real textarea — transparent bg so mirror shows through */}
              <textarea
                ref={textareaRef}
                value={description}
                onChange={handleDescriptionChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  setTimeout(closeMention, 150)
                }}
                placeholder={`e.g. "If @CREATED_TS is after @UPDATED_TS, set @CREATED_TS to one day before" — type @ to insert a column`}
                className="relative w-full min-h-[90px] bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground/50"
                style={{ ...TEXTAREA_STYLE, caretColor: 'currentColor' }}
              />

              {/* @ mention dropdown */}
              {showMention && filteredColumns.length > 0 && (
                <div className="absolute left-0 z-50 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                  {/* header */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/50">
                    <span className="text-[11px] font-semibold text-violet-600 bg-violet-100 rounded px-1 leading-5">@</span>
                    <span className="text-[11px] text-muted-foreground">
                      {mentionQuery ? `Columns matching "${mentionQuery}"` : 'Insert column name'}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground/60">↑↓ navigate · ↵ insert</span>
                  </div>
                  {/* items */}
                  <div className="max-h-[150px] overflow-y-auto py-0.5">
                    {filteredColumns.map((col, idx) => (
                      <button
                        key={col}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          insertColumn(col)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors ${
                          idx === mentionIndex
                            ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          idx === mentionIndex ? 'bg-violet-500' : 'bg-muted-foreground/30'
                        }`} />
                        {col === 'all' ? <span className="text-violet-600 font-semibold">all <span className="font-normal text-muted-foreground">— all columns</span></span> : col}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cmd/Ctrl+Enter to preview · Type{' '}
              <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">@</kbd>{' '}
              to insert a column name
            </p>
          </div>

          {/* ── Error ─────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ── Success / Warning after apply-all ─────────────────── */}
          {successCount !== null && successCount > 0 && (
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Applied to {successCount} {successCount === 1 ? 'row' : 'rows'} successfully.
            </div>
          )}
          {successCount === 0 && !applying && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No rows were changed. The rule may not match any quarantined values.
              </div>
              {applyDebug && (
                <div className="text-xs font-mono text-amber-900 space-y-0.5">
                  <div>Rows fetched: <span className="font-semibold">{applyDebug.page_rows_count ?? '?'}</span> · passed filter: <span className="font-semibold">{applyDebug.filtered_input_count ?? '?'}</span> · fixes generated: <span className="font-semibold">{applyDebug.cross_fixes_count ?? '?'}</span></div>
                  {applyDebug.base_upload_id_used && (
                    <div className="text-[10px] opacity-70">version: {applyDebug.base_upload_id_used}</div>
                  )}
                </div>
              )}
              <p className="text-xs text-amber-700">
                Try refining your description — use <kbd className="px-1 py-0.5 rounded bg-amber-100 border border-amber-200 text-[10px] font-mono">@COLUMN</kbd> to reference a specific column.
              </p>
            </div>
          )}

          {/* ── Preview (from loaded sample rows) ─────────────────── */}
          {crossFixes !== null && !loading && successCount === null && (
            <div className="rounded-md border overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                <span className="text-xs font-semibold">Preview (sample)</span>
                <span className="text-xs text-muted-foreground">
                  {changedFixes.length} cell {changedFixes.length === 1 ? 'change' : 'changes'} in
                  loaded rows
                </span>
              </div>

              {/* Sample diffs */}
              {sampleFixes.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-muted-foreground italic">
                  No changes in loaded sample — all rows may still be processed server-side.
                </p>
              ) : (
                <div className="divide-y">
                  {sampleFixes.map((fix, idx) => (
                    <div
                      key={`${fix.row_id}-${fix.column}-${idx}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono"
                    >
                      <span className="text-muted-foreground w-[90px] shrink-0 truncate" title={fix.column}>
                        {fix.column}
                      </span>
                      <span
                        className="text-red-600 line-through max-w-[130px] truncate"
                        title={fix.original}
                      >
                        {fix.original || <em className="not-italic opacity-50">(empty)</em>}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-green-700 max-w-[130px] truncate" title={fix.fixed}>
                        {fix.fixed || <em className="not-italic opacity-50">(empty)</em>}
                      </span>
                    </div>
                  ))}
                  {changedFixes.length > 8 && (
                    <p className="px-3 py-1.5 text-xs text-muted-foreground">
                      …and {changedFixes.length - 8} more in loaded sample
                    </p>
                  )}
                </div>
              )}

              {/* Generated rule code (collapsible) */}
              {ruleCode && (
                <div className="border-t">
                  <button
                    type="button"
                    onClick={() => setShowCode((v) => !v)}
                    className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    {showCode ? 'Hide' : 'Show'} generated rule
                  </button>
                  {showCode && (
                    <pre className="px-3 pb-3 text-[11px] font-mono bg-muted/30 whitespace-pre-wrap break-all">
                      {ruleCode}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Debug info (only shown when 0 changes detected) ──────── */}
          {debugInfo && (
            <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-amber-800">Diagnostic (0 changes — checking date parsing)</p>
              {debugInfo.first_row_date_cols &&
                Object.entries(
                  debugInfo.first_row_date_cols as Record<string, { raw: string; parsed: string }>
                ).map(([col, info]) => (
                  <div key={col} className="font-mono text-amber-900">
                    <span className="font-semibold">{col}:</span> raw=&ldquo;{info.raw}&rdquo; → parsed={info.parsed}
                  </div>
                ))}
              {debugInfo.exec_errors &&
                (debugInfo.exec_errors as string[]).map((e, i) => (
                  <div key={i} className="text-red-700 font-mono">{e}</div>
                ))}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={loading || applying}>
            Cancel
          </Button>

          {/* Hide action buttons only after a successful apply (successCount > 0) */}
          {(successCount === null || successCount === 0) && (
            <>
              {/* Phase 1 — Preview is always required first */}
              {crossFixes === null ? (
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={!canGenerate}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-1.5" />
                      Generate &amp; Preview
                    </>
                  )}
                </Button>
              ) : (
                /* Phase 2 — Apply to All only appears after preview */
                <Button
                  onClick={() => void handleApplyAll()}
                  disabled={!canApplyAll}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      {applyProgress > 0 ? `Applying… ${applyProgress} fixed` : 'Applying…'}
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-1.5" />
                      Apply to All
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
