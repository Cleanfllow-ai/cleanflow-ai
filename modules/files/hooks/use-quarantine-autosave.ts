/**
 * use-quarantine-autosave.ts
 *
 * Hook for autosaving quarantine edits
 * Implements debounced autosave with configurable delay
 */

import { useEffect, useRef } from 'react'

/**
 * Hook for autosaving edits
 * Debounces save function calls to avoid excessive API requests
 *
 * @param saveFunction - Function to call for saving
 * @param pendingCount - Number of pending edits
 * @param debounceMs - Debounce delay in milliseconds
 * @param enabled - Whether autosave is enabled
 */
export function useQuarantineAutosave(
  saveFunction: () => Promise<void>,
  pendingCount: number,
  debounceMs: number,
  enabled: boolean
) {
  const timerRef = useRef<number | null>(null)
  const saveFunctionRef = useRef(saveFunction)

  // Keep saveFunction ref up to date
  useEffect(() => {
    saveFunctionRef.current = saveFunction
  }, [saveFunction])

  useEffect(() => {
    // Clear existing timer
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // Don't autosave if disabled or no edits
    if (!enabled || pendingCount === 0) {
      return
    }

    // Set new timer
    timerRef.current = window.setTimeout(() => {
      void saveFunctionRef.current()
    }, debounceMs)

    // Cleanup
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [pendingCount, debounceMs, enabled])
}
