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
            return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>
        case "PAUSED":
            return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/20"><Pause className="h-3 w-3 mr-1" />Paused</Badge>
        case "FAILED":
            return <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25 hover:bg-red-500/20"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
        default:
            return <Badge variant="outline">{status}</Badge>
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                        <CalendarClock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Scheduled Jobs</h1>
                        <p className="text-sm text-muted-foreground">Automated ERP sync schedules</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
                        <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleCreateNew}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Job
                    </Button>
                </div>
            </div>

            {/* Summary stats */}
            {!loading && jobs.length > 0 && (() => {
                const active = jobs.filter(j => j.status === "ACTIVE").length
                const paused = jobs.filter(j => j.status === "PAUSED").length
                const failed = jobs.filter(j => j.status === "FAILED" || j.status === "AUTO_PAUSED").length
                return (
                    <div className="flex items-center gap-6 px-6 py-3 border-b border-border/40 bg-muted/20">
                        <div className="flex items-center gap-1.5 text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-semibold tabular-nums">{jobs.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span className="text-muted-foreground">Active</span>
                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{active}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                            <span className="text-muted-foreground">Paused</span>
                            <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{paused}</span>
                        </div>
                        {failed > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                <span className="text-muted-foreground">Failed</span>
                                <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{failed}</span>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Search */}
            <div className="px-6 py-3 border-b border-border/40">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search jobs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
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
                    <div className="mx-6 mt-3 flex items-center gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-sm flex-1">
                            <strong>{failedJobs.length}</strong> job{failedJobs.length > 1 ? "s" : ""} need{failedJobs.length === 1 ? "s" : ""} attention:{" "}
                            {failedJobs.slice(0, 3).map((j) => j.name).join(", ")}
                            {failedJobs.length > 3 && ` and ${failedJobs.length - 3} more`}
                        </p>
                    </div>
                )
            })()}

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {loading && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                        <p className="text-sm">Loading jobs...</p>
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
                            <CalendarClock className="h-8 w-8 text-primary/60" />
                        </div>
                        <h3 className="text-lg font-medium mb-1">
                            {searchQuery ? "No matching jobs" : "No jobs yet"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                            {searchQuery
                                ? "Try a different search term"
                                : "Create your first automated ERP sync job to get started"
                            }
                        </p>
                        {!searchQuery && (
                            <Button onClick={handleCreateNew}>
                                <Plus className="h-4 w-4 mr-1.5" />
                                Create Job
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="w-8" />
                                    <TableHead className="font-semibold">Job Name</TableHead>
                                    <TableHead className="font-semibold">Pipeline</TableHead>
                                    <TableHead className="font-semibold">Frequency</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold">Last Run</TableHead>
                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredJobs.map((job) => (
                                    <Fragment key={`job-group-${job.job_id}`}>
                                        <TableRow
                                            key={job.job_id}
                                            className={cn(
                                                "cursor-pointer transition-colors",
                                                expandedJobId === job.job_id && "bg-muted/20"
                                            )}
                                            onClick={() => toggleExpand(job.job_id)}
                                        >
                                            <TableCell className="w-8 pr-0">
                                                {expandedJobId === job.job_id
                                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                }
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{job.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {job.dq_config?.mode === "custom" ? "Custom DQ" : "Default DQ"}
                                                        {job.entities?.[0] && (
                                                            <> · {job.entities[0].replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</>
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <span className="font-medium text-primary">
                                                        {ERP_LABELS[job.source] || job.source}
                                                    </span>
                                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="font-medium text-accent-foreground">
                                                        {ERP_LABELS[job.destination] || job.destination}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {FREQ_LABELS[frequencyFromBackend(job.frequency_type, job.frequency_value).frequency] || job.frequency_value || "—"}
                                                    {job.frequency_type === "cron" && job.frequency_value && (
                                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1">{job.frequency_value}</code>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{statusBadge(job.status)}</TableCell>
                                            <TableCell>
                                                {job.last_run_at ? (
                                                    <div className="flex items-center gap-1.5">
                                                        {runStatusIcon(job.last_run_status || "")}
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(job.last_run_at), "MMM d, HH:mm")}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Never</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
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
                                                        <DropdownMenuSeparator />
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
                                            <TableRow key={`${job.job_id}-runs`} className="bg-muted/10 hover:bg-muted/10">
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete Job
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{jobToDelete?.name}</strong>? This will remove the scheduled job and all its run history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
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
