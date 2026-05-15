"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight,
    Download, Upload, Timer, Zap, BarChart3, ExternalLink, Loader2, RefreshCw
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/modules/auth"
import { fileManagementAPI } from "@/modules/files/api/file-management-api"
import type { FileStatusResponse } from "@/modules/files/types"
import type { JobRun } from "@/modules/jobs/types/jobs.types"
import { JobErrorBanner } from "./job-error-banner"

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
    switch (status) {
        case "SUCCESS": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
        case "FAILED": return "bg-red-500/15 text-red-600 border-red-500/25"
        case "PARTIAL": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
        case "AWAITING_REVIEW": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
        case "NO_CHANGES": return "bg-slate-500/20 text-slate-300 border-slate-500/30"
        case "NO_EXPORTABLE_ROWS": return "bg-slate-500/20 text-slate-300 border-slate-500/30"
        case "SKIPPED": return "bg-slate-500/20 text-slate-300 border-slate-500/30"
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
    if (score >= 90) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
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

function safeFormatDate(value: string | undefined, fmt: string): string {
    if (!value) return "—"
    try { return format(new Date(value), fmt) } catch { return "—" }
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
    onRefresh?: () => void | Promise<void>
    refreshing?: boolean
}

async function fetchLiveFileStatus(uploadId: string, token: string): Promise<FileStatusResponse | null> {
    try {
        const [file, versionsResp] = await Promise.all([
            fileManagementAPI.getFileStatus(uploadId, token),
            fileManagementAPI.getFileVersions(uploadId, token).catch(() => ({ versions: [] as any[], count: 0 })),
        ])
        const versions = versionsResp.versions || []
        if (versions.length > 0) {
            const latest = versions.find((v: any) => v.is_latest) ||
                versions.reduce((a: any, b: any) => ((a.version_number || 0) >= (b.version_number || 0) ? a : b))
            if (latest.dq_score != null) file.dq_score = latest.dq_score
            if (latest.status) file.status = latest.status as FileStatusResponse["status"]
            if (latest.rows_in != null) file.rows_in = latest.rows_in
            if (latest.rows_clean != null) file.rows_clean = latest.rows_clean
            if (latest.rows_quarantined != null) file.rows_quarantined = latest.rows_quarantined
            if (latest.rows_out != null) file.rows_out = latest.rows_out
            ;(file as any).version_count = versions.length
            ;(file as any).version_number = latest.version_number
        }
        return file
    } catch {
        return null
    }
}

function getFileStatusColor(status: string | undefined) {
    const s = (status || "").toUpperCase()
    if (s.includes("FIXED") || s.includes("COMPLETED") || s.includes("PROCESSED"))
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    if (s.includes("FAILED")) return "bg-red-500/15 text-red-600 border-red-500/25"
    if (s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED"))
        return "bg-blue-500/15 text-blue-400 border-blue-500/30"
    if (s.includes("QUARANTINED")) return "bg-amber-500/15 text-amber-600 border-amber-500/25"
    return "bg-slate-500/20 text-slate-300 border-slate-500/30"
}

export function JobRunDetailModal({ run, open, onOpenChange, jobId, onRunResumed, onRefresh, refreshing }: JobRunDetailModalProps) {
    const router = useRouter()
    const { idToken } = useAuth()
    const [liveFiles, setLiveFiles] = useState<Record<string, FileStatusResponse | null>>({})
    const [liveLoading, setLiveLoading] = useState(false)

    const refreshLiveFiles = async () => {
        if (!run || !idToken) return
        const pairs = Object.entries(run.entity_results || {})
            .map(([entity, result]) => ({ entity, uploadId: (result as any).upload_id as string | undefined }))
            .filter((p): p is { entity: string; uploadId: string } => !!p.uploadId)
        if (pairs.length === 0) return
        setLiveLoading(true)
        try {
            const results = await Promise.all(
                pairs.map(async ({ entity, uploadId }) => [entity, await fetchLiveFileStatus(uploadId, idToken)] as const)
            )
            setLiveFiles(Object.fromEntries(results))
        } finally {
            setLiveLoading(false)
        }
    }

    // Fetch live file status when the modal opens and whenever the tab regains visibility.
    useEffect(() => {
        if (!open) return
        void refreshLiveFiles()
        const onVisible = () => {
            if (document.visibilityState === "visible") {
                void refreshLiveFiles()
                if (onRefresh) void onRefresh()
            }
        }
        document.addEventListener("visibilitychange", onVisible)
        return () => document.removeEventListener("visibilitychange", onVisible)
    }, [open, run?.run_id, idToken]) // eslint-disable-line react-hooks/exhaustive-deps

    if (!run) return null

    const entityEntries = Object.entries(run.entity_results || {})
    const meta = run.processing_metadata
    const avgScore = meta?.avg_dq_score

    // Partial-success CTA: when some rows pushed but some quarantined,
    // surface a clear "97 of 100 pushed" banner with a one-click route to
    // the quarantine editor for the FIRST entity that has remaining
    // quarantined rows (most jobs only export one entity per run).
    const showPartialBanner =
        run.status === "PARTIAL" && (run.total_quarantined || 0) > 0
    const firstQuarantinedEntity = entityEntries.find(
        ([, r]) => (r.quarantined ?? 0) > 0 && (r as any).upload_id,
    )
    const partialQuarantineUploadId = firstQuarantinedEntity
        ? ((firstQuarantinedEntity[1] as any).upload_id as string | undefined)
        : undefined

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
                                {run.trigger_source === "manual"
                                    ? "Manual"
                                    : run.trigger_source === "resume"
                                        ? "Resumed"
                                        : "Scheduled"}
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-7 w-7"
                            onClick={() => { if (onRefresh) void onRefresh(); void refreshLiveFiles() }}
                            disabled={refreshing || liveLoading}
                            title="Refresh run & file status"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", (refreshing || liveLoading) && "animate-spin")} />
                        </Button>
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
                        <p className="text-xs">{safeFormatDate(run.started_at, "MMM d, yyyy HH:mm:ss")}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Completed</p>
                        <p className="text-xs">{safeFormatDate(run.completed_at, "MMM d, yyyy HH:mm:ss")}</p>
                    </div>
                    {run.correlation_id && (
                        <div className="col-span-2 space-y-1">
                            <p className="text-xs text-muted-foreground">Correlation ID</p>
                            <p className="font-mono text-xs">{run.correlation_id}</p>
                        </div>
                    )}
                </div>

                {/* ── Structured failure banner ─────────────────────────── */}
                {run.error_code && (
                    <JobErrorBanner
                        errorCode={run.error_code}
                        errorMessage={run.error_message}
                        onAction={(key) => {
                            if (key === "edit" || key === "manage") {
                                onOpenChange(false)
                            }
                            // "rerun" / "view_logs" handled by parent — bubble via onAction prop if needed
                        }}
                        className="mt-1"
                    />
                )}

                {/* ── Partial-success CTA ───────────────────────────────── */}
                {showPartialBanner && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>
                                <span className="font-semibold tabular-nums">{run.total_exported || 0}</span>
                                {" of "}
                                <span className="font-semibold tabular-nums">{run.total_imported || 0}</span>
                                {" records pushed to destination"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>
                                <span className="font-semibold tabular-nums">{run.total_quarantined}</span>
                                {" record" + (run.total_quarantined === 1 ? "" : "s")}
                                {" awaiting your review"}
                            </span>
                        </div>
                        {partialQuarantineUploadId && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 mt-1"
                                onClick={() => router.push(`/files/${partialQuarantineUploadId}/quarantine?returnTo=/jobs`)}
                            >
                                <ExternalLink className="h-3 w-3" />
                                Open Quarantine Editor
                            </Button>
                        )}
                    </div>
                )}

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
                                        {safeFormatDate(log.timestamp, "HH:mm:ss").replace("—", "")}
                                    </span>
                                    <Badge variant="outline" className={cn("text-[10px] shrink-0 w-[50px] justify-center", {
                                        "text-blue-400 border-blue-500/30": log.phase === "import",
                                        "text-purple-400 border-purple-500/30": log.phase === "dq",
                                        "text-emerald-400 border-emerald-500/30": log.phase === "export",
                                        "text-red-400 border-red-500/30": log.phase === "error",
                                        "text-amber-400 border-amber-500/30": log.phase === "retry",
                                        "text-slate-300 border-slate-500/30": log.phase === "skip",
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
                        <div className="rounded-lg border p-3 space-y-3">
                            {entityEntries.map(([entity, result]) => {
                                const uploadId = (result as any).upload_id as string | undefined
                                const live = uploadId ? liveFiles[entity] : null
                                const liveVersionNum = (live as any)?.version_number
                                const liveVersionCount = (live as any)?.version_count
                                const wasReprocessed = !!live && typeof liveVersionCount === "number" && liveVersionCount > 1
                                return (
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

                                        {/* Live file status (post-reprocess) */}
                                        {uploadId && (
                                            <div className="ml-5 flex items-center gap-3 text-[11px] text-muted-foreground bg-muted/30 rounded px-2.5 py-1.5">
                                                <span className="uppercase tracking-wide text-[10px] font-semibold text-muted-foreground/80">Current</span>
                                                {liveLoading && !live ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : !live ? (
                                                    <span className="italic">Status unavailable</span>
                                                ) : (
                                                    <>
                                                        <Badge variant="outline" className={cn("text-[10px]", getFileStatusColor(live.status))}>
                                                            {live.status}
                                                        </Badge>
                                                        {wasReprocessed && (
                                                            <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-600">
                                                                Reprocessed · v{liveVersionNum ?? liveVersionCount}
                                                            </Badge>
                                                        )}
                                                        {(live.rows_clean ?? 0) > 0 && (
                                                            <span className="tabular-nums">{live.rows_clean} clean</span>
                                                        )}
                                                        {(live.rows_quarantined ?? 0) > 0 && (
                                                            <span className="tabular-nums text-red-500">{live.rows_quarantined} quarantined</span>
                                                        )}
                                                        {live.dq_score != null && (
                                                            <Badge variant="outline" className={cn("text-[10px] tabular-nums", getScoreColor(Number(live.dq_score)))}>
                                                                {Number(live.dq_score).toFixed(1)}%
                                                            </Badge>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Quarantine editor entry */}
                                        {(result.quarantined ?? 0) > 0 && uploadId && (
                                            <div className="flex items-center gap-2 ml-5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                                    onClick={() => router.push(`/files/${uploadId}/quarantine?returnTo=/jobs`)}
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Open Quarantine Editor
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ── Entity-level errors (non-export) ────────────────── */}
                {entityEntries.some(([, r]) => r.error) && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            Errors
                        </p>
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2 text-xs">
                            {entityEntries.map(([entity, result]) => {
                                if (!result.error) return null
                                return (
                                    <div key={entity}>
                                        <span className="font-medium">{formatEntityName(entity)}: </span>
                                        <span className="text-red-600">{result.error}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ── Export errors from pipeline logs ──────────────────── */}
                {run.pipeline_logs?.some(l => l.phase === "export" && l.details?.errors?.length) && (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            Export Failures
                        </p>
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1 text-xs max-h-[200px] overflow-y-auto">
                            {run.pipeline_logs
                                .filter(l => l.phase === "export" && l.details?.errors?.length)
                                // l.details is guaranteed by the filter above, but the
                                // strict-null compiler doesn't narrow across .filter →
                                // .flatMap, so coerce safely with `?? []`.
                                .flatMap(l => (l.details?.errors as Array<{ row?: number; error: string }> | undefined) ?? [])
                                .map((err, i) => (
                                    <div key={i} className="text-red-600">
                                        {err.row != null && <span className="text-muted-foreground mr-1">Row {err.row}:</span>}
                                        {err.error}
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
