"use client"

/**
 * ImportProgressRow
 * ─────────────────
 * Compact, inline variant of {@link ImportProgressCard} designed for the
 * data-catalog table row. Renders a thin progress bar with bytes / MB·s /
 * ETA in a single horizontal strip, suitable for the STATUS column.
 *
 * Why a separate component instead of reusing the card?
 *   - The card has its own border, padding, and chrome (filename header,
 *     close button, retry button) that doesn't fit a 32 px-tall table row.
 *   - The row variant is read-only: cancel/retry live in the row's
 *     ACTIONS column (see file-explorer-table) so we don't double-render
 *     them here.
 *   - The card and the row read the SAME FileRegistry-V3 fields
 *     (`bytes_downloaded`, `bytes_total`, `download_*_at`), so the source
 *     of truth is shared — only the presentation differs.
 *
 * Speed / ETA computation is identical to the card (rolling 5-sample window
 * with EMA smoothing) so the two views never disagree on numbers.
 */

import { useEffect, useRef, useState } from "react"
import { cn, formatBytes } from "@/shared/lib/utils"
import { formatEta } from "./import-progress-card"

export interface ImportProgressRowProps {
  /** "downloading" | "uploading" | "completed" | "failed". Drives bar colour. */
  importStatus: "downloading" | "uploading" | "completed" | "failed"
  bytesDownloaded: number
  bytesTotal: number
  /** ISO 8601 — backend's `download_updated_at`. Used as the speed sample timestamp. */
  updatedAt: string
  className?: string
}

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

export function ImportProgressRow({
  importStatus,
  bytesDownloaded,
  bytesTotal,
  updatedAt,
  className,
}: ImportProgressRowProps) {
  const samplesRef = useRef<SpeedSample[]>([])
  const [smoothedSpeed, setSmoothedSpeed] = useState<number>(0)

  useEffect(() => {
    if (importStatus === "completed" || importStatus === "failed") {
      samplesRef.current = []
      setSmoothedSpeed(0)
      return
    }

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
      if (prev <= 0) return raw
      if (raw <= 0) return prev * (1 - EMA_ALPHA)
      return EMA_ALPHA * raw + (1 - EMA_ALPHA) * prev
    })
  }, [bytesDownloaded, updatedAt, importStatus])

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

  const fillColor = (() => {
    switch (importStatus) {
      case "completed":
        return "bg-emerald-500"
      case "failed":
        return "bg-destructive"
      default:
        return "bg-violet-500"
    }
  })()

  const speedLabel =
    smoothedSpeed > 0 ? `${formatBytes(smoothedSpeed, 1)}/s` : "Calculating…"
  const etaLabel =
    smoothedSpeed > 0 && remaining > 0
      ? formatEta(remaining, smoothedSpeed)
      : ""

  return (
    <div
      data-testid="import-progress-row"
      data-status={importStatus}
      className={cn("flex flex-col gap-1 min-w-[180px] max-w-[260px]", className)}
    >
      {/* Status pill (kept so the row still looks like every other status) */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-violet-600 dark:text-violet-400">
          Importing
        </span>
        <span
          data-testid="import-progress-row-percent"
          className="ml-auto text-[10px] font-mono tabular-nums text-muted-foreground"
        >
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Thin progress bar */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          data-testid="import-progress-row-fill"
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out", fillColor)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Bytes + speed + ETA */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums font-mono">
        <span data-testid="import-progress-row-bytes">
          {formatBytes(clampedDownloaded, 1)}
          {safeTotal > 0 ? ` / ${formatBytes(safeTotal, 1)}` : ""}
        </span>
        <span
          data-testid="import-progress-row-speed-eta"
          className="ml-2 truncate"
          title={etaLabel ? `${speedLabel} · ${etaLabel}` : speedLabel}
        >
          {speedLabel}
          {etaLabel ? ` · ${etaLabel}` : ""}
        </span>
      </div>
    </div>
  )
}

export default ImportProgressRow
