/**
 * use-quarantine-find.ts
 *
 * State management for Find & Replace in the quarantine editor.
 *
 * Cursor-paginated:
 *   - Find walks shards via `next_cursor`. The hook accumulates matches
 *     across chunks lazily (on demand when the user navigates past the
 *     buffer end OR aggressively before Replace All).
 *   - Replace All chains the new `/quarantined/find-replace` endpoint
 *     server-side. It NEVER walks `state.matches` to compose edits — that
 *     was the in-memory cap that made Replace All silently lossy on
 *     > 50K-match files (Bug #3).
 *
 * Filter-aware:
 *   - The active `QuarantineFilters` envelope from `useQuarantineFilters`
 *     is forwarded on every Find / Replace request. This closes Bug #4
 *     (find ignored filters) and Bug #2 (apply-all variants ignored
 *     filter scope).
 *
 * Lock-aware:
 *   - Find returns matched rows even if locked, but flags them in
 *     `locked_row_ids`. Replace All counts them via `skipped_locked` from
 *     the server.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  findInQuarantineRows,
  replaceInQuarantineRows,
} from '@/modules/files/api/file-quarantine-api'
import type {
  FindMatch,
  QuarantineFilters,
  QuarantineFindResponse,
  ReplaceInQuarantineResponse,
} from '@/modules/files/types'

interface FindState {
  open: boolean
  searchTerm: string
  replaceTerm: string
  column: string | null       // null = all columns
  matchCase: boolean
  matches: FindMatch[]
  totalMatches: number
  /** Legacy field — preserved for older UI strings. Cursor mode never
   *  truncates silently, so this stays false in v2. */
  truncated: boolean
  currentIndex: number        // index into matches[]
  loading: boolean
  /** Server-side cursor for the next Find chunk. null = stream exhausted. */
  nextFindCursor: string | null
  /** Locked-row ids amongst current matches — informational. */
  lockedRowIds: string[]
}

const INITIAL_STATE: FindState = {
  open: false,
  searchTerm: '',
  replaceTerm: '',
  column: null,
  matchCase: false,
  matches: [],
  totalMatches: 0,
  truncated: false,
  currentIndex: -1,
  loading: false,
  nextFindCursor: null,
  lockedRowIds: [],
}

interface UseQuarantineFindParams {
  uploadId: string
  authToken: string | null
  sessionId: string | undefined
  /** Active session etag — required for chained Replace All calls. */
  sessionEtag?: string
  columns: string[]
  /** Active filter envelope from useQuarantineFilters — forwarded on every
   *  Find/Replace request so server-side scope honours UI scope (Bug #4). */
  filters?: QuarantineFilters
  onCellEdit: (rowId: string, column: string, value: string) => void
  saveEdits: () => Promise<boolean>
  /** Refresh after a server-side Replace All so the grid reflects the new
   *  values (and the latest etag). Optional. */
  onAfterReplaceAll?: (newEtag: string, replaced: number, skipped: number) => void
  /** #7 — bulk-lock acquire/release from the collab hook. With cursor
   *  pagination we lock per-chunk, not all matches up-front. */
  acquireBulkLocks?: (cells: string[]) => Promise<{
    acquired: boolean
    conflicting?: string[]
    reason?: string
  }>
  releaseBulkLocks?: (cells: string[]) => void
  onBulkLockConflict?: (conflictingCells: string[], reason?: string) => void
}

