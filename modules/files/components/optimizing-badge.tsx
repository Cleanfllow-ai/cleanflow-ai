"use client"

/**
 * OptimizingBadge
 * ───────────────
 * Renders the file-status pill for the two Phase 7B (logical sharding) states:
 *
 *   • OPTIMIZING       → amber pill + spinner, label "Optimizing…"
 *   • OPTIMIZE_FAILED  → red pill + tooltip showing the backend error reason
 *                        (or a generic fallback when error_reason is empty).
 *
 * Used in both the file-list status column and the file-detail dialog header.
 * For any other status the component returns null so callers can fall back to
 * their existing badge renderer without an additional branch — see
 * `file-explorer-table.tsx` and `file-details-dialog.tsx`.
 *
 * Defensive by design: if the backend hasn't been upgraded to Phase 7B yet,
 * the API will never emit these statuses and this component will never render.
 */

import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/shared/lib/utils"

const OPTIMIZING_PILL =
  "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25"
const OPTIMIZE_FAILED_PILL =
  "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25"

const FALLBACK_FAILURE_REASON = "Unable to optimize file"

const PILL_CLASSNAMES =
  "text-[10px] font-medium whitespace-nowrap px-2 py-0.5 gap-1.5"

interface OptimizingBadgeProps {
  status: string | undefined | null
  /** Backend-supplied human-readable failure reason for OPTIMIZE_FAILED. */
  errorReason?: string | null
  /** Allow callers (e.g. detail header) to override sizing. */
  className?: string
}

export function OptimizingBadge({
  status,
  errorReason,
  className,
}: OptimizingBadgeProps): React.ReactElement | null {
  if (status === "OPTIMIZING") {
    return (
      <Badge
        variant="outline"
        className={cn(PILL_CLASSNAMES, OPTIMIZING_PILL, className)}
        data-testid="optimizing-badge"
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Optimizing…
      </Badge>
    )
  }

  if (status === "OPTIMIZE_FAILED") {
    const reason = errorReason && errorReason.trim().length > 0
      ? errorReason
      : FALLBACK_FAILURE_REASON
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(PILL_CLASSNAMES, OPTIMIZE_FAILED_PILL, className)}
            data-testid="optimize-failed-badge"
          >
            Optimize failed
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    )
  }

  return null
}

export default OptimizingBadge
