"use client"

/**
 * RejectionReasonBadge
 * ─────────────────────
 * Displays the specific reason a file was rejected (CC2 CSV edge-case
 * hardening) below the filename in the file-list table.
 *
 * Layout:
 *   • A small red/muted text line showing the reason (truncated to 200 chars)
 *   • A one-line user-friendly hint for known error patterns
 *   • Full reason text in a tooltip
 *
 * Falls back to a generic "Validation failed" message when no reason is set
 * (legacy data / pre-CC2 rows).
 *
 * Only renders for files with status === "REJECTED". Callers are responsible
 * for gating on status — the component itself does not re-check.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const MAX_DISPLAY_CHARS = 200

const FALLBACK_REASON = "Validation failed"

/**
 * Maps a raw backend failure_reason to a one-line user-friendly hint.
 * Pattern matching is prefix-based (case-insensitive).
 */
export function getRejectionHint(reason: string): string | null {
  const lower = reason.toLowerCase()
  if (lower.startsWith("empty file — this file has no data rows") || lower.startsWith("file has headers but no data rows")) {
    return "Add at least one data row below your column headers and re-upload."
  }
  if (lower.startsWith("empty file")) {
    return "Your file appears to be empty."
  }
  if (lower.startsWith("this file doesn't look like a valid csv") || lower.includes("binary data")) {
    return "This is not a CSV file. Please upload a plain-text .csv file."
  }
  if (lower.startsWith("utf-16 encoding not supported")) {
    return "Save your CSV as UTF-8 (Excel: Save As → CSV UTF-8)."
  }
  if (lower.startsWith("malformed utf-8")) {
    return "File encoding issue — save as UTF-8 in your editor."
  }
  if (lower.startsWith("unclosed quote")) {
    return "A quote character isn’t paired. Check the line/column shown."
  }
  if (lower.startsWith("could not detect encoding")) {
    return "Save your file as UTF-8 (most editors offer this option)."
  }
  return null
}

interface RejectionReasonBadgeProps {
  /** Raw failure_reason from the API. Undefined/null → show generic fallback. */
  failureReason?: string | null
}

export function RejectionReasonBadge({ failureReason }: RejectionReasonBadgeProps) {
  const rawReason = failureReason && failureReason.trim().length > 0
    ? failureReason.trim()
    : null

  const displayReason = rawReason
    ? rawReason.length > MAX_DISPLAY_CHARS
      ? rawReason.slice(0, MAX_DISPLAY_CHARS) + "…"
      : rawReason
    : FALLBACK_REASON

  const isTruncated = rawReason != null && rawReason.length > MAX_DISPLAY_CHARS
  const hint = rawReason ? getRejectionHint(rawReason) : null

  const inner = (
    <div
      className="mt-0.5 space-y-0.5"
      data-testid="rejection-reason-badge"
    >
      <p
        className="text-[10px] text-red-600 dark:text-red-400 leading-tight"
        data-testid="rejection-reason-text"
      >
        {displayReason}
      </p>
      {hint && (
        <p
          className="text-[10px] text-muted-foreground leading-tight"
          data-testid="rejection-reason-hint"
        >
          {hint}
        </p>
      )}
    </div>
  )

  if (isTruncated && rawReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{inner}</div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-wrap">{rawReason}</TooltipContent>
      </Tooltip>
    )
  }

  return inner
}

export default RejectionReasonBadge
