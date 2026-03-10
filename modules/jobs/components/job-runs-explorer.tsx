"use client"

import { format } from "date-fns"
import {
    CheckCircle2, XCircle, Clock, Loader2, Activity,
    Search, Filter, RefreshCw, AlertTriangle, ArrowUpDown,
    ArrowUp, ArrowDown, FolderOpen, Info, Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip"
import { cn } from "@/shared/lib/utils"
import { useJobRunsExplorer, type SortField, type StatusFilter } from "./use-job-runs-explorer"
import { JobRunDetailModal } from "./job-run-detail-modal"
import { JobRunFileViewer } from "./job-run-file-viewer"

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "SUCCESS", label: "Success" },
    { value: "FAILED", label: "Failed" },
    { value: "PARTIAL", label: "Partial" },
    { value: "NO_CHANGES", label: "No Changes" },
]

function getStatusColor(status: string) {
    switch (status) {
        case "SUCCESS": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
        case "FAILED": return "bg-red-500/15 text-red-600 border-red-500/25"
        case "PARTIAL": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
        case "NO_CHANGES": return "bg-slate-500/15 text-slate-600 border-slate-500/25"
        default: return "bg-muted text-muted-foreground border-border"
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case "SUCCESS": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-500" />
        case "PARTIAL": return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        case "RUNNING": return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
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
    if (s < 60) return `${s.toFixed(1)}s`
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    return `${mins}m ${secs}s`
}

// ─── Component ──────────────────────────────────────────────────────────────

interface JobRunsExplorerProps {
    jobId: string
}

export function JobRunsExplorer({ jobId }: JobRunsExplorerProps) {
    const state = useJobRunsExplorer(jobId)

    const SortIcon = ({ field }: { field: SortField }) => {
        if (state.sortField !== field)
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
        return state.sortDirection === "asc"
            ? <ArrowUp className="h-3 w-3 ml-1" />
            : <ArrowDown className="h-3 w-3 ml-1" />
    }

    return (
        <div className="px-6 py-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Run History
                </div>
                <div className="text-xs text-muted-foreground">
                    {state.filteredRuns.length} run{state.filteredRuns.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={state.searchQuery}
                        onChange={(e) => state.setSearchQuery(e.target.value)}
                        placeholder="Search runs..."
                        className="h-8 pl-8 text-xs"
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-8 text-xs px-3 gap-1.5">
                            <Filter className="h-3 w-3" />
                            {STATUS_OPTIONS.find(o => o.value === state.statusFilter)?.label || "Filter"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                        {STATUS_OPTIONS.map(opt => (
                            <DropdownMenuItem
                                key={opt.value}
                                onClick={() => state.setStatusFilter(opt.value)}
                                className="text-xs"
                            >
                                {opt.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                {(state.searchQuery || state.statusFilter !== "all") && (
                    <Button
                        variant="ghost" size="sm"
                        className="h-8 px-2"
                        onClick={() => { state.setSearchQuery(""); state.setStatusFilter("all") }}
                    >
                        <Filter className="h-3.5 w-3.5" />
                    </Button>
                )}
                <Button
                    variant="outline" size="sm"
                    className="h-8 px-2"
                    onClick={state.handleRefresh}
                    disabled={state.isRefreshing}
                >
                    <RefreshCw className={cn("h-3.5 w-3.5", state.isRefreshing && "animate-spin")} />
                </Button>
            </div>

            {/* Table */}
            {state.loading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Loading run history...</span>
                </div>
            ) : state.filteredRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6">
                    <Activity className="h-5 w-5 text-muted-foreground/50 mb-2" />
                    <span className="text-sm text-muted-foreground">
                        {state.runs.length === 0 ? "No runs yet" : "No runs match filters"}
                    </span>
                </div>
            ) : (
                <div className="rounded-lg border overflow-hidden bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                                <TableHead className="text-[11px] w-8">Status</TableHead>
                                <TableHead
                                    className="text-[11px] cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => state.handleSort("started_at")}
                                >
                                    <span className="flex items-center">Started<SortIcon field="started_at" /></span>
                                </TableHead>
                                <TableHead
                                    className="text-[11px] cursor-pointer hover:text-foreground transition-colors text-right"
                                    onClick={() => state.handleSort("duration")}
                                >
                                    <span className="flex items-center justify-end">Duration<SortIcon field="duration" /></span>
                                </TableHead>
                                <TableHead
                                    className="text-[11px] cursor-pointer hover:text-foreground transition-colors text-right"
                                    onClick={() => state.handleSort("imported")}
                                >
                                    <span className="flex items-center justify-end">Imported<SortIcon field="imported" /></span>
                                </TableHead>
                                <TableHead
                                    className="text-[11px] cursor-pointer hover:text-foreground transition-colors text-right"
                                    onClick={() => state.handleSort("exported")}
                                >
                                    <span className="flex items-center justify-end">Exported<SortIcon field="exported" /></span>
                                </TableHead>
                                <TableHead className="text-[11px] text-right">DQ Score</TableHead>
                                <TableHead className="text-[11px]">Trigger</TableHead>
                                <TableHead className="text-[11px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {state.filteredRuns.map(run => {
                                const avgScore = run.processing_metadata?.avg_dq_score
                                return (
                                    <TableRow
                                        key={run.run_id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => state.handleViewRunDetail(run)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {getStatusIcon(run.status)}
                                                <Badge
                                                    variant="outline"
                                                    className={cn("text-[10px] px-1.5", getStatusColor(run.status))}
                                                >
                                                    {run.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                                            {run.started_at
                                                ? format(new Date(run.started_at), "MMM d, HH:mm:ss")
                                                : "—"
                                            }
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground tabular-nums text-right">
                                            {formatDuration(run.duration_seconds)}
                                        </TableCell>
                                        <TableCell className="text-xs tabular-nums text-right font-medium">
                                            {run.total_records_imported || 0}
                                        </TableCell>
                                        <TableCell className="text-xs tabular-nums text-right font-medium">
                                            {run.total_records_exported || 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {avgScore != null ? (
                                                <Badge
                                                    variant="outline"
                                                    className={cn("text-[10px] tabular-nums", getScoreColor(Number(avgScore)))}
                                                >
                                                    {Number(avgScore).toFixed(1)}%
                                                </Badge>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {run.trigger_source === "manual_trigger" ? (
                                                <span className="flex items-center gap-1">
                                                    <Zap className="h-3 w-3" />
                                                    Manual
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Scheduled
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-0.5">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => state.handleViewRunFiles(run)}
                                                        >
                                                            <FolderOpen className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>View Files</TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => state.handleViewRunDetail(run)}
                                                        >
                                                            <Info className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Run Details</TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Detail Modal */}
            <JobRunDetailModal
                run={state.selectedRun}
                open={state.detailModalOpen}
                onOpenChange={state.setDetailModalOpen}
            />

            {/* File Viewer */}
            <JobRunFileViewer
                run={state.fileViewerRun}
                open={state.fileViewerOpen}
                onOpenChange={state.setFileViewerOpen}
            />
        </div>
    )
}
