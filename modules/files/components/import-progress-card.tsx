"use client"

/**
 * ImportProgressCard
 * ──────────────────
 * Chrome-download-tray inspired progress card for connector imports
 * (primarily Google Drive). Renders real bytes / speed / ETA pulled from
 * the new FileRegistry-V3 progress fields:
 *
 *   import_status         ("downloading" | "uploading" | "completed" | "failed")
 *   bytes_downloaded      (int)
 *   bytes_total           (int)
 *   download_started_at   (ISO 8601)
 *   download_updated_at   (ISO 8601)
 *   download_finished_at  (ISO 8601, set on completed/failed)
 *
 * The component computes speed (rolling 5-sample window with EMA smoothing)
 * and ETA on the FE — cheap, no extra round-trips, no flicker.
 */

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudDownload,
  RefreshCw,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { formatBytes } from "@/shared/lib/utils"

// ─── Public types ──────────────────────────────────────────────────────────

export type ImportProgressStatus =
  | "downloading"
  | "uploading"
  | "completed"
  | "failed"

export interface ImportProgressCardProps {
  filename: string
  importStatus: ImportProgressStatus
  bytesDownloaded: number
  bytesTotal: number
  startedAt: string
  updatedAt: string
  finishedAt?: string
  errorMessage?: string
  onCancel?: () => void
  onRetry?: () => void
  /** Optional providerlabel ("Google Drive", "Snowflake"); defaults to "Google Drive". */
  providerLabel?: string
  className?: string
}

// ─── Speed / ETA helpers ───────────────────────────────────────────────────

interface SpeedSample {
  ts: number
  bytes: number
}

const MAX_SAMPLES = 5
const EMA_ALPHA = 0.3

function computeRawSpeed(samples: SpeedSample[]): number {
  if (samples.length < 2) return 0
  const oldest = samples[0]
  const latest = samples[samples.length - 1]
  const dtSec = (latest.ts - oldest.ts) / 1000
  if (dtSec <= 0) return 0
  const dBytes = latest.bytes - oldest.bytes
  if (dBytes <= 0) return 0
  return dBytes / dtSec
}

/**
 * Format an ETA in seconds to a user-friendly string.
 * - speed → 0 and remaining bytes ≈ 0 → "Almost done…"
 * - <  1 s  → "< 1 s"
 * - < 60 s  → "41 s remaining"
 * - < 60 m  → "2 m 18 s remaining"
 * - else     → "1 h 12 m remaining"
 */
export function formatEta(
  remainingBytes: number,
  bytesPerSec: number,
): string {
  if (remainingBytes <= 0) return "Almost done…"
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "Calculating…"

  const sec = remainingBytes / bytesPerSec
  if (sec < 1) return "< 1 s"
  if (sec < 60) return `${Math.round(sec)} s remaining`
  if (sec < 3600) {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec - m * 60)
    return `${m} m ${s} s remaining`
  }
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec - h * 3600) / 60)
  return `${h} h ${m} m remaining`
}

