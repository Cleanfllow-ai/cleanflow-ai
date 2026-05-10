"use client"

/**
 * useOptimizingFilesPoll
 * ──────────────────────
 * Background polling for files in OPTIMIZING status (Phase 7B logical sharding).
 *
 * Mirrors {@link useImportingFilesPoll}: while at least one file in the
 * current page-level list is OPTIMIZING, refresh the list every
 * {@link POLL_INTERVAL_MS} so the user sees the badge transition out
 * (to UPLOADED / VALIDATED / OPTIMIZE_FAILED) without manually refreshing.
 *
 * Pause behaviour
 * ───────────────
 *   • Polling is OFF unless ≥ 1 row is OPTIMIZING.
 *   • Document-visibility-aware — paused while the tab is hidden.
 *   • Cleans up on unmount.
 *
 * Backend caveat
 * ──────────────
 * If Phase 7B isn't deployed yet, no row will ever carry status=OPTIMIZING
 * and this hook is a no-op (returns immediately from `hasOptimizing`).
 */

import { useEffect, useRef } from "react"
import type { FileStatusResponse } from "@/modules/files/types"

const POLL_INTERVAL_MS = 5000

interface UseOptimizingFilesPollArgs {
  files: FileStatusResponse[]
  /** No-arg refresh callback — typically the page-level `loadFiles`. */
  onRefresh: () => void | Promise<void>
  /** When true, suspend polling even if OPTIMIZING rows exist. */
  isPaused?: boolean
}

export function useOptimizingFilesPoll({
  files,
  onRefresh,
  isPaused = false,
}: UseOptimizingFilesPollArgs) {
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const hasOptimizing = files.some((f) => f.status === "OPTIMIZING")

  useEffect(() => {
    if (!hasOptimizing) return
    if (isPaused) return

    let cancelled = false

    const tick = () => {
      if (cancelled) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }
      void Promise.resolve(onRefreshRef.current()).catch(() => {
        // Soft-fail: a transient list-fetch error shouldn't kill the
        // poll loop. The next tick will retry.
      })
    }

    const id = setInterval(tick, POLL_INTERVAL_MS)
    // First tick immediately so the badge updates promptly when polling
    // starts (don't make the user wait one full interval).
    tick()

    const onVisibilityChange = () => {
      if (cancelled) return
      if (document.visibilityState === "visible") tick()
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }

    return () => {
      cancelled = true
      clearInterval(id)
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }
    }
  }, [hasOptimizing, isPaused])
}

export default useOptimizingFilesPoll
