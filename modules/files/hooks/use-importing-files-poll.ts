"use client"

/**
 * useImportingFilesPoll
 * ─────────────────────
 * Background polling for files in IMPORTING status.
 *
 * Why this exists
 * ───────────────
 * Connector imports (Google Drive today) flip a row to status=IMPORTING
 * and update `bytes_downloaded` / `bytes_total` on the FileRegistry-V3
 * row mid-stream. The Import Data dialog renders the in-flight progress
 * card and polls itself, but the moment the user closes the dialog the
 * card is unmounted. The row in the data-catalog table then has no live
 * data — it just sits at "IMPORTING" with no bar / MB·s / ETA.
 *
 * This hook fixes that by polling the catalog list endpoint (`GET /uploads`,
 * already wired through `loadFiles`) every {@link POLL_INTERVAL_MS} while
 * at least one row is IMPORTING. The same Redux-backed list refresh feeds
 * both the inline row UI and any other consumer — there is no second
 * polling source for the same data.
 *
 * The hook also gracefully picks up in-flight imports after a page reload:
 * the user's first list fetch reveals the IMPORTING rows, this hook starts
 * polling, and the bar populates from the next poll cycle.
 *
 * Pause behaviour
 * ───────────────
 *   • Polling is OFF by default and only flips ON when the file list
 *     contains ≥ 1 row in IMPORTING. As soon as the last IMPORTING row
 *     transitions to UPLOADED / IMPORT_FAILED / etc., polling halts.
 *   • Document visibility is respected — when the tab is hidden the
 *     interval is paused (pages can be open for hours; we don't want a
 *     hidden tab to keep hitting the API).
 *   • Cleans up on unmount.
 */

import { useEffect, useRef } from "react"
import type { FileStatusResponse } from "@/modules/files/types"

const POLL_INTERVAL_MS = 2000

interface UseImportingFilesPollArgs {
  files: FileStatusResponse[]
  /** No-arg refresh callback — typically the page-level `loadFiles`. */
  onRefresh: () => void | Promise<void>
}

export function useImportingFilesPoll({
  files,
  onRefresh,
}: UseImportingFilesPollArgs) {
  const onRefreshRef = useRef(onRefresh)

  // Keep the latest onRefresh in a ref so the polling effect doesn't
  // tear down + re-arm every render (which would defeat the cadence).
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  const hasImporting = files.some((f) => f.status === "IMPORTING")

  useEffect(() => {
    if (!hasImporting) return

    let cancelled = false

    const tick = () => {
      if (cancelled) return
      // Skip ticks while the tab is hidden — we'll resume on focus.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return
      }
      void Promise.resolve(onRefreshRef.current()).catch(() => {
        // Soft-fail: a transient list-fetch error shouldn't kill the
        // poll loop. The next tick will retry.
      })
    }

    const id = setInterval(tick, POLL_INTERVAL_MS)
    // Refresh once immediately when polling starts so the user doesn't wait
    // up to POLL_INTERVAL_MS for the first byte count to appear.
    tick()

    const onVisibilityChange = () => {
      if (cancelled) return
      if (document.visibilityState === "visible") {
        // Catch-up tick on tab refocus.
        tick()
      }
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
  }, [hasImporting])
}

export default useImportingFilesPoll