/**
 * Format an elapsed duration in milliseconds for the "took 4 m 12 s" subtitle.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 s"
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec} s`
  if (sec < 3600) {
    const m = Math.floor(sec / 60)
    const s = sec - m * 60
    return s ? `${m} m ${s} s` : `${m} m`
  }
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec - h * 3600) / 60)
  return m ? `${h} h ${m} m` : `${h} h`
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ImportProgressCard({
  filename,
  importStatus,
  bytesDownloaded,
  bytesTotal,
  startedAt,
  updatedAt,
  finishedAt,
  errorMessage,
  onCancel,
  onRetry,
  providerLabel = "Google Drive",
  className,
}: ImportProgressCardProps) {
  // Rolling sample window for speed calculation.
  const samplesRef = useRef<SpeedSample[]>([])
  // EMA-smoothed display speed (B/s).
  const [smoothedSpeed, setSmoothedSpeed] = useState<number>(0)

  useEffect(() => {
    // Reset samples on import_status terminal transitions so a stale window
    // can't leak into a retry/new run.
    if (importStatus === "completed" || importStatus === "failed") {
      samplesRef.current = []
      setSmoothedSpeed(0)
      return
    }

    // Use the backend's updated_at (ISO) as the sample timestamp when present
    // so server-side progress that arrives in batches isn't double-counted.
    let ts = Date.parse(updatedAt)
    if (!Number.isFinite(ts) || Number.isNaN(ts)) ts = Date.now()

    const samples = samplesRef.current
    const last = samples[samples.length - 1]
    if (!last || last.bytes !== bytesDownloaded || last.ts !== ts) {
      samples.push({ ts, bytes: bytesDownloaded })
      while (samples.length > MAX_SAMPLES) samples.shift()
    }

    const raw = computeRawSpeed(samples)
    setSmoothedSpeed((prev) => {
      // First non-zero sample seeds the EMA so we don't crawl out of 0.
      if (prev <= 0) return raw
      if (raw <= 0) return prev * (1 - EMA_ALPHA)
      return EMA_ALPHA * raw + (1 - EMA_ALPHA) * prev
    })
  }, [bytesDownloaded, updatedAt, importStatus])

  // ── Derived display values ────────────────────────────────────────────
  const safeTotal = bytesTotal > 0 ? bytesTotal : 0
  const clampedDownloaded = Math.min(
    Math.max(bytesDownloaded, 0),
    safeTotal || bytesDownloaded,
  )
  const pct = (() => {
    if (importStatus === "completed") return 100
    if (importStatus === "failed") return 0
    if (safeTotal > 0) {
      return Math.min(100, (clampedDownloaded / safeTotal) * 100)
    }
    return 0
  })()
  const remaining = Math.max(0, safeTotal - clampedDownloaded)

  const startedMs = Date.parse(startedAt)
  const finishedMs = finishedAt ? Date.parse(finishedAt) : NaN
  const elapsedMs =
    Number.isFinite(startedMs) && Number.isFinite(finishedMs)
      ? finishedMs - startedMs
      : 0

  // ── Status copy / colour scheme ───────────────────────────────────────
  const isTerminal = importStatus === "completed" || importStatus === "failed"
  const statusLabel = (() => {
    switch (importStatus) {
      case "downloading":
        return `Downloading from ${providerLabel}`
      case "uploading":
        return "Uploading to S3"
      case "completed":
        return `Imported successfully${
          elapsedMs > 0 ? ` ・ took ${formatDuration(elapsedMs)}` : ""
        }`
      case "failed":
        return `Failed${errorMessage ? `: ${errorMessage}` : ""}`
    }
  })()

  const StatusIcon = (() => {
    switch (importStatus) {
      case "downloading":
        return CloudDownload
      case "uploading":
        return Cloud
      case "completed":
        return Check
      case "failed":
        return AlertTriangle
    }
  })()

  const statusColor = (() => {
    switch (importStatus) {
      case "completed":
        return "text-emerald-600 dark:text-emerald-400"
      case "failed":
        return "text-destructive"
      default:
        return "text-primary"
    }
  })()

  const fillColor = (() => {
    switch (importStatus) {
      case "completed":
        return "bg-emerald-500"
      case "failed":
        return "bg-destructive"
      default:
        return "bg-primary"
    }
  })()

  return (
    <div
      data-testid="import-progress-card"
      data-status={importStatus}
      className={cn(
        "w-full max-w-[480px] rounded-lg border border-border bg-card p-4 shadow-sm",
        importStatus === "failed" && "border-destructive/60",
        className,
      )}
    >
      {/* Row 1: filename + cancel/close */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          <StatusIcon className={cn("h-4 w-4", statusColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm font-medium truncate"
              title={filename}
            >
              {filename}
            </span>
            {importStatus === "completed" && (
              <Check
                className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                aria-label="Completed"
              />
            )}
          </div>
          {/* Status row */}
          <div
            data-testid="import-progress-status"
            className={cn("mt-0.5 text-xs", statusColor)}
          >
            {statusLabel}
          </div>
        </div>
        {onCancel && !isTerminal && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onCancel}
            aria-label="Cancel import"
            data-testid="import-progress-cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Row 2: progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          data-testid="import-progress-bar-fill"
          className={cn("h-full rounded-full", fillColor)}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "tween", duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Row 3: bytes / percent */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
        <span data-testid="import-progress-bytes">
          {formatBytes(clampedDownloaded, 1)}
          {safeTotal > 0 ? ` / ${formatBytes(safeTotal, 1)}` : ""}
        </span>
        <span data-testid="import-progress-percent">
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Row 4: speed + ETA OR error + retry OR completed subtitle */}
      {importStatus === "failed" ? (
        <div className="mt-2 flex items-start justify-between gap-2">
          <div
            className="text-xs text-destructive flex-1 min-w-0"
            data-testid="import-progress-error"
          >
            {errorMessage || "Import failed"}
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 px-2 text-xs shrink-0"
              data-testid="import-progress-retry"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      ) : importStatus === "completed" ? null : (
        <div
          className="mt-2 flex items-center justify-between text-xs text-muted-foreground tabular-nums"
          data-testid="import-progress-speed-eta"
        >
          <span data-testid="import-progress-speed">
            {smoothedSpeed > 0
              ? `${formatBytes(smoothedSpeed, 1)}/s`
              : "Calculating speed…"}
          </span>
          <span data-testid="import-progress-eta">
            {smoothedSpeed > 0
              ? formatEta(remaining, smoothedSpeed)
              : ""}
          </span>
        </div>
      )}
    </div>
  )
}

export default ImportProgressCard