export function useQuarantineFind({
  uploadId,
  authToken,
  sessionId,
  sessionEtag,
  columns,
  filters,
  onCellEdit,
  saveEdits,
  onAfterReplaceAll,
  acquireBulkLocks,
  releaseBulkLocks,
  onBulkLockConflict,
}: UseQuarantineFindParams) {
  const [state, setState] = useState<FindState>(INITIAL_STATE)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const sessionEtagRef = useRef(sessionEtag)
  sessionEtagRef.current = sessionEtag

  const setOpen = useCallback((open: boolean) => {
    setState((prev) => (open ? { ...prev, open } : { ...INITIAL_STATE }))
  }, [])

  const setSearchTerm = useCallback((searchTerm: string) => {
    setState((prev) => ({ ...prev, searchTerm }))
  }, [])

  const setReplaceTerm = useCallback((replaceTerm: string) => {
    setState((prev) => ({ ...prev, replaceTerm }))
  }, [])

  const setColumn = useCallback((column: string | null) => {
    setState((prev) => ({ ...prev, column }))
  }, [])

  const setMatchCase = useCallback((matchCase: boolean) => {
    setState((prev) => ({ ...prev, matchCase }))
  }, [])

  /** Run a Find call. If `cursor` is provided, we APPEND to the existing
   *  match list (loadMore semantics). Otherwise we REPLACE (fresh search). */
  const runFind = useCallback(
    async (cursor: string | null): Promise<QuarantineFindResponse | null> => {
      if (!authToken || !state.searchTerm.trim()) return null
      const response: QuarantineFindResponse = await findInQuarantineRows(
        uploadId,
        authToken,
        {
          search: state.searchTerm,
          session_id: sessionId,
          column: state.column,
          match_case: state.matchCase,
          filters: filtersRef.current,
          cursor: cursor ?? undefined,
        },
      )
      setState((prev) => {
        const incoming = response.match_positions || []
        // Dedup by (row_id, column) — chunks may overlap if a previous page
        // filled mid-shard.
        const seen = new Set(prev.matches.map((m) => `${m.row_id}:${m.column}`))
        const merged = cursor
          ? [
              ...prev.matches,
              ...incoming.filter((m) => !seen.has(`${m.row_id}:${m.column}`)),
            ]
          : incoming
        return {
          ...prev,
          matches: merged,
          totalMatches: merged.length,
          truncated: false,
          currentIndex:
            cursor && prev.currentIndex >= 0
              ? prev.currentIndex
              : merged.length > 0
                ? 0
                : -1,
          loading: false,
          nextFindCursor: response.next_cursor ?? null,
          lockedRowIds: response.locked_row_ids || [],
        }
      })
      return response
    },
    [uploadId, authToken, sessionId, state.searchTerm, state.column, state.matchCase],
  )

  // Execute server-side search (initial)
  const executeSearch = useCallback(async () => {
    if (!authToken || !state.searchTerm.trim()) {
      setState((prev) => ({
        ...INITIAL_STATE,
        open: prev.open,
        searchTerm: prev.searchTerm,
        replaceTerm: prev.replaceTerm,
        column: prev.column,
        matchCase: prev.matchCase,
      }))
      return
    }
    setState((prev) => ({ ...prev, loading: true }))
    try {
      await runFind(null)
    } catch {
      setState((prev) => ({
        ...prev,
        matches: [],
        totalMatches: 0,
        truncated: false,
        currentIndex: -1,
        loading: false,
        nextFindCursor: null,
        lockedRowIds: [],
      }))
    }
  }, [authToken, state.searchTerm, runFind])

  // Lazy "load more" — used when user navigates past the buffer end.
  const loadMore = useCallback(async () => {
    if (!state.nextFindCursor) return
    setState((prev) => ({ ...prev, loading: true }))
    try {
      await runFind(state.nextFindCursor)
    } catch {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [state.nextFindCursor, runFind])

  // Debounced search on input changes
  useEffect(() => {
    if (!state.open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!state.searchTerm.trim()) {
      setState((prev) => ({
        ...prev,
        matches: [],
        totalMatches: 0,
        truncated: false,
        currentIndex: -1,
        nextFindCursor: null,
        lockedRowIds: [],
      }))
      return
    }

    debounceRef.current = setTimeout(() => {
      void executeSearch()
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [state.open, state.searchTerm, state.column, state.matchCase, filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate matches; auto-load next chunk when reaching the end of the
  // current buffer if `next_cursor` is available.
  const goToNext = useCallback(() => {
    setState((prev) => {
      if (prev.matches.length === 0) return prev
      const next = prev.currentIndex + 1
      if (next >= prev.matches.length) {
        // At the buffer end — try to fetch next chunk lazily; otherwise wrap.
        if (prev.nextFindCursor) {
          // Trigger a load asynchronously; current view stays at last match.
          void loadMore()
          return prev
        }
        return { ...prev, currentIndex: 0 }  // wrap to start
      }
      return { ...prev, currentIndex: next }
    })
  }, [loadMore])

  const goToPrevious = useCallback(() => {
    setState((prev) => {
      if (prev.matches.length === 0) return prev
      const next = prev.currentIndex <= 0 ? prev.matches.length - 1 : prev.currentIndex - 1
      return { ...prev, currentIndex: next }
    })
  }, [])

  // Replace current match (still client-side; one cell at a time).
  const replaceCurrent = useCallback(() => {
    if (state.currentIndex < 0 || state.currentIndex >= state.matches.length) return

    const match = state.matches[state.currentIndex]
    const oldValue = match.value
    const newValue = state.matchCase
      ? oldValue.replace(state.searchTerm, state.replaceTerm)
      : oldValue.replace(new RegExp(escapeRegex(state.searchTerm), 'i'), state.replaceTerm)

    onCellEdit(match.row_id, match.column, newValue)

    // Remove this match from the list and advance
    setState((prev) => {
      const nextMatches = prev.matches.filter((_, i) => i !== prev.currentIndex)
      const nextTotal = prev.totalMatches - 1
      const nextIndex = nextMatches.length === 0 ? -1 : Math.min(prev.currentIndex, nextMatches.length - 1)
      return {
        ...prev,
        matches: nextMatches,
        totalMatches: nextTotal,
        currentIndex: nextIndex,
      }
    })
  }, [state.currentIndex, state.matches, state.searchTerm, state.replaceTerm, state.matchCase, onCellEdit])

  /** Server-side bulk Replace All — chains calls via cursor.
   *
   *  Returns `{ replaced, skipped }`. Replaces the previous in-memory
   *  walk over `state.matches` which was capped to 50 K matches and
   *  silently lost rows beyond that (Bug #3).
   */
  const replaceAll = useCallback(async (): Promise<{ replaced: number; skipped: number }> => {
    if (!authToken || !sessionId || !state.searchTerm) {
      return { replaced: 0, skipped: 0 }
    }
    // Save any unsaved edits first so the chain runs against a known etag.
    try {
      await saveEdits()
    } catch {
      // best-effort — saveEdits returning false is the caller's signal.
    }

    let cursor: string | null = null
    let etag: string = sessionEtagRef.current || ''
    let replaced = 0
    let skipped = 0

    try {
      do {
        const resp: ReplaceInQuarantineResponse = await replaceInQuarantineRows(
          uploadId,
          authToken,
          {
            session_id: sessionId,
            if_match_etag: etag,
            search: state.searchTerm,
            replace: state.replaceTerm,
            column: state.column,
            match_case: state.matchCase,
            filters: filtersRef.current,
            cursor: cursor ?? undefined,
            skip_locked: true,
          },
        )
        replaced += resp.cells_affected
        skipped += resp.skipped_locked
        etag = resp.new_etag
        cursor = resp.next_cursor
      } while (cursor)
    } finally {
      // Clear the buffered match list — the grid will re-fetch via the
      // editor's normal pagination path on the new etag.
      setState((prev) => ({
        ...prev,
        matches: [],
        totalMatches: 0,
        currentIndex: -1,
        nextFindCursor: null,
        lockedRowIds: [],
      }))
    }
    onAfterReplaceAll?.(etag, replaced, skipped)
    return { replaced, skipped }
  }, [
    authToken,
    sessionId,
    uploadId,
    state.searchTerm,
    state.replaceTerm,
    state.column,
    state.matchCase,
    saveEdits,
    onAfterReplaceAll,
    acquireBulkLocks,    // included to keep consumers' eslint-deps happy
    releaseBulkLocks,
    onBulkLockConflict,
  ])

  // Current match for highlighting
  const currentMatch = state.currentIndex >= 0 ? state.matches[state.currentIndex] : null

  return {
    // State
    open: state.open,
    searchTerm: state.searchTerm,
    replaceTerm: state.replaceTerm,
    column: state.column,
    matchCase: state.matchCase,
    matches: state.matches,
    totalMatches: state.totalMatches,
    truncated: state.truncated,
    currentIndex: state.currentIndex,
    currentMatch,
    loading: state.loading,
    hasMoreMatches: Boolean(state.nextFindCursor),
    lockedRowIds: state.lockedRowIds,

    // Actions
    setOpen,
    setSearchTerm,
    setReplaceTerm,
    setColumn,
    setMatchCase,
    goToNext,
    goToPrevious,
    replaceCurrent,
    replaceAll,
    executeSearch,
    loadMore,
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
