/**
 * quarantine-find-replace-panel.tsx
 *
 * Floating overlay panel for Find & Replace in the quarantine editor.
 * Anchored to top-right of the grid area.
 */

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronUp, ChevronDown, Search, Replace, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useQuarantineFindReplace } from '@/modules/files/hooks/use-quarantine-find-replace'

interface QuarantineFindReplacePanelProps {
  searchTerm: string
  replaceTerm: string
  column: string | null
  matchCase: boolean
  totalMatches: number
  currentIndex: number
  /** Legacy field; cursor-mode v2 always sets this false. */
  truncated: boolean
  loading: boolean
  columns: string[]
  /** True when Find has a `next_cursor` and more matches are paginatable. */
  hasMoreMatches?: boolean
  /** Row ids whose matches are on locked rows (informational badge). */
  lockedRowIds?: string[]

  onSearchTermChange: (value: string) => void
  onReplaceTermChange: (value: string) => void
  onColumnChange: (column: string | null) => void
  onMatchCaseChange: (matchCase: boolean) => void
  onNext: () => void
  onPrevious: () => void
  onReplaceCurrent: () => void
  /** Returns `{ replaced, skipped }` after the chained server call.
   *  Used as the sync fallback when `uploadId` + `authToken` are not
   *  provided (back-compat). */
  onReplaceAll: () => Promise<{ replaced: number; skipped: number } | number>
  onClose: () => void

  // ── Async F&R opt-in (Phase 3D — operations poll wiring) ──────────────
  /** When present alongside `authToken`, Replace All goes async via
   *  `useQuarantineFindReplace`. Falls back to `onReplaceAll` otherwise. */
  uploadId?: string
  authToken?: string | null
  sessionId?: string
  sessionEtag?: string
  filters?: unknown
  /** Whole-quarantine scope override. Defaults to ENTIRE_QUARANTINE which
   *  forces the async worker path (see backend `_use_async` guard). */
  asyncScope?: 'ENTIRE_QUARANTINE' | 'column' | 'row'
  /** Callback fired once the async op terminates (so the editor can
   *  refresh the grid + etag). */
  onAsyncComplete?: (result: { applied: number; skipped: number; failed: number }) => void
}

