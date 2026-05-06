/**
 * use-quarantine-find.ts
 *
 * State management for Find & Replace in the quarantine editor.
 * Handles search state, server-side match fetching, match navigation,
 * and replace operations.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { findInQuarantineRows } from '@/modules/files/api/file-quarantine-api'
import type { FindMatch, QuarantineFindResponse } from '@/modules/files/types'

interface FindState {
  open: boolean
  searchTerm: string
  replaceTerm: string
  column: string | null       // null = all columns
  matchCase: boolean
  matches: FindMatch[]
  totalMatches: number
  truncated: boolean
  currentIndex: number        // index into matches[]
  loading: boolean
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
}

interface UseQuarantineFindParams {
  uploadId: string
  authToken: string | null
  sessionId: string | undefined
  columns: string[]
  onCellEdit: (rowId: string, column: string, value: string) => void
  saveEdits: () => Promise<boolean>
  /** #7 — Optional bulk-lock acquire/release from the collab hook.
   *  When provided, replaceAll uses these to coordinate concurrent F&R
   *  with other users. When omitted, replaceAll falls back to the
   *  best-effort "writer wins" behaviour. */
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
  columns,
  onCellEdit,
  saveEdits,
  acquireBulkLocks,
  releaseBulkLocks,
  onBulkLockConflict,
}: UseQuarantineFindParams) {
  const [state, setState] = useState<FindState>(INITIAL_STATE)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Execute server-side search
  const executeSearch = useCallback(async () => {
    if (!authToken || !state.searchTerm.trim()) {
      setState((prev) => ({
        ...prev,
        matches: [],
        totalMatches: 0,
        truncated: false,
        currentIndex: -1,
        loading: false,
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true }))

    try {
      const response: QuarantineFindResponse = await findInQuarantineRows(
        uploadId,
        authToken,
        {
          search: state.searchTerm,
          session_id: sessionId,
          column: state.column,
          match_case: state.matchCase,
        }
      )

      setState((prev) => ({
        ...prev,
        matches: response.match_positions,
        totalMatches: response.total_matches,
        truncated: response.truncated,
        currentIndex: response.match_positions.length > 0 ? 0 : -1,
        loading: false,
      }))
    } catch {
      setState((prev) => ({
        ...prev,
        matches: [],
        totalMatches: 0,
        truncated: false,
        currentIndex: -1,
        loading: false,
      }))
    }
  }, [uploadId, authToken, sessionId, state.searchTerm, state.column, state.matchCase])

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
      }))
      return
    }

    debounceRef.current = setTimeout(() => {
      void executeSearch()
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [state.open, state.searchTerm, state.column, state.matchCase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate matches
  const goToNext = useCallback(() => {
    setState((prev) => {
      if (prev.matches.length === 0) return prev
      const next = (prev.currentIndex + 1) % prev.matches.length
      return { ...prev, currentIndex: next }
    })
  }, [])

  const goToPrevious = useCallback(() => {
    setState((prev) => {
      if (prev.matches.length === 0) return prev
      const next = prev.currentIndex <= 0 ? prev.matches.length - 1 : prev.currentIndex - 1
      return { ...prev, currentIndex: next }
    })
  }, [])

  // Replace current match
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

  // Replace all matches
  const replaceAll = useCallback(async () => {
    if (state.matches.length === 0) return 0

    // ── #7 — Bulk-lock guard ─────────────────────────────────────────
    // Before applying changes, ask the WS server to lock every cell
    // we're about to write. If another peer holds any of them, abort
    // cleanly with a conflict message rather than racing the write.
    const cellsToLock = state.matches.map(
      (m) => `${m.column}:${m.row_id}`,
    )
    let lockedAcquired: string[] = []
    if (acquireBulkLocks) {
      const result = await acquireBulkLocks(cellsToLock)
      if (!result.acquired) {
        onBulkLockConflict?.(
          result.conflicting || [],
          result.reason || 'Another user is editing some of these cells',
        )
        return 0
      }
      lockedAcquired = cellsToLock
    }

    let replacedCount = 0
    try {
      for (const match of state.matches) {
        const oldValue = match.value
        const newValue = state.matchCase
          ? oldValue.replaceAll(state.searchTerm, state.replaceTerm)
          : oldValue.replace(new RegExp(escapeRegex(state.searchTerm), 'gi'), state.replaceTerm)

        if (newValue !== oldValue) {
          onCellEdit(match.row_id, match.column, newValue)
          replacedCount++
        }
      }

      // Trigger save for all edits
      if (replacedCount > 0) {
        await saveEdits()
      }
    } finally {
      // Always release the bulk lockset, even if save failed mid-way.
      // The server's lock TTL would clean up eventually, but explicit
      // release lets other peers edit those cells immediately.
      if (releaseBulkLocks && lockedAcquired.length > 0) {
        releaseBulkLocks(lockedAcquired)
      }
    }

    // Clear matches after replace all
    setState((prev) => ({
      ...prev,
      matches: [],
      totalMatches: 0,
      currentIndex: -1,
    }))

    return replacedCount
  }, [
    state.matches, state.searchTerm, state.replaceTerm, state.matchCase,
    onCellEdit, saveEdits,
    acquireBulkLocks, releaseBulkLocks, onBulkLockConflict,
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
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
