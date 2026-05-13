/**
 * use-overlay-persist.ts
 *
 * Persists in-progress quarantine cell edits to sessionStorage so an
 * accidental browser refresh / tab restore doesn't lose unsaved work.
 *
 * Key: `quarantine_overlay_{file_id}` (scoped per file).
 * Payload: `{ session_id, edits_map, saved_at }`.
 *
 * Writes are debounced (default 500ms) on every edit, and the entry is
 * cleared on successful save. Restore is a one-shot read from sessionStorage
 * on mount — the consumer wires it into `useQuarantineEdits`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_PREFIX = 'quarantine_overlay_'
const DEFAULT_DEBOUNCE_MS = 500

export interface PersistedOverlay {
  session_id: string
  edits_map: Record<string, Record<string, any>>
  saved_at: string
}

export interface UseOverlayPersistOptions {
  fileId: string
  sessionId: string | undefined
  /** Live edits map from useQuarantineEdits. */
  editsMap: Record<string, Record<string, any>>
  /** Override the debounce window (ms). Default 500. */
  debounceMs?: number
}

export interface UseOverlayPersistResult {
  /** Overlay restored from sessionStorage on mount (or null). */
  restored: PersistedOverlay | null
  /** Number of distinct rows in the restored overlay (0 when none). */
  restoredCount: number
  /** Discard the restored overlay AND the stored entry. */
  discardRestored: () => void
  /** Force-clear the stored entry — call after a successful save. */
  clearPersisted: () => void
}

function storageKey(fileId: string): string {
  return `${STORAGE_PREFIX}${fileId}`
}

function safeRead(fileId: string): PersistedOverlay | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(fileId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.edits_map &&
      typeof parsed.edits_map === 'object'
    ) {
      return parsed as PersistedOverlay
    }
    return null
  } catch {
    return null
  }
}

function safeWrite(fileId: string, payload: PersistedOverlay): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(storageKey(fileId), JSON.stringify(payload))
  } catch {
    // Quota exceeded / disabled — silently degrade. UX still works.
  }
}

function safeRemove(fileId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(storageKey(fileId))
  } catch {
    /* noop */
  }
}

/**
 * Stores quarantine edits to sessionStorage (debounced) and returns any
 * overlay that was persisted from a prior session for the same file.
 */
export function useOverlayPersist(
  opts: UseOverlayPersistOptions,
): UseOverlayPersistResult {
  const { fileId, sessionId, editsMap, debounceMs = DEFAULT_DEBOUNCE_MS } = opts

  // One-shot read on mount. Use useState lazy initializer so this fires
  // synchronously before the first paint.
  const [restored, setRestored] = useState<PersistedOverlay | null>(() =>
    fileId ? safeRead(fileId) : null,
  )

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced write on every edit change.
  useEffect(() => {
    if (!fileId) return
    const count = Object.keys(editsMap || {}).length
    if (count === 0) {
      // No pending edits — nothing to persist. Don't clear here; clearing
      // is the caller's responsibility (e.g. on save / discard) so we
      // don't blow away a freshly-restored overlay before it's consumed.
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      safeWrite(fileId, {
        session_id: sessionId || '',
        edits_map: editsMap,
        saved_at: new Date().toISOString(),
      })
    }, debounceMs)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fileId, sessionId, editsMap, debounceMs])

  const discardRestored = useCallback(() => {
    if (fileId) safeRemove(fileId)
    setRestored(null)
  }, [fileId])

  const clearPersisted = useCallback(() => {
    if (fileId) safeRemove(fileId)
  }, [fileId])

  const restoredCount = restored
    ? Object.keys(restored.edits_map || {}).length
    : 0

  return { restored, restoredCount, discardRestored, clearPersisted }
}
