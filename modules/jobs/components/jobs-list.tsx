"use client"

import { Fragment, useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
    CalendarClock, ChevronDown, ChevronRight, Clock, Edit2, Loader2, MoreHorizontal,
    Pause, Play, Plus, RefreshCw, Search, Trash2, AlertTriangle, CheckCircle2,
    XCircle, ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { useToast } from "@/shared/hooks/use-toast"
import { cn } from "@/shared/lib/utils"
import { jobsAPI, type Job, frequencyFromBackend } from "@/modules/jobs/api/jobs-api"
import { isApiError } from "@/modules/shared/api-error"
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper"
import { JobDialog } from "./job-dialog"
import { JobRunsExplorer } from "./job-runs-explorer"

// Map an unknown error → user-facing toast copy + UX-correct severity.
// Distinguishes:
//   401 → session expired / re-login
//   403 → insufficient role (no point re-logging in)
//   409 → conflict (pause/resume mismatch, concurrent edit)
//   5xx → generic backend failure
// Anything else falls back to the API-provided message.
function describeJobError(err: unknown, fallback: string): { title: string; description: string } {
    if (isApiError(err)) {
        if (err.status === 401) {
            return { title: "Session expired", description: "Please sign in again to continue." }
        }
        if (err.status === 403) {
            return { title: "Permission denied", description: err.message || "Your role doesn't allow this action." }
        }
        if (err.status === 409) {
            return { title: "Conflict", description: err.message || "The job state changed — refresh and retry." }
        }
        if (err.status >= 500) {
            return { title: "Server error", description: err.message || "The backend is temporarily unavailable. Try again." }
        }
        return { title: fallback, description: err.message }
    }
    return { title: fallback, description: (err as Error)?.message || "Something went wrong" }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { getProviderDisplayName } from "./job-dialog-constants"

const FREQ_LABELS: Record<string, string> = {
    "15min": "Every 15 min",
    "1hr": "Every hour",
    daily: "Daily",
    cron: "Custom",
}

const statusBadge = (status: string) => {
    switch (status) {
        case "ACTIVE":
            return (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/15 font-medium text-[11px] tracking-wide uppercase gap-1.5 px-2.5 py-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Active
                </Badge>
            )
        case "PAUSED":
            return (
                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/15 font-medium text-[11px] tracking-wide uppercase gap-1.5 px-2.5 py-0.5">
                    <Pause className="h-3 w-3" />
                    Paused
                </Badge>
            )
        case "FAILED":
            return (
                <Badge className="bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/15 font-medium text-[11px] tracking-wide uppercase gap-1.5 px-2.5 py-0.5">
                    <XCircle className="h-3 w-3" />
                    Failed
                </Badge>
            )
        case "AUTO_PAUSED":
            return (
                <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/15 font-medium text-[11px] tracking-wide uppercase gap-1.5 px-2.5 py-0.5">
                    <Pause className="h-3 w-3" />
                    Auto-Paused
                </Badge>
            )
        default:
            return (
                <Badge variant="outline" className="text-[11px] tracking-wide uppercase px-2.5 py-0.5">
                    {status}
                </Badge>
            )
    }
}

const runStatusIcon = (status: string) => {
    switch (status) {
        case "SUCCESS":
            return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        case "FAILED":
            return <XCircle className="h-3.5 w-3.5 text-red-500" />
        case "PARTIAL":
            return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        case "AWAITING_REVIEW":
            return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        case "NO_CHANGES":
            return <Clock className="h-3.5 w-3.5 text-slate-400" />
        case "RUNNING":
            return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        default:
            return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JobsList() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingJob, setEditingJob] = useState<Job | null>(null)

    // Delete state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [jobToDelete, setJobToDelete] = useState<Job | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Expanded row (run history)
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

    // Action loading
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Batch selection
    const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
    const [batchActionLoading, setBatchActionLoading] = useState<null | "run" | "pause" | "resume" | "delete">(null)
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

    const { toast } = useToast()
    const router = useRouter()

    // ─── Data Loading ───────────────────────────────────────────────────────

    // `silent` skips the loading-state toggle so auto-polls don't re-mount
    // the skeleton (which causes a visible UI jerk every 10s).
    const loadJobs = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const res = await jobsAPI.listJobs()
            setJobs(res.jobs || [])
        } catch (err) {
            console.error("Failed to load jobs:", err)
            if (!silent) {
                toast({ title: "Error", description: "Failed to load jobs", variant: "destructive" })
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }, [toast])

    // Load on mount (with skeleton)
    useEffect(() => {
        loadJobs()
    }, [loadJobs])

    // Auto-poll every 10s when any job was recently triggered or is running.
    // Silent path so the table updates in place instead of re-mounting.
    useEffect(() => {
        const hasActiveRun = jobs.some(j =>
            j.last_run_status === "RUNNING" ||
            j.last_run_status === "AWAITING_REVIEW" ||
            (j.last_run_at && Date.now() - new Date(j.last_run_at).getTime() < 2 * 60 * 1000)
        )
        if (!hasActiveRun) return
        const interval = setInterval(() => { void loadJobs(true) }, 10_000)
        return () => clearInterval(interval)
    }, [jobs, loadJobs])

    // ─── Filtering ──────────────────────────────────────────────────────────

    const filteredJobs = jobs
        .filter(job => {
            if (!searchQuery) return true
            const q = searchQuery.toLowerCase()
            return (
                job.name.toLowerCase().includes(q) ||
                (getProviderDisplayName(job.source_provider || "")).toLowerCase().includes(q) ||
                (getProviderDisplayName(job.destination_provider || "")).toLowerCase().includes(q)
            )
        })
        .sort((a, b) => {
            const tA = a.created_at ? new Date(a.created_at).getTime() : 0
            const tB = b.created_at ? new Date(b.created_at).getTime() : 0
            const dA = Number.isFinite(tA) ? tA : 0
            const dB = Number.isFinite(tB) ? tB : 0
            return dB - dA
        })

    // ─── Actions ────────────────────────────────────────────────────────────

    const handlePauseResume = async (job: Job) => {
        setActionLoading(job.job_id)
        try {
            if (job.status === "ACTIVE") {
                await jobsAPI.pauseJob(job.job_id)
                toast({ title: "Job Paused", description: `${job.name} has been paused` })
            } else {
                await jobsAPI.resumeJob(job.job_id)
                toast({ title: "Job Resumed", description: `${job.name} has been resumed` })
            }
            await loadJobs()
        } catch (err) {
            const verb = job.status === "ACTIVE" ? "pause" : "resume"
            const { title, description } = describeJobError(err, `Failed to ${verb} job`)
            toast({ title, description, variant: "destructive" })
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async () => {
        if (!jobToDelete) return
        setDeleting(true)
        try {
            await jobsAPI.deleteJob(jobToDelete.job_id)
            toast({ title: "Job Deleted", description: `${jobToDelete.name} has been deleted` })
            setDeleteDialogOpen(false)
            setJobToDelete(null)
            await loadJobs()
        } catch (err) {
            const { title, description } = describeJobError(err, "Failed to delete job")
            toast({ title, description, variant: "destructive" })
        } finally {
            setDeleting(false)
        }
    }

    const handleTrigger = async (job: Job) => {
        try {
            setActionLoading(job.job_id)
            await jobsAPI.triggerJob(job.job_id)
            toast({ title: "Job triggered", description: `${job.name} is now running.` })
            await loadJobs()
        } catch (err) {
            const { title, description } = describeJobError(err, "Trigger failed")
            toast({ title, description, variant: "destructive" })
        } finally {
            setActionLoading(null)
        }
    }

    // ─── Batch selection ────────────────────────────────────────────────────

    const toggleJobSelection = (jobId: string) => {
        setSelectedJobIds(prev => {
            const next = new Set(prev)
            if (next.has(jobId)) next.delete(jobId)
            else next.add(jobId)
            return next
        })
    }

    const clearSelection = () => setSelectedJobIds(new Set())

    const toggleSelectAllVisible = () => {
        // Header checkbox: select-all toggles the currently filtered set.
        if (selectedJobIds.size >= filteredJobs.length && filteredJobs.length > 0) {
            clearSelection()
        } else {
            setSelectedJobIds(new Set(filteredJobs.map(j => j.job_id)))
        }
    }

    // Map names back from job_ids for friendlier toasts.
    const jobNameById = (id: string): string => jobs.find(j => j.job_id === id)?.name || id

    const runBatchAction = async (action: "run" | "pause" | "resume" | "delete") => {
        if (selectedJobIds.size === 0) return
        const ids = Array.from(selectedJobIds)
        setBatchActionLoading(action)
        try {
            const res = await jobsAPI.batchAction({ job_ids: ids, action })
            const successCount = res.successes?.length ?? 0
            const failures = res.failures ?? []

            if (successCount > 0) {
                toast({
                    title: `Batch ${action} succeeded`,
                    description: `${successCount} job${successCount > 1 ? "s" : ""} ${
                        action === "delete" ? "deleted" :
                        action === "run" ? "triggered" :
                        action === "pause" ? "paused" : "resumed"
                    }.`,
                })
            }

            if (failures.length > 0) {
                // Show one toast listing failed job names — keep description short.
                const names = failures.slice(0, 5).map(f => jobNameById(f.job_id)).join(", ")
                const more = failures.length > 5 ? ` and ${failures.length - 5} more` : ""
                toast({
                    title: `${failures.length} job${failures.length > 1 ? "s" : ""} failed to ${action}`,
                    description: `${names}${more}`,
                    variant: "destructive",
                })
            }

            clearSelection()
            await loadJobs()
        } catch (err) {
            toast({
                title: `Batch ${action} failed`,
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            })
        } finally {
            setBatchActionLoading(null)
            setBatchDeleteOpen(false)
        }
    }

    const handleEdit = (job: Job) => {
        setEditingJob(job)
        setDialogOpen(true)
    }

    const handleCreateNew = () => {
        router.push("/jobs/create")
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
        setEditingJob(null)
    }

    const handleDialogSuccess = () => {
        handleDialogClose()
        loadJobs()
    }

    const toggleExpand = (jobId: string) => {
        setExpandedJobId(prev => (prev === jobId ? null : jobId))
    }

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
                <div className="flex items-center gap-3.5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                        <CalendarClock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1
                            className="text-xl font-semibold tracking-wider uppercase text-foreground"
                            style={{ fontFamily: "'Outfit', var(--font-sans, system-ui, sans-serif)" }}
                        >
                            Scheduled Jobs
                        </h1>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                            Automated ERP sync schedules and pipeline orchestration
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        // CRITICAL: do NOT pass `loadJobs` directly — React
                        // hands the MouseEvent to the click handler, which
                        // `loadJobs(silent=false)` coerces as truthy and
                        // skips the loading spinner + suppresses the error
                        // toast. Wrap in an arrow so we invoke with no args.
                        onClick={() => { void loadJobs() }}
                        disabled={loading}
                        className="border-border/60 bg-card/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                        <span className="text-[12px] tracking-wide">Refresh</span>
                    </Button>
                    {/* Job creation is a mutating action — Members are read-only.
                        Hide the button entirely instead of disabling so the
                        header isn't visually cluttered for Members. */}
                    <PermissionWrapper requiredRole={["Data Steward", "Admin", "Super Admin"]} fallback="hide" showLock={false}>
                        <Button
                            size="sm"
                            onClick={handleCreateNew}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-[12px] tracking-wide">New Job</span>
                        </Button>
                    </PermissionWrapper>
                </div>
            </div>

            {/* Summary stats bar */}
            {!loading && jobs.length > 0 && (() => {
                const active = jobs.filter(j => j.status === "ACTIVE").length
                const paused = jobs.filter(j => j.status === "PAUSED").length
                const failed = jobs.filter(j => j.status === "FAILED" || j.status === "AUTO_PAUSED").length
                return (
                    <div className="flex items-center gap-0 px-6 py-0 border-b border-border/40 bg-muted/10">
                        {/* Total */}
                        <div className="flex items-center gap-2 pr-5 py-2.5 border-r border-border/30">
                            <span
                                className="text-[10px] text-muted-foreground uppercase tracking-widest"
                                
                            >
                                Total
                            </span>
                            <span
                                className="text-[13px] font-semibold text-foreground tabular-nums"
                                style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                            >
                                {jobs.length}
                            </span>
                        </div>
                        {/* Active */}
                        <div className="flex items-center gap-2 px-5 py-2.5 border-r border-border/30">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span
                                className="text-[10px] text-muted-foreground uppercase tracking-widest"
                                
                            >
                                Active
                            </span>
                            <span
                                className="text-[13px] font-semibold tabular-nums text-emerald-400"
                                style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                            >
                                {active}
                            </span>
                        </div>
                        {/* Paused */}
                        <div className="flex items-center gap-2 px-5 py-2.5 border-r border-border/30">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            <span
                                className="text-[10px] text-muted-foreground uppercase tracking-widest"
                                
                            >
                                Paused
                            </span>
                            <span
                                className="text-[13px] font-semibold tabular-nums text-amber-400"
                                style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                            >
                                {paused}
                            </span>
                        </div>
                        {/* Failed */}
                        {failed > 0 && (
                            <div className="flex items-center gap-2 px-5 py-2.5">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                <span
                                    className="text-[10px] text-muted-foreground uppercase tracking-widest"
                                    
                                >
                                    Failed
                                </span>
                                <span
                                    className="text-[13px] font-semibold tabular-nums text-red-400"
                                    style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                >
                                    {failed}
                                </span>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Search */}
            <div className="px-6 py-3 border-b border-border/40 bg-background">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                        placeholder="Search jobs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 bg-muted/20 border-border/50 text-sm placeholder:text-muted-foreground/40 focus:border-primary/40 focus:bg-muted/30 transition-colors"
                    />
                </div>
            </div>

            {/* Failed jobs alert */}
            {(() => {
                const failedJobs = jobs.filter(
                    (j) => j.status === "FAILED" || j.status === "AUTO_PAUSED"
                )
                if (failedJobs.length === 0 || loading) return null

                return (
                    <div className="mx-6 mt-3 flex items-center gap-3 p-3 rounded-lg border border-red-500/25 bg-red-500/5"
                        style={{ boxShadow: "0 0 15px -3px rgba(239, 68, 68, 0.1), 0 0 6px -4px rgba(239, 68, 68, 0.15)" }}
                    >
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-red-500/10 border border-red-500/20 shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                        </div>
                        <p className="text-sm text-foreground/80 flex-1">
                            <strong
                                className="text-red-400"
                                style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                            >
                                {failedJobs.length}
                            </strong>
                            {" "}job{failedJobs.length > 1 ? "s" : ""} need{failedJobs.length === 1 ? "s" : ""} attention:{" "}
                            <span className="text-muted-foreground">
                                {failedJobs.slice(0, 3).map((j) => j.name).join(", ")}
                                {failedJobs.length > 3 && ` and ${failedJobs.length - 3} more`}
                            </span>
                        </p>
                    </div>
                )
            })()}

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {loading && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
                            <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                        </div>
                        <p
                            className="text-[11px] uppercase tracking-widest text-muted-foreground/60"
                            
                        >
                            Loading jobs...
                        </p>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-5">
                            <CalendarClock className="h-7 w-7 text-primary/40" />
                        </div>
                        <h3
                            className="text-lg font-semibold mb-1.5 tracking-wide uppercase text-foreground/80"
                            style={{ fontFamily: "'Outfit', var(--font-sans, system-ui, sans-serif)" }}
                        >
                            {searchQuery ? "No matching jobs" : "No jobs yet"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-5 text-center max-w-sm">
                            {searchQuery
                                ? "Try a different search term"
                                : "Create your first automated ERP sync job to get started"
                            }
                        </p>
                        {!searchQuery && (
                            <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary/90">
                                <Plus className="h-4 w-4 mr-1.5" />
                                Create Job
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-white/20 overflow-hidden bg-card">
                        {/* Sticky batch action bar — visible when ≥1 job selected */}
                        {selectedJobIds.size >= 1 && (
                            <div
                                className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2 bg-primary/[0.06] border-b border-primary/30 backdrop-blur-sm"
                                role="toolbar"
                                aria-label="Batch actions"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span
                                        className="text-[12px] font-semibold tabular-nums text-primary"
                                        style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                    >
                                        {selectedJobIds.size} selected
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                                        onClick={clearSelection}
                                        disabled={Boolean(batchActionLoading)}
                                    >
                                        Clear
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() => runBatchAction("run")}
                                        disabled={Boolean(batchActionLoading)}
                                    >
                                        {batchActionLoading === "run"
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Play className="h-3.5 w-3.5" />}
                                        Run
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() => runBatchAction("pause")}
                                        disabled={Boolean(batchActionLoading)}
                                    >
                                        {batchActionLoading === "pause"
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Pause className="h-3.5 w-3.5" />}
                                        Pause
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={() => runBatchAction("resume")}
                                        disabled={Boolean(batchActionLoading)}
                                    >
                                        {batchActionLoading === "resume"
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Play className="h-3.5 w-3.5" />}
                                        Resume
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => setBatchDeleteOpen(true)}
                                        disabled={Boolean(batchActionLoading)}
                                    >
                                        {batchActionLoading === "delete"
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <Trash2 className="h-3.5 w-3.5" />}
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )}
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-white/[0.06] hover:bg-white/[0.06] border-b border-white/15">
                                    <TableHead className="w-10 pl-4">
                                        <Checkbox
                                            checked={
                                                filteredJobs.length > 0 &&
                                                selectedJobIds.size >= filteredJobs.length
                                            }
                                            onCheckedChange={toggleSelectAllVisible}
                                            aria-label="Select all jobs"
                                        />
                                    </TableHead>
                                    <TableHead className="w-8" />
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"

                                    >
                                        Job Name
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                                        
                                    >
                                        Pipeline
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                                        
                                    >
                                        Frequency
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                                        
                                    >
                                        Status
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                                        
                                    >
                                        Last Run
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-right"
                                        
                                    >
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredJobs.map((job) => (
                                    <Fragment key={`job-group-${job.job_id}`}>
                                        <TableRow
                                            key={job.job_id}
                                            className={cn(
                                                "cursor-pointer transition-colors border-b border-white/10 hover:bg-white/[0.04]",
                                                expandedJobId === job.job_id && "bg-primary/[0.03] border-l-2 border-l-primary/40",
                                                selectedJobIds.has(job.job_id) && "bg-primary/[0.04]"
                                            )}
                                            onClick={() => toggleExpand(job.job_id)}
                                        >
                                            <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedJobIds.has(job.job_id)}
                                                    onCheckedChange={() => toggleJobSelection(job.job_id)}
                                                    aria-label={`Select ${job.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="w-8 pr-0">
                                                {expandedJobId === job.job_id
                                                    ? <ChevronDown className="h-3.5 w-3.5 text-primary/60" />
                                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium text-[13px] text-foreground">{job.name}</span>
                                                    <span
                                                        className="text-[11px] text-muted-foreground/60 tracking-wide"
                                                        
                                                    >
                                                        {job.dq_config?.mode === "custom" ? "Custom DQ" : "Default DQ"}
                                                        {job.entities?.[0] && (
                                                            <> &middot; {job.entities[0].replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</>
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-[13px]">
                                                    <span className="font-medium text-primary">
                                                        {getProviderDisplayName(job.source_provider || "")}
                                                    </span>
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                                                    <span className="font-medium text-accent dark:text-accent">
                                                        {getProviderDisplayName(job.destination_provider || "")}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                                                    <Clock className="h-3 w-3 text-muted-foreground/50" />
                                                    <span style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}>
                                                        {FREQ_LABELS[frequencyFromBackend(job.frequency_type, job.frequency_value).frequency] || job.frequency_value || "\u2014"}
                                                    </span>
                                                    {job.frequency_type === "cron" && job.frequency_value && (
                                                        <code
                                                            className="text-[10px] bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded ml-1 text-muted-foreground"
                                                            style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                                        >
                                                            {job.frequency_value}
                                                        </code>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{statusBadge(job.status)}</TableCell>
                                            <TableCell>
                                                {job.last_run_at ? (
                                                    <div className="flex items-center gap-1.5">
                                                        {runStatusIcon(job.last_run_status || "")}
                                                        <span
                                                            className="text-[12px] text-muted-foreground tabular-nums"
                                                            style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                                        >
                                                            {(() => { try { return format(new Date(job.last_run_at), "MMM d, HH:mm") } catch { return "\u2014" } })()}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground/50 italic">Never</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted/30">
                                                            <MoreHorizontal className="h-4 w-4 text-muted-foreground/60" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-card border-border/60">
                                                        {/* All four actions mutate scheduler / pipeline state.
                                                            Members shouldn't be able to invoke them. Wrap each
                                                            with PermissionWrapper(fallback=hide) so the menu
                                                            simply doesn't surface them for Members — instead
                                                            of letting the click hit the BE and return a 403. */}
                                                        <PermissionWrapper requiredRole={["Data Steward", "Admin", "Super Admin"]} fallback="hide" showLock={false}>
                                                            <DropdownMenuItem
                                                                onClick={() => handleTrigger(job)}
                                                                disabled={actionLoading === job.job_id}
                                                            >
                                                                <Play className="h-4 w-4 mr-2" />
                                                                Run Now
                                                            </DropdownMenuItem>
                                                        </PermissionWrapper>
                                                        <PermissionWrapper requiredRole={["Data Steward", "Admin", "Super Admin"]} fallback="hide" showLock={false}>
                                                            <DropdownMenuItem onClick={() => handleEdit(job)}>
                                                                <Edit2 className="h-4 w-4 mr-2" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                        </PermissionWrapper>
                                                        <PermissionWrapper requiredRole={["Data Steward", "Admin", "Super Admin"]} fallback="hide" showLock={false}>
                                                            <DropdownMenuItem
                                                                onClick={() => handlePauseResume(job)}
                                                                disabled={actionLoading === job.job_id}
                                                            >
                                                                {job.status === "ACTIVE" ? (
                                                                    <><Pause className="h-4 w-4 mr-2" />Pause</>
                                                                ) : (
                                                                    <><Play className="h-4 w-4 mr-2" />Resume</>
                                                                )}
                                                            </DropdownMenuItem>
                                                        </PermissionWrapper>
                                                        <PermissionWrapper requiredRole={["Admin", "Super Admin"]} fallback="hide" showLock={false}>
                                                            <DropdownMenuSeparator className="bg-border/40" />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={() => { setJobToDelete(job); setDeleteDialogOpen(true) }}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </PermissionWrapper>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Run History */}
                                        {expandedJobId === job.job_id && (
                                            <TableRow key={`${job.job_id}-runs`} className="bg-muted/5 hover:bg-muted/5 border-b border-border/20">
                                                <TableCell colSpan={8} className="p-0">
                                                    <JobRunsExplorer jobId={job.job_id} />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <JobDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                job={editingJob}
                onSuccess={handleDialogSuccess}
                onCancel={handleDialogClose}
            />

            {/* Batch Delete Confirmation */}
            <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
                <AlertDialogContent className="bg-card border-border/60">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/20">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <span
                                className="text-base font-semibold tracking-wide"
                                style={{ fontFamily: "'Outfit', var(--font-sans, system-ui, sans-serif)" }}
                            >
                                Delete {selectedJobIds.size} Job{selectedJobIds.size > 1 ? "s" : ""}
                            </span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-[13px] leading-relaxed mt-2">
                            Are you sure you want to delete{" "}
                            <strong className="text-foreground">
                                {selectedJobIds.size} job{selectedJobIds.size > 1 ? "s" : ""}
                            </strong>?
                            All scheduled runs and run histories will be removed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel
                            disabled={batchActionLoading === "delete"}
                            className="border-border/50 bg-muted/20 hover:bg-muted/40"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => runBatchAction("delete")}
                            disabled={batchActionLoading === "delete"}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {batchActionLoading === "delete"
                                ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                : <Trash2 className="h-4 w-4 mr-1.5" />}
                            Delete {selectedJobIds.size > 1 ? "All" : ""}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="bg-card border-border/60">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/20">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                            </div>
                            <span
                                className="text-base font-semibold tracking-wide"
                                style={{ fontFamily: "'Outfit', var(--font-sans, system-ui, sans-serif)" }}
                            >
                                Delete Job
                            </span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-[13px] leading-relaxed mt-2">
                            Are you sure you want to delete <strong className="text-foreground">{jobToDelete?.name}</strong>? This will remove the scheduled job and all its run history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel disabled={deleting} className="border-border/50 bg-muted/20 hover:bg-muted/40">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
