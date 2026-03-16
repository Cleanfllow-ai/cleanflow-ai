"use client"

import { Fragment, useState, useCallback, useEffect } from "react"
import { format } from "date-fns"
import {
    CalendarClock, ChevronDown, ChevronRight, Clock, Edit2, Loader2, MoreHorizontal,
    Pause, Play, Plus, RefreshCw, Search, Trash2, AlertTriangle, CheckCircle2,
    XCircle, ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { JobDialog } from "./job-dialog"
import { JobRunsExplorer } from "./job-runs-explorer"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ERP_LABELS: Record<string, string> = {
    quickbooks: "QuickBooks",
    zoho_books: "Zoho Books",
    "zoho-books": "Zoho Books",
    zohobooks: "Zoho Books",
}

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

    const { toast } = useToast()

    // ─── Data Loading ───────────────────────────────────────────────────────

    const loadJobs = useCallback(async () => {
        setLoading(true)
        try {
            const res = await jobsAPI.listJobs()
            setJobs(res.jobs || [])
        } catch (err) {
            console.error("Failed to load jobs:", err)
            toast({ title: "Error", description: "Failed to load jobs", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }, [toast])

    // Load on mount
    useEffect(() => {
        loadJobs()
    }, [loadJobs])

    // ─── Filtering ──────────────────────────────────────────────────────────

    const filteredJobs = jobs
        .filter(job => {
            if (!searchQuery) return true
            const q = searchQuery.toLowerCase()
            return (
                job.name.toLowerCase().includes(q) ||
                (ERP_LABELS[job.source] || job.source).toLowerCase().includes(q) ||
                (ERP_LABELS[job.destination] || job.destination).toLowerCase().includes(q)
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
            toast({ title: "Error", description: `Failed to ${job.status === "ACTIVE" ? "pause" : "resume"} job`, variant: "destructive" })
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
            toast({ title: "Error", description: "Failed to delete job", variant: "destructive" })
        } finally {
            setDeleting(false)
        }
    }

    const handleEdit = (job: Job) => {
        setEditingJob(job)
        setDialogOpen(true)
    }

    const handleCreateNew = () => {
        setEditingJob(null)
        setDialogOpen(true)
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
                        onClick={loadJobs}
                        disabled={loading}
                        className="border-border/60 bg-card/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                        <span className="text-[12px] tracking-wide">Refresh</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleCreateNew}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        <span className="text-[12px] tracking-wide">New Job</span>
                    </Button>
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
                    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                                    <TableHead className="w-8" />
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70"
                                        
                                    >
                                        Job Name
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70"
                                        
                                    >
                                        Pipeline
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70"
                                        
                                    >
                                        Frequency
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70"
                                        
                                    >
                                        Status
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70"
                                        
                                    >
                                        Last Run
                                    </TableHead>
                                    <TableHead
                                        className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 text-right"
                                        
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
                                                "cursor-pointer transition-colors border-b border-border/30 hover:bg-muted/15",
                                                expandedJobId === job.job_id && "bg-primary/[0.03] border-l-2 border-l-primary/40"
                                            )}
                                            onClick={() => toggleExpand(job.job_id)}
                                        >
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
                                                        {ERP_LABELS[job.source] || job.source}
                                                    </span>
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                                                    <span className="font-medium text-accent dark:text-accent">
                                                        {ERP_LABELS[job.destination] || job.destination}
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
                                                            {format(new Date(job.last_run_at), "MMM d, HH:mm")}
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
                                                        <DropdownMenuItem onClick={() => handleEdit(job)}>
                                                            <Edit2 className="h-4 w-4 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
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
                                                        <DropdownMenuSeparator className="bg-border/40" />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => { setJobToDelete(job); setDeleteDialogOpen(true) }}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Run History */}
                                        {expandedJobId === job.job_id && (
                                            <TableRow key={`${job.job_id}-runs`} className="bg-muted/5 hover:bg-muted/5 border-b border-border/20">
                                                <TableCell colSpan={7} className="p-0">
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
