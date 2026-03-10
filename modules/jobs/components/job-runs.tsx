"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, XCircle, Clock, Activity } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/shared/lib/utils"
import { jobsAPI, type JobRun } from "@/modules/jobs/api/jobs-api"

// ─── Component ────────────────────────────────────────────────────────────────

interface JobRunsPanelProps {
    jobId: string
}

export function JobRunsPanel({ jobId }: JobRunsPanelProps) {
    const [runs, setRuns] = useState<JobRun[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const res = await jobsAPI.getJobRuns(jobId, 10)
                if (!cancelled) setRuns(res.runs || [])
            } catch {
                if (!cancelled) setRuns([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [jobId])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading run history...</span>
            </div>
        )
    }

    if (runs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-6">
                <Activity className="h-5 w-5 text-muted-foreground/50 mb-2" />
                <span className="text-sm text-muted-foreground">No runs yet</span>
            </div>
        )
    }

    return (
        <div className="px-6 py-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Recent Runs
            </div>
            <div className="space-y-1.5">
                {runs.map((run) => (
                    <div
                        key={run.run_id}
                        className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                            "bg-background/60 border border-border/40"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            {run.status === "SUCCESS" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {run.status === "FAILED" && <XCircle className="h-4 w-4 text-red-500" />}
                            {run.status === "RUNNING" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                            <span className="text-muted-foreground">
                                {run.started_at ? format(new Date(run.started_at), "MMM d, yyyy HH:mm:ss") : "—"}
                            </span>
                        </div>
                        <div className="flex items-center gap-6 text-xs text-muted-foreground">
                            {run.records_fetched !== undefined && (
                                <span>Fetched: <strong className="text-foreground">{run.records_fetched}</strong></span>
                            )}
                            {run.records_written !== undefined && (
                                <span>Written: <strong className="text-foreground">{run.records_written}</strong></span>
                            )}
                            {run.duration_seconds !== undefined && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {run.duration_seconds < 60
                                        ? `${run.duration_seconds}s`
                                        : `${Math.floor(run.duration_seconds / 60)}m ${run.duration_seconds % 60}s`
                                    }
                                </span>
                            )}
                            {run.error && (
                                <span className="text-red-500 max-w-[200px] truncate" title={run.error}>
                                    {run.error}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
