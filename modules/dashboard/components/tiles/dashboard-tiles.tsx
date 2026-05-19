/** AA4 Phase 1 tiles — RecentFiles, DqTrend, RecentAugmentations. */
"use client"

// TODO: re-enable after augmentation audit completes (track: a575f372010d13bca)
const AUGMENTATION_ENABLED = false

import Link from "next/link"
import { FileText, LineChart as LineChartIcon, Sparkles, Upload } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import type {
    DashboardAugmentationJob, DashboardRecentFile, DashboardTrendPoint,
} from "@/modules/dashboard/types/dashboard-summary.types"

const fmtBytes = (b?: number) => {
    if (!b || b <= 0) return "—"
    const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0, n = b
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
    return `${n.toFixed(1)} ${u[i]}`
}
const fmtDate = (iso?: string) => {
    if (!iso) return "—"
    try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }
    catch { return "—" }
}
const fmtCost = (n?: number | null) =>
    (typeof n === "number" && Number.isFinite(n)) ? `$${n.toFixed(2)}` : "—"

const filePillClass = (s?: string) =>
    s === "DQ_FIXED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        : (s === "DQ_FAILED" || s === "REJECTED") ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            : (s === "UPLOADING" || s === "DQ_RUNNING") ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-muted text-muted-foreground"
const jobPillClass = (s?: string) =>
    s === "SUCCEEDED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        : s === "FAILED" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            : (s === "RUNNING" || s === "PENDING") ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-muted text-muted-foreground"

export function RecentFilesTile({ files }: { files: DashboardRecentFile[] }) {
    return (
        <section data-testid="recent-files-tile" aria-label="Recent files"
            className="rounded-xl border border-border bg-card p-5">
            <header className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Recent files</h2>
                <Link href="/files" className="text-xs text-primary hover:underline">View all</Link>
            </header>
            {files.length === 0 ? (
                <div data-testid="recent-files-empty"
                    className="flex flex-col items-center gap-2 py-8 text-center">
                    <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground">No files yet</p>
                    <Link href="/files"
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                        Upload your first file
                    </Link>
                </div>
            ) : (
                <ul className="divide-y divide-border">
                    {files.map((f) => (
                        <li key={f.upload_id || f.original_filename}
                            className="flex items-center justify-between gap-3 py-2 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="truncate font-medium text-foreground">
                                    {f.original_filename || f.filename || f.upload_id}
                                </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">{fmtBytes(f.total_size)}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${filePillClass(f.status)}`}>
                                    {f.status || "—"}
                                </span>
                                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                                    {typeof f.dq_score === "number" ? `${Math.round(f.dq_score)}%` : "—"}
                                </span>
                                <span className="w-14 text-right text-xs text-muted-foreground">
                                    {fmtDate(f.updated_at || f.created_at)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

export function DqTrendTile({ points }: { points: DashboardTrendPoint[] }) {
    return (
        <section data-testid="dq-trend-tile" aria-label="DQ score trend"
            className="rounded-xl border border-border bg-card p-5">
            <header className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">DQ score (30-day)</h2>
                <span className="text-xs text-muted-foreground">avg per day</span>
            </header>
            {points.length === 0 ? (
                <div data-testid="dq-trend-empty"
                    className="flex flex-col items-center gap-2 py-12 text-center">
                    <LineChartIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground">No DQ runs in the last 30 days</p>
                </div>
            ) : (
                <div className="h-56 w-full" data-testid="dq-trend-chart">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }}
                                tickFormatter={(v: string) => v?.slice(5)} minTickGap={20} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                            <Tooltip formatter={(v: number) => [`${v}%`, "Avg DQ"]} />
                            <Line type="monotone" dataKey="avg_dq_score"
                                stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    )
}

const SCENARIOS = [
    { id: "A", title: "Scenario A — N invoices → N PoBs", href: "/augmentation?template=rightrev-A" },
    { id: "B", title: "Scenario B — N invoices → 1 annual summary", href: "/augmentation?template=rightrev-B" },
    { id: "C", title: "Scenario C — 1 invoice → N monthly", href: "/augmentation?template=rightrev-C" },
]

export function RecentAugmentationsTile({ jobs }: { jobs: DashboardAugmentationJob[] }) {
    return (
        <section data-testid="recent-augmentations-tile" aria-label="Recent augmentation jobs"
            className="rounded-xl border border-border bg-card p-5">
            <header className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Augmentation jobs</h2>
                <Link href="/augmentation" className="text-xs text-primary hover:underline">View all</Link>
            </header>
            {jobs.length === 0 ? (
                <div data-testid="recent-augmentations-empty" className="space-y-2">
                    <p className="mb-3 text-sm text-muted-foreground">Try a RightRev scenario</p>
                    {SCENARIOS.map((s) => (
                        <Link key={s.id} href={s.href}
                            className="flex items-center gap-2 rounded-md border border-border p-2 text-xs hover:bg-muted/40">
                            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                            <span className="text-foreground">{s.title}</span>
                        </Link>
                    ))}
                </div>
            ) : (
                <ul className="divide-y divide-border">
                    {jobs.map((j) => (
                        <li key={j.job_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate font-medium text-foreground">
                                    {j.prompt_template_id || j.job_id}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{fmtDate(j.created_at)}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {fmtCost(j.cost_actual_usd ?? j.cost_estimate_usd)}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${jobPillClass(j.status)}`}>
                                    {j.status || "—"}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
