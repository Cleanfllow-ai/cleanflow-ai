/**
 * CustomerUsageDashboard — AA4 Phase 1 page composition.
 *
 * Replaces the legacy admin-style /dashboard with a customer-facing view:
 *   - Topbar: rows MTD + files completed MTD + last file
 *   - 3-tile grid (recent files, DQ trend, recent augmentations)
 *
 * Single network call on mount (GET /dashboard/summary via use-dashboard-summary).
 */
"use client"

import { useDashboardSummary } from "@/modules/dashboard/hooks/use-dashboard-summary"
import {
    RecentFilesTile, DqTrendTile, RecentAugmentationsTile,
} from "@/modules/dashboard/components/tiles/dashboard-tiles"
import { AlertTriangle } from "lucide-react"

// TODO: re-enable after augmentation audit completes (track: a575f372010d13bca)
const AUGMENTATION_ENABLED = false

const fmtNumber = (n: number) => n.toLocaleString()

function DashboardTopbar({
    rowsMtd, filesMtd, lastFile,
}: {
    rowsMtd: number
    filesMtd: number
    lastFile: { original_filename?: string | undefined; status?: string | undefined; upload_id?: string | undefined } | null
}) {
    return (
        <header
            data-testid="dashboard-topbar"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
            <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Rows processed (MTD)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {fmtNumber(rowsMtd)}
                </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Files completed (MTD)
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {fmtNumber(filesMtd)}
                </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Last file processed
                </p>
                {lastFile ? (
                    <div className="mt-1 flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                            {lastFile.original_filename || lastFile.upload_id}
                        </p>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {lastFile.status}
                        </span>
                    </div>
                ) : (
                    <p className="mt-1 text-sm text-muted-foreground">—</p>
                )}
            </div>
        </header>
    )
}

export function CustomerUsageDashboard() {
    const { data, isLoading, error } = useDashboardSummary()

    if (isLoading) {
        return (
            <div
                data-testid="dashboard-loading"
                className="space-y-5"
                role="status"
                aria-busy="true"
                aria-label="Loading dashboard"
            >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-64 animate-pulse rounded-xl border border-border bg-card" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        // Surface a generic message — `error.message` may contain raw server
        // text (HTTP status lines, stack hints) we don't want to leak. The
        // dev console still has the full error from the fetch helper.
        const benign =
            /permission denied|organization membership required|forbidden/i.test(error.message)
        return (
            <div
                data-testid="dashboard-error"
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                    <p className="font-medium">
                        {benign ? "Dashboard unavailable" : "Failed to load dashboard"}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                        {benign
                            ? "You don't have access to dashboard data for this organization."
                            : "Please refresh the page. If the issue persists, contact support."}
                    </p>
                </div>
            </div>
        )
    }

    if (!data) {
        // Defensive — show an empty-state rather than a blank screen.
        return (
            <div
                data-testid="dashboard-empty"
                className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground"
            >
                No dashboard data yet.
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <DashboardTopbar
                rowsMtd={data.topbar.rows_processed_mtd}
                filesMtd={data.topbar.files_completed_mtd}
                lastFile={data.topbar.last_file}
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <RecentFilesTile files={data.recent_files} />
                </div>
                <div className={AUGMENTATION_ENABLED ? "lg:col-span-1" : "lg:col-span-2"}>
                    <DqTrendTile points={data.dq_score_trend} />
                </div>
                {AUGMENTATION_ENABLED && (
                    <div className="lg:col-span-1">
                        <RecentAugmentationsTile jobs={data.recent_augmentations} />
                    </div>
                )}
            </div>
        </div>
    )
}
