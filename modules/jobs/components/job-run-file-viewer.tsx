"use client"

import {
    Loader2, Eye, Download, Trash2, FileText, AlertCircle, CloudUpload, Pencil
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Tooltip, TooltipContent, TooltipTrigger
} from "@/components/ui/tooltip"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/shared/lib/utils"
import type { JobRun } from "@/modules/jobs/types/jobs.types"
import { FileDetailsDialog } from "@/modules/files/components/file-details-dialog"
import { QuarantineEditorDialog } from "@/modules/files/components/quarantine-editor"
import { ColumnExportContent } from "@/modules/files/components/column-export-dialog"
import { useJobRunFiles } from "./use-job-run-files"

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
    const s = (status || "").toUpperCase()
    if (s.includes("FIXED") || s.includes("COMPLETED") || s.includes("PROCESSED"))
        return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
    if (s.includes("FAILED"))
        return "bg-red-500/15 text-red-600 border-red-500/25"
    if (s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED"))
        return "bg-amber-500/15 text-amber-600 border-amber-500/25"
    return "bg-blue-500/15 text-blue-600 border-blue-500/25"
}

function getScoreColor(score: number) {
    if (score >= 90) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
    if (score >= 70) return "bg-amber-500/15 text-amber-600 border-amber-500/25"
    return "bg-red-500/15 text-red-600 border-red-500/25"
}

