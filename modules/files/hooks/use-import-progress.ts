"use client"

/**
 * useImportProgress
 * ─────────────────
 * Polls a connector import for Chrome-style progress fields written by the
 * backend onto FileRegistry-V3:
 *
 *   import_status         "downloading" | "uploading" | "completed" | "failed"
 *   bytes_downloaded      int
 *   bytes_total           int
 *   download_started_at   ISO 8601
 *   download_updated_at   ISO 8601
 *   download_finished_at  ISO 8601 (set on completed/failed)
 *
 * Polls every 1.5 s while `import_status ∈ {downloading, uploading}` and
 * stops as soon as it reaches `completed` or `failed`. Pure setInterval —
 * no SWR dependency. Backed by the storage connectors GET endpoint so the
 * exact same Lambda surface is reused regardless of provider (Drive,
 * OneDrive, Dropbox).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { storageConnectorsAPI } from "@/modules/connectors/api/storage-connectors-api"

const POLL_INTERVAL_MS = 1500

export type ImportProgressState = "downloading" | "uploading" | "completed" | "failed"

export interface ImportProgressSnapshot {
  importStatus: ImportProgressState
  bytesDownloaded: number
  bytesTotal: number
  startedAt: string
  updatedAt: string
  finishedAt?: string
  errorMessage?: string
  filename?: string
}

interface UseImportProgressArgs {
  provider: string
  uploadId: string | null
  /** Original filename / size known up-front from the file picker; used as fallbacks. */
  expectedFilename?: string
  expectedSize?: number
  /** Called once when the import flips to "completed". */
  onComplete?: (filename: string, fileSize?: number) => void
  /** Called once when the import flips to "failed". */
  onFail?: (errorMessage: string) => void
}

/**
 * Map a raw FileRegistry-V3 status row to the unified progress snapshot.
 * Tolerates partial backend rollouts: if `import_status` isn't there yet,
 * fall back to the legacy `status`/`bytes_transferred` fields so the UI
 * still works.
 */
function normalizeProgress(
  raw: Awaited<ReturnType<typeof storageConnectorsAPI.getImportStatus>>,
  fallbackSize: number,
): ImportProgressSnapshot {
  const importStatus: ImportProgressState = (() => {
    if (raw.import_status) return raw.import_status
    // Legacy fallbacks
    if (raw.status === "UPLOADED" || raw.status === "DQ_DISPATCHED" || raw.status === "DQ_RUNNING" || raw.status === "DQ_FIXED") {
      return "completed"
    }
    if (raw.status === "IMPORT_FAILED" || raw.status === "FAILED" || raw.status === "UPLOAD_FAILED") {
      return "failed"
    }
    return "downloading"
  })()

  const bytesDownloaded =
    typeof raw.bytes_downloaded === "number"
      ? raw.bytes_downloaded
      : typeof raw.bytes_transferred === "number"
        ? raw.bytes_transferred
        : 0

  const bytesTotal =
    typeof raw.bytes_total === "number" && raw.bytes_total > 0
      ? raw.bytes_total
      : typeof raw.file_size === "number" && raw.file_size > 0
        ? raw.file_size
        : fallbackSize

  return {
    importStatus,
    bytesDownloaded,
    bytesTotal,
    startedAt: raw.download_started_at ?? new Date().toISOString(),
    updatedAt: raw.download_updated_at ?? new Date().toISOString(),
    finishedAt: raw.download_finished_at,
    errorMessage: raw.error_message,
    filename: raw.filename,
  }
}

export function useImportProgress({
  provider,
  uploadId,
  expectedFilename,
  expectedSize,
  onComplete,
  onFail,
}: UseImportProgressArgs) {
  const [progress, setProgress] = useState<ImportProgressSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    completedRef.current = false
    setProgress(null)
    setError(null)
  }, [stop])

  useEffect(() => {
    if (!uploadId) {
      stop()
      return
    }

    // Mark new run.
    completedRef.current = false

    let cancelled = false

    const tick = async () => {
      try {
        const raw = await storageConnectorsAPI.getImportStatus(provider, uploadId)
        if (cancelled) return
        const snap = normalizeProgress(raw, expectedSize ?? 0)
        setProgress(snap)

        if (
          !completedRef.current &&
          (snap.importStatus === "completed" || snap.importStatus === "failed")
        ) {
          completedRef.current = true
          stop()
          if (snap.importStatus === "completed") {
            onComplete?.(
              snap.filename || expectedFilename || "file",
              snap.bytesTotal || raw.file_size,
            )
          } else {
            onFail?.(snap.errorMessage || "Import failed")
          }
        }
      } catch (e) {
        if (cancelled) return
        // Soft-fail: keep polling — transient errors shouldn't kill the UI.
        // We surface the most recent error for diagnostics but never auto-stop.
        setError(e instanceof Error ? e.message : "Failed to fetch import status")
      }
    }

    // Kick off immediately, then on the configured cadence.
    void tick()
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, uploadId])

  return {
    progress,
    error,
    reset,
    /** Convenience: a final terminal flag (for unmounting or dialog close). */
    isTerminal:
      progress?.importStatus === "completed" ||
      progress?.importStatus === "failed",
  }
}

export default useImportProgress
