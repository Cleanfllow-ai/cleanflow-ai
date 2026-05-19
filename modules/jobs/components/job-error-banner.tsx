"use client"

/**
 * JobErrorBanner — inline error strip shown in JobRuns rows and the detail modal
 * for the 5 structured failure modes.
 *
 * Failure modes:
 *   JOB_CRON_INVALID             → Edit schedule button
 *   JOB_PREVIOUS_STILL_RUNNING   → info only (warning indicator, no action)
 *   JOB_DOWNSTREAM_UNAVAILABLE   → View Logs button
 *   JOB_RETRIES_EXHAUSTED        → Re-run Now button
 *   JOB_QUOTA_EXCEEDED           → Manage Schedules button
 */

import { AlertTriangle, AlertCircle, Info, RefreshCw, Settings, ExternalLink, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { JobErrorCode } from "@/modules/jobs/types/jobs.types"

// ─── Config ──────────────────────────────────────────────────────────────────

interface ErrorConfig {
    icon: React.ElementType
    variant: "warning" | "error" | "info"
    /** Toast/inline copy. Use {connector} and {N} as placeholders. */
    message: (opts: { connector?: string; activeCount?: number }) => string
    /** CTA label shown on the action button. Null = no button. */
    action: string | null
    /** Identifier the parent passes to onAction */
    actionKey: string | null
}

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
    JOB_CRON_INVALID: {
        icon: AlertCircle,
        variant: "error",
        message: () => "Schedule expression is malformed. Use cron(0 9 * * ? *) format.",
        action: "Edit Schedule",
        actionKey: "edit",
    },
    JOB_PREVIOUS_STILL_RUNNING: {
        icon: Info,
        variant: "info",
        message: () => "Previous job didn't finish — this run skipped.",
        action: null,
        actionKey: null,
    },
    JOB_DOWNSTREAM_UNAVAILABLE: {
        icon: AlertTriangle,
        variant: "warning",
        message: ({ connector }) =>
            `Job failed: ${connector ?? "connector"} couldn't be reached. Auto-retrying in 15 min.`,
        action: "View Logs",
        actionKey: "view_logs",
    },
    JOB_RETRIES_EXHAUSTED: {
        icon: AlertTriangle,
        variant: "error",
        message: ({ connector }) =>
            `Job failed after 3 retries. Check ${connector ?? "connector"} and trigger manually.`,
        action: "Re-run Now",
        actionKey: "rerun",
    },
    JOB_QUOTA_EXCEEDED: {
        icon: AlertCircle,
        variant: "error",
        message: ({ activeCount }) =>
            activeCount != null && activeCount > 0
                ? `Plan-tier limit reached: ${activeCount} active schedules. Pause or upgrade.`
                : "Plan-tier limit reached. Pause or upgrade to add more schedules.",
        action: "Manage Schedules",
        actionKey: "manage",
    },
}

const VARIANT_STYLES = {
    warning: "bg-amber-1000/10 border-amber-500/25 text-amber-800 dark:text-amber-400",
    error: "bg-red-1000/10 border-red-500/25 text-red-800 dark:text-red-400",
    info: "bg-blue-1000/10 border-blue-500/25 text-blue-800 dark:text-blue-400",
}

const ACTION_ICONS: Record<string, LucideIcon> = {
    "View Logs": ExternalLink,
    "Re-run Now": RefreshCw,
    "Manage Schedules": Settings,
}

function ActionButtonContent({ label }: { label: string }) {
    const Icon = ACTION_ICONS[label]
    return Icon ? <><Icon className="h-3 w-3 mr-1" />{label}</> : <>{label}</>
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface JobErrorBannerProps {
    errorCode: JobErrorCode | string
    /** Raw error_message from the JobRun — used as fallback copy and to extract connector name. */
    errorMessage?: string
    /** Connector name override (e.g. from the job definition). */
    connector?: string
    /** Active schedule count for JOB_QUOTA_EXCEEDED. */
    activeCount?: number
    onAction?: (actionKey: string) => void
    className?: string
    /** Compact single-line mode for use inside table rows. */
    compact?: boolean
}

export function JobErrorBanner({
    errorCode,
    errorMessage,
    connector,
    activeCount,
    onAction,
    className,
    compact = false,
}: JobErrorBannerProps) {
    const cfg = ERROR_CONFIGS[errorCode]
    if (!cfg) {
        // Unknown code — show a generic error strip so nothing is silently swallowed.
        return (
            <div className={cn(
                "flex items-start gap-2 rounded border px-3 py-2 text-xs",
                VARIANT_STYLES.error,
                className,
            )}>
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{errorMessage || `Job error: ${errorCode}`}</span>
            </div>
        )
    }

    const Icon = cfg.icon
    const copy = cfg.message({ connector, activeCount })

    if (compact) {
        // Inline row pill — icon + short copy only
        return (
            <span
                className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border",
                    VARIANT_STYLES[cfg.variant],
                    className,
                )}
                title={copy}
            >
                <Icon className="h-3 w-3 shrink-0" />
                {errorCode.replace("JOB_", "").replace(/_/g, " ")}
            </span>
        )
    }

    return (
        <div
            className={cn(
                "flex items-start justify-between gap-3 rounded-md border px-3 py-2.5",
                VARIANT_STYLES[cfg.variant],
                className,
            )}
        >
            <div className="flex items-start gap-2 text-xs leading-relaxed">
                <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{copy}</span>
            </div>
            {cfg.action && onAction && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] shrink-0 border-current/40 hover:bg-current/10"
                    onClick={() => onAction(cfg.actionKey!)}
                >
                    <ActionButtonContent label={cfg.action} />
                </Button>
            )}
        </div>
    )
}
