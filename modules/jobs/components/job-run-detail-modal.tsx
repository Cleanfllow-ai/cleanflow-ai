"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight,
    Download, Upload, Timer, Zap, BarChart3, ExternalLink, Play, Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { cn } from "@/shared/lib/utils"
import { useToast } from "@/shared/hooks/use-toast"
import { jobsAPI } from "@/modules/jobs/api/jobs-api"
import type { JobRun } from "@/modules/jobs/types/jobs.types"

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
    switch (status) {
        case "SUCCESS": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
        case "FAILED": return "bg-red-500/15 text-red-600 border-red-500/25"
        case "PARTIAL": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
        case "AWAITING_REVIEW": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
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
        case "AWAITING_REVIEW": return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
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
    jobId?: string
    onRunResumed?: () => void
}

export function JobRunDetailModal({ run, open, onOpenChange, jobId, onRunResumed }: JobRunDetailModalProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [resuming, setResuming] = useState(false)

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
                            {formatDuration(run.duration_ms ? run.duration_ms / 1000 : undefined)}
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
                    {run.correlation_id && (
                        <div className="col-span-2 space-y-1">
                            <p className="text-xs text-muted-foreground">Correlation ID</p>
                            <p className="font-mono text-xs">{run.correlation_id}</p>
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
                        <p className="text-lg font-semibold tabular-nums">{run.total_imported}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Upload className="h-3.5 w-3.5" />
                            Exported
                        </div>
                        <p className="text-lg font-semibold tabular-nums">{run.total_exported}</p>
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

                {/* ── Pipeline Logs Timeline ────────────────────────────── */}
                {run.pipeline_logs && run.pipeline_logs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            Pipeline Timeline
                        </p>
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 max-h-[250px] overflow-y-auto">
                            {run.pipeline_logs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs font-mono">
                                    <span className="text-muted-foreground shrink-0 w-[70px]">
                                        {log.timestamp ? (() => { try { return format(new Date(log.timestamp), "HH:mm:ss") } catch { return "" } })() : ""}
                                    </span>
                                    <Badge variant="outline" className={cn("text-[10px] shrink-0 w-[50px] justify-center", {
                                        "text-blue-600 border-blue-500/25": log.phase === "import",
                                        "text-purple-600 border-purple-500/25": log.phase === "dq",
                                        "text-emerald-600 border-emerald-500/25": log.phase === "export",
                                        "text-red-600 border-red-500/25": log.phase === "error",
                                        "text-amber-600 border-amber-500/25": log.phase === "retry",
                                        "text-slate-500 border-slate-500/25": log.phase === "skip",
                                    })}>
                                        {log.phase}
                                    </Badge>
                                    <span className="text-muted-foreground shrink-0">{formatEntityName(log.entity)}</span>
                                    <span className="text-foreground">{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Per-Entity Results ────────────────────────────────── */}
                {entityEntries.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                            Entity Results
                        </p>
                        <div className="rounded-lg border p-3 space-y-2">
                            {entityEntries.map(([entity, result]) => (
                                <div key={entity} className="space-y-2 border-b last:border-0 pb-2 last:pb-0">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(result.status)}
                                            <span className="font-medium">{formatEntityName(entity)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <span>{result.imported ?? 0} in</span>
                                            <span>{result.exported ?? 0} out</span>
                                            {(result.quarantined ?? 0) > 0 && (
                                                <span className="text-red-500">{result.quarantined} quarantined</span>
                                            )}
                                            {result.dq_score != null && (
                                                <Badge variant="outline" className={cn("text-[10px]", getScoreColor(Number(result.dq_score)))}>
                                                    {Number(result.dq_score).toFixed(1)}%
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {/* Awaiting review actions per entity */}
                                    {run.status === "AWAITING_REVIEW" && (result.quarantined ?? 0) > 0 && (
                                        <div className="flex items-center gap-2 ml-5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-50"
                                                onClick={() => {
                                                    const details = (result as any)
                                                    const uploadId = details.upload_id || details.file_id || ""
                                                    if (uploadId) {
                                                        router.push(`/files?file=${uploadId}&quarantine=true`)
                                                    } else {
                                                        router.push(`/files`)
                                                    }
                                                }}
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Open Quarantine Editor
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Awaiting Review Actions ────────────────────────────── */}
                {run.status === "AWAITING_REVIEW" && jobId && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <p className="text-sm font-semibold text-amber-600">Awaiting Review</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Records were quarantined during DQ validation. Review and fix them in the Quarantine Editor, then resume the export.
                        </p>
                        <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                            disabled={resuming}
                            onClick={async () => {
                                setResuming(true)
                                try {
                                    await jobsAPI.resumeRun(jobId, run.run_id)
                                    toast({ title: "Export Resumed", description: "Pipeline will re-run DQ and attempt export" })
                                    onRunResumed?.()
                                    onOpenChange(false)
                                } catch (err: any) {
                                    toast({ title: "Resume failed", description: err?.message || "Failed to resume export", variant: "destructive" })
                                } finally {
                                    setResuming(false)
                                }
                            }}
                        >
                            {resuming ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Resuming...</>
                            ) : (
                                <><Play className="h-3 w-3" /> Resume Export</>
                            )}
                        </Button>
                    </div>
                )}

                {/* ── Errors ───────────────────────────────────────────── */}
                {entityEntries.some(([, r]) => r.error) && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            Errors
                        </p>
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2 text-xs">
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