function getRunStatusColor(status: string) {
    switch (status) {
        case "SUCCESS": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25"
        case "FAILED": return "bg-red-500/15 text-red-600 border-red-500/25"
        case "PARTIAL": return "bg-amber-500/15 text-amber-600 border-amber-500/25"
        default: return "bg-slate-500/15 text-slate-600 border-slate-500/25"
    }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface JobRunFileViewerProps {
    run: JobRun | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function JobRunFileViewer({ run, open, onOpenChange }: JobRunFileViewerProps) {
    const state = useJobRunFiles(run, open)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    if (!run) return null

    const runLabel = run.run_id.length > 16 ? run.run_id.slice(0, 16) + "..." : run.run_id

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[750px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <FileText className="h-5 w-5 text-primary" />
                            Run Files
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-2">
                            <span className="font-mono text-xs">{runLabel}</span>
                            <Badge variant="outline" className={cn("text-[10px]", getRunStatusColor(run.status))}>
                                {run.status}
                            </Badge>
                        </DialogDescription>
                    </DialogHeader>

                    {state.loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                            <span className="text-sm text-muted-foreground">Loading files...</span>
                        </div>
                    ) : state.entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <FileText className="h-6 w-6 text-muted-foreground/40 mb-2" />
                            <span className="text-sm text-muted-foreground">No files for this run</span>
                        </div>
                    ) : (
                        <div className="rounded-lg border overflow-hidden bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        <TableHead className="text-[11px]">Entity</TableHead>
                                        <TableHead className="text-[11px]">File Name</TableHead>
                                        <TableHead className="text-[11px]">Status</TableHead>
                                        <TableHead className="text-[11px] text-right">DQ Score</TableHead>
                                        <TableHead className="text-[11px] text-right">Rows</TableHead>
                                        <TableHead className="text-[11px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.entries.map((entry) => {
                                        const file = entry.file
                                        if (entry.loading) {
                                            return (
                                                <TableRow key={entry.uploadId}>
                                                    <TableCell className="text-xs capitalize">{entry.entity}</TableCell>
                                                    <TableCell colSpan={5}>
                                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }
                                        if (!file || entry.error) {
                                            return (
                                                <TableRow key={entry.uploadId}>
                                                    <TableCell className="text-xs capitalize">{entry.entity}</TableCell>
                                                    <TableCell colSpan={5}>
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {entry.error || "File not found"}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }
                                        const dqScore = file.dq_score != null ? Number(file.dq_score) : null
                                        return (
                                            <TableRow key={entry.uploadId}>
                                                <TableCell className="text-xs font-medium capitalize">
                                                    {entry.entity}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={file.original_filename || file.filename}>
                                                    {file.original_filename || file.filename || entry.uploadId}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn("text-[10px]", getStatusColor(file.status))}>
                                                        {file.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {dqScore != null ? (
                                                        <Badge variant="outline" className={cn("text-[10px] tabular-nums", getScoreColor(dqScore))}>
                                                            {dqScore.toFixed(1)}%
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs tabular-nums text-right">
                                                    {file.rows_in != null ? file.rows_in : "—"}
                                                </TableCell>
                                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                                                    onClick={() => state.handleViewDetail(file)}>
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Preview & DQ Report</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                                                    onClick={() => state.handleDownloadPrompt(file)}>
                                                                    <Download className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Download</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                                                    onClick={() => setDeleteTarget(entry.uploadId)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Delete</TooltipContent>
                                                        </Tooltip>
                                                        {(file.rows_quarantined ?? 0) > 0 && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600 hover:text-violet-700"
                                                                        onClick={() => state.handleOpenQuarantineEditor(file, entry.entity)}>
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>AI Edit Quarantined Data</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Export progress banner */}
                    {state.exporting && (
                        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-primary font-medium">Exporting cleaned rows to {run?.job_id || "destination"}...</span>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* File Details (Preview / DQ Report / Versions) */}
            <FileDetailsDialog
                file={state.detailFile}
                open={state.detailOpen}
                onOpenChange={state.setDetailOpen}
                onRemediate={(f) => state.handleOpenQuarantineEditor(f)}
                hideTabs={["details"]}
            />

            {/* Quarantine Editor Dialog */}
            <QuarantineEditorDialog
                file={state.quarantineFile}
                open={state.quarantineEditorOpen}
                onOpenChange={(open) => {
                    if (!open) state.handleQuarantineEditorClose()
                }}
                onReprocessSubmitted={state.handleReprocessSubmitted}
            />

            {/* Download Data (Column Export + ERP Transform) */}
            <Dialog open={state.downloadOpen} onOpenChange={state.setDownloadOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                                <CloudUpload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            Download Data
                        </DialogTitle>
                        <DialogDescription>Configure your data and select a destination.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                        <div className="rounded-lg border p-4 bg-muted/30">
                            <div className="text-sm font-medium">
                                {state.downloadFile?.original_filename || state.downloadFile?.filename || "Selected file"}
                            </div>
                            {state.downloadFile && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    {state.downloadFile.rows_clean || state.downloadFile.rows_out || 0} clean rows ready to export
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                                ERP Transformation (Optional)
                            </Label>
                            <RadioGroup value={state.erpMode} onValueChange={(value) => state.setErpMode(value as "original" | "transform")} className="space-y-2">
                                <div className="flex items-center space-x-2 rounded-lg border p-3">
                                    <RadioGroupItem value="original" id="run-erp-original" />
                                    <Label htmlFor="run-erp-original" className="cursor-pointer">Original Format (CSV)</Label>
                                </div>
                                <div className="flex items-center space-x-2 rounded-lg border p-3">
                                    <RadioGroupItem value="transform" id="run-erp-transform" />
                                    <Label htmlFor="run-erp-transform" className="cursor-pointer">Transform for ERP System</Label>
                                </div>
                            </RadioGroup>
                            {state.erpMode === "transform" && (
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium">ERP System</Label>
                                    <Select value={state.erpTarget} onValueChange={state.setErpTarget}>
                                        <SelectTrigger><SelectValue placeholder="Select ERP" /></SelectTrigger>
                                        <SelectContent>
                                            {["Oracle Fusion", "SAP ERP", "Microsoft Dynamics", "NetSuite", "Workday", "QuickBooks Online", "Zoho Books", "Custom ERP"].map((erp) => (
                                                <SelectItem key={erp} value={erp}>{erp}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        {state.columnExportLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading columns...
                            </div>
                        ) : (
                            <ColumnExportContent
                                fileName={state.downloadFile?.original_filename || state.downloadFile?.filename || "Selected file"}
                                columns={state.columnExportColumns}
                                onExport={state.handleColumnExport}
                                primaryActionLabel="Download"
                                exporting={state.downloading}
                                onCancel={() => state.setDownloadOpen(false)}
                                showTitle={false}
                                className="min-h-[360px]"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the file from storage. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (deleteTarget) {
                                    state.handleDelete(deleteTarget)
                                    setDeleteTarget(null)
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
