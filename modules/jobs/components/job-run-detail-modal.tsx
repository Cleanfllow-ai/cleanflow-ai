"use client"

import { format } from "date-fns"
import {
    CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight,
    Download, Upload, Timer, Zap, BarChart3
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { cn } from "@/shared/lib/utils"
import type { JobRun } from "@/modules/jobs/types/jobs.types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
    switch (status) {
        case "SUCCESS": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
        case "FAILED": return "bg-red-500/15 text-red-600 border-red-500/25"
        case "PARTIAL": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
        case "NO_CHANGES": return "bg-slate-500/15 text-slate-600 border-slate-500/25"
        case "NO_EXPORTABLE_ROWS": return "bg-slate-500/15 text-slate-600 border-slate-500/25"
        case "SKIPPED": return "bg-slate-500/15 text-slate-500 border-slate-500/25"
        default: return "bg-muted text-muted-foreground border-border"
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case "SUCCESS": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-500" />
        case "PARTIAL": return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
}

function getScoreColor(score: number) {
    if (score >= 90) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
    if (score >= 70) return "bg-amber-500/15 text-amber-600 border-amber-500/25"
    return "bg-red-500/15 text-red-600 border-red-500/25"
}

function formatDuration(seconds: number | undefined): string {
    if (!seconds) return "—"
    const s = Number(seconds) // Convert Decimal to number
    if (s < 1) return `${(s * 1000).toFixed(0)}ms`
    if (s < 60) return `${s.toFixed(1)}s`
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    if (mins < 60) return `${mins}m ${secs}s`
    const hrs = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hrs}h ${remMins}m`
}

function formatEntityName(entity: string): string {
    return entity.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Component ──────────────────────────────────────────────────────────────

interface JobRunDetailModalProps {
    run: JobRun | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function JobRunDetailModal({ run, open, onOpenChange }: JobRunDetailModalProps) {
    if (!run) return null

    const entityEntries = Object.entries(run.entity_results || {})
    const meta = run.processing_metadata
    const avgScore = meta?.avg_dq_score

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        Run Detail
                        <Badge variant="outline" className={cn("text-xs", getStatusColor(run.status))}>
                            {run.status}
                        </Badge>
                        {run.trigger_source && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                <Zap className="h-3 w-3 mr-1" />
                                {run.trigger_source === "manual_trigger" ? "Manual" : "Scheduled"}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {/* ── Run Info ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Run ID</p>
                        <p className="font-mono text-xs">{run.run_id}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDuration(run.duration_seconds)}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Started</p>
                        <p className="text-xs">
                            {run.started_at ? (() => { try { return format(new Date(run.started_at), "MMM d, yyyy HH:mm:ss") } catch { return "\u2014" } })() : "\u2014"}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Completed</p>
                        <p className="text-xs">
                            {run.completed_at ? (() => { try { return format(new Date(run.completed_at), "MMM d, yyyy HH:mm:ss") } catch { return "\u2014" } })() : "\u2014"}
                        </p>
                    </div>
                    {run.source_erp && (
                        <div className="col-span-2 space-y-1">
                            <p className="text-xs text-muted-foreground">Pipeline</p>
                            <p className="flex items-center gap-1.5 text-sm">
                                <span className="font-medium text-primary">{run.source_erp}</span>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{run.destination_erp}</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Summary Cards ────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Download className="h-3.5 w-3.5" />
                            Imported
                        </div>
                        <p className="text-lg font-semibold tabular-nums">{run.total_records_imported}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Upload className="h-3.5 w-3.5" />
                            Exported
                        </div>
                        <p className="text-lg font-semibold tabular-nums">{run.total_records_exported}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Avg DQ Score
                        </div>
                        {avgScore != null ? (
                            <Badge variant="outline" className={cn("text-sm font-semibold tabular-nums", getScoreColor(avgScore))}>
                                {Number(avgScore).toFixed(1)}%
                            </Badge>
                        ) : (
                            <p className="text-lg font-semibold text-muted-foreground">—</p>
                        )}
                    </div>
                </div>

                {/* ── Processing Metadata ──────────────────────────────── */}
                {meta && (meta.total_new_records > 0 || meta.total_skipped_duplicates > 0) && (
                    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                        <p className="font-medium text-sm">Dedup Summary</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-muted-foreground">New Records: </span>
                                <strong>{meta.total_new_records}</strong>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Skipped (Duplicates): </span>
                                <strong>{meta.total_skipped_duplicates}</strong>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── DQ Processing Summary ─────────────────────────────── */}
                {(() => {
                    // Aggregate DQ stats across all entities
                    const dqStats = entityEntries.reduce((acc, [, result]) => ({
                        rows_in: acc.rows_in + Number(result.rows_in || 0),
                        rows_clean: acc.rows_clean + Number(result.rows_clean || 0),
                        rows_fixed: acc.rows_fixed + Number(result.rows_fixed || 0),
                        rows_quarantined: acc.rows_quarantined + Number(result.rows_quarantined || 0),
                    }), { rows_in: 0, rows_clean: 0, rows_fixed: 0, rows_quarantined: 0 })

                    if (dqStats.rows_in === 0) return null

                    return (
                        <div className="rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5 p-3 text-xs space-y-2">
                            <p className="font-medium text-sm flex items-center gap-1.5">
                                <BarChart3 className="h-4 w-4 text-blue-600" />
                                Data Quality Processing
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div>
                                    <span className="text-muted-foreground block">Rows In:</span>
                                    <strong className="text-base">{dqStats.rows_in}</strong>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Clean:</span>
                                    <strong className="text-base text-emerald-600">{dqStats.rows_clean}</strong>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Fixed:</span>
                                    <strong className="text-base text-amber-600">{dqStats.rows_fixed}</strong>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Quarantined:</span>
                                    <strong className="text-base text-red-600">{dqStats.rows_quarantined}</strong>
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* ── Errors ───────────────────────────────────────────── */}
                {(run.error || entityEntries.some(([, r]) => r.error)) && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            Errors
                        </p>
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2 text-xs">
                            {run.error && (
                                <p className="text-red-600">{run.error}</p>
                            )}
                            {entityEntries.map(([entity, result]) =>
                                result.error ? (
                                    <div key={entity}>
                                        <span className="font-medium">{formatEntityName(entity)}: </span>
                                        <span className="text-red-600">{result.error}</span>
                                    </div>
                                ) : null
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