export function QuarantineFindReplacePanel({
  searchTerm,
  replaceTerm,
  column,
  matchCase,
  totalMatches,
  currentIndex,
  truncated,
  loading,
  columns,
  hasMoreMatches,
  lockedRowIds,
  onSearchTermChange,
  onReplaceTermChange,
  onColumnChange,
  onMatchCaseChange,
  onNext,
  onPrevious,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
  uploadId,
  authToken,
  sessionId,
  sessionEtag,
  filters,
  asyncScope = 'ENTIRE_QUARANTINE',
  onAsyncComplete,
}: QuarantineFindReplacePanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [replaceAllCount, setReplaceAllCount] = useState<number | null>(null)
  const [skippedCount, setSkippedCount] = useState<number>(0)
  const [replacing, setReplacing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const asyncEnabled = !!uploadId && !!authToken
  const asyncHook = useQuarantineFindReplace({
    uploadId: uploadId ?? '',
    authToken: authToken ?? null,
  })
  const { state: asyncState, submitAndPoll, reset: resetAsync } = asyncHook
  const isAsyncRunning =
    asyncEnabled &&
    (asyncState.status === 'submitting' ||
      asyncState.status === 'PENDING' ||
      asyncState.status === 'RUNNING')
  const summary = asyncState.result
  const [activeTab, setActiveTab] = useState<'applied' | 'skipped' | 'failed'>('applied')

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Clear replace count after 3 seconds
  useEffect(() => {
    if (replaceAllCount === null) return
    const timer = setTimeout(() => setReplaceAllCount(null), 3000)
    return () => clearTimeout(timer)
  }, [replaceAllCount])

  const handleReplaceAll = async () => {
    setReplacing(true)
    try {
      if (asyncEnabled && sessionId) {
        // ── Async path ────────────────────────────────────────────────
        const controller = new AbortController()
        abortRef.current = controller
        const finalState = await submitAndPoll(
          {
            type: 'find_replace',
            scope: asyncScope,
            session_id: sessionId,
            if_match_etag: sessionEtag,
            find_pattern: searchTerm,
            replace_pattern: replaceTerm,
            column: column ?? null,
            match_case: matchCase,
            regex: false,
            whole_cell: false,
            dry_run: false,
            filters,
          },
          { signal: controller.signal },
        )
        const r = finalState.result
        if (r) {
          setReplaceAllCount(r.applied_count)
          setSkippedCount(r.skipped_count)
          onAsyncComplete?.({
            applied: r.applied_count,
            skipped: r.skipped_count,
            failed: r.failed_count,
          })
        }
      } else {
        // ── Legacy sync path (back-compat) ────────────────────────────
        const result = await onReplaceAll()
        if (typeof result === 'number') {
          setReplaceAllCount(result)
          setSkippedCount(0)
        } else {
          setReplaceAllCount(result.replaced)
          setSkippedCount(result.skipped || 0)
        }
      }
    } finally {
      setReplacing(false)
      abortRef.current = null
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const progressPct = useMemo(() => {
    if (!asyncEnabled) return 0
    return Math.max(0, Math.min(100, asyncState.progress.percent))
  }, [asyncEnabled, asyncState.progress.percent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        onPrevious()
      } else {
        onNext()
      }
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const editableColumns = columns.filter((c) => c !== 'row_id')

  return (
    <div
      className="absolute top-2 right-4 z-50 w-80 rounded-lg border border-border bg-card shadow-lg"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">Find and Replace</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-muted text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Find input */}
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Find..."
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onPrevious} disabled={totalMatches === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onNext} disabled={totalMatches === 0}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Replace input */}
        <div className="flex items-center gap-1.5">
          <Replace className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={replaceTerm}
            onChange={(e) => onReplaceTermChange(e.target.value)}
            placeholder="Replace with..."
            className="h-7 text-xs flex-1"
          />
        </div>

        {/* Options row */}
        <div className="flex items-center gap-3">
          {/* Scope */}
          <Select
            value={column || '__all__'}
            onValueChange={(v) => onColumnChange(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="All columns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All columns</SelectItem>
              {editableColumns.map((col) => (
                <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Match case */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={matchCase}
              onCheckedChange={(checked) => onMatchCaseChange(checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Match case</span>
          </label>
        </div>

        {/* Match count */}
        <div className="flex items-center justify-between text-[11px]">
          {loading ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </span>
          ) : searchTerm.trim() ? (
            <span className="text-muted-foreground">
              {totalMatches === 0 ? (
                'No matches'
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {currentIndex >= 0 ? currentIndex + 1 : 0}
                  </span>
                  {' of '}
                  <span className="font-medium text-foreground">
                    {totalMatches.toLocaleString()}
                  </span>
                  {hasMoreMatches ? '+ matches' : ' matches'}
                  {(lockedRowIds?.length ?? 0) > 0 && (
                    <span className="ml-1 text-amber-600">
                      ({lockedRowIds!.length} locked)
                    </span>
                  )}
                </>
              )}
            </span>
          ) : (
            <span />
          )}

          {replaceAllCount !== null && (
            <span className="text-emerald-600 font-medium">
              Replaced {replaceAllCount.toLocaleString()}
              {skippedCount > 0 && (
                <span className="ml-1 text-amber-600">
                  · {skippedCount.toLocaleString()} skipped (locked)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Async progress + cancel + tabs (only when async path is wired) */}
        {asyncEnabled && (isAsyncRunning || summary) && (
          <div data-testid="async-fnr-status" className="space-y-1.5 pt-1 border-t border-border">
            {isAsyncRunning && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <div
                  className="h-1.5 flex-1 rounded bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {progressPct}%
                </span>
                <Button
                  data-testid="async-fnr-cancel"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              </div>
            )}
            {summary && (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="h-7 w-full">
                  <TabsTrigger value="applied" className="text-[10px]">
                    Applied {summary.applied_count}
                  </TabsTrigger>
                  <TabsTrigger value="skipped" className="text-[10px]">
                    Skipped {summary.skipped_count} (lock)
                  </TabsTrigger>
                  <TabsTrigger value="failed" className="text-[10px]">
                    Failed {summary.failed_count}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="applied" className="text-[10px] text-muted-foreground">
                  {summary.applied_count} cells rewritten.
                </TabsContent>
                <TabsContent value="skipped" data-testid="skipped-rows-tab" className="text-[10px] text-muted-foreground">
                  {summary.skipped_rows.length === 0
                    ? `${summary.skipped_count} cells skipped (no row detail).`
                    : (
                      <ul className="max-h-24 overflow-auto space-y-0.5">
                        {summary.skipped_rows.slice(0, 50).map((r, i) => (
                          <li key={`${r.row_id}-${i}`} className="truncate">
                            <span className="font-mono">{r.row_id}</span>
                            {r.reason ? ` — ${r.reason}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                </TabsContent>
                <TabsContent value="failed" className="text-[10px] text-rose-600">
                  {summary.error_msg
                    ? summary.error_msg
                    : `${summary.failed_count} failures.`}
                </TabsContent>
              </Tabs>
            )}
            {asyncState.error && !summary && (
              <div data-testid="async-fnr-error" className="text-[10px] text-rose-600">
                {asyncState.error}
              </div>
            )}
            {summary && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-full text-[10px]"
                onClick={resetAsync}
              >
                Dismiss
              </Button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={totalMatches === 0 || currentIndex < 0 || !replaceTerm}
            onClick={onReplaceCurrent}
          >
            Replace
          </Button>
          <Button
            data-testid="replace-all-btn"
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={(!asyncEnabled && totalMatches === 0) || !replaceTerm || replacing || isAsyncRunning}
            onClick={handleReplaceAll}
          >
            {(replacing || isAsyncRunning) ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            Replace All
          </Button>
        </div>
      </div>
    </div>
  )
}
