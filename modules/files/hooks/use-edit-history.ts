/**
 * use-edit-history.ts
 *
 * Per-cell edit history (ring buffer, depth 20) backing the quarantine editor's
 * undo affordance (toast + Ctrl+Z). Keeps {file_id, row_id, column, old_value,
 * new_value, timestamp} tuples; consumers pop the latest entry and replay the
 * old_value through the same `EDITS_BATCH` POST path as a normal edit.
 */
import { useCallback, useRef, useState } from 'react'

export interface EditHistoryEntry {
  file_id: string
  row_id: string
  column: string
  old_value: any
  new_value: any
  timestamp: number
}

const HISTORY_DEPTH = 20

export function useEditHistory(depth: number = HISTORY_DEPTH) {
  const bufferRef = useRef<EditHistoryEntry[]>([])
  // Bump on mutation so consumers can re-render (e.g. an indicator that the
  // undo stack is non-empty). We expose `size` directly rather than the array
  // to avoid leaking the mutable internal buffer.
  const [, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const push = useCallback(
    (edit: Omit<EditHistoryEntry, 'timestamp'> & { timestamp?: number }) => {
      const entry: EditHistoryEntry = {
        ...edit,
        timestamp: edit.timestamp ?? Date.now(),
      }
      const buf = bufferRef.current
      buf.push(entry)
      // Evict oldest when over depth — straight FIFO drop, not LRU.
      while (buf.length > depth) {
        buf.shift()
      }
      bump()
    },
    [depth, bump],
  )

  const undo = useCallback((): EditHistoryEntry | null => {
    const buf = bufferRef.current
    if (buf.length === 0) return null
    const entry = buf.pop()!
    bump()
    return entry
  }, [bump])

  const clear = useCallback(() => {
    bufferRef.current = []
    bump()
  }, [bump])

  const size = bufferRef.current.length

  return { push, undo, clear, size }
}
