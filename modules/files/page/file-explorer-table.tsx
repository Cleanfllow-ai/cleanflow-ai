"use client";

import {
    CheckCircle,
    FileText,
    Loader2,
    Trash2,
    Eye,
    Search,
    Filter,
    Upload,
    Play,
    Pencil,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Menu,
    RefreshCw,
    X,
    Plus,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatBytes, formatToIST } from "@/shared/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    STATUS_OPTIONS,
} from "@/modules/files/page/constants";
import { Progress } from "@/components/ui/progress";
import {
    calculateProcessingTime,
    getDqQualityLabel,
    getScoreBadgeColor,
    getStatusBadgeColor,
    getStatusLabel,
    isActiveStatus,
} from "@/modules/files/page/utils";
import { useUploadManager } from "@/modules/files/context/upload-manager";
import type { FilesPageState } from "./use-files-page";

interface FileExplorerTableProps {
    state: FilesPageState;
}

export function FileExplorerTable({ state }: FileExplorerTableProps) {
    const {
        files, loading, filteredFiles, tableEmpty,
        searchQuery, setSearchQuery, statusFilter, setStatusFilter,
        sortField, sortDirection, handleSort,
        visibleColumns, setDisplayColumnModalOpen,
        isManualRefresh, handleManualRefresh,
        handleViewDetails, handleStartProcessing, handleQuickProcess,
        openActionsDialog, handleDeleteClick,
        downloading, deleting,
        handleOpenQuarantineEditor, highlightedFileId,
        selectedFiles, handleSelectFile, handleSelectAll, handleBulkDeleteClick, bulkDeleting,
        recentlyUploaded, setRecentlyUploaded,
        setWizardFile, setWizardOpen,
        handleNewImportOpen,
    } = state;
    const { activeUploads, getUploadForFile, cancelUpload } = useUploadManager();

    const SortIcon = ({
        field,
    }: {
        field: "name" | "score" | "status" | "uploaded" | "updated";
    }) => {
        if (sortField !== field)
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
        return sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3 ml-1 text-primary" />
        ) : (
            <ArrowDown className="h-3 w-3 ml-1 text-primary" />
        );
    };

    return (
        <div className="space-y-3">
            {/* Post-upload prompt — UX Improvement: Quick Process vs Configure */}
            {recentlyUploaded && (
                <div className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <div>
                                <span className="text-sm font-medium">
                                    {recentlyUploaded.original_filename || recentlyUploaded.filename}
                                </span>
                                <span className="text-sm text-muted-foreground"> uploaded successfully</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setRecentlyUploaded(null)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleQuickProcess(recentlyUploaded)}
                        >
                            <Play className="h-3.5 w-3.5" />
                            Process Now
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                                setWizardFile(recentlyUploaded);
                                setWizardOpen(true);
                                setRecentlyUploaded(null);
                            }}
                        >
                            Configure Processing
                        </Button>
                        <span className="text-[11px] text-muted-foreground ml-1">
                            "Process Now" uses auto-detected types & default rules
                        </span>
                    </div>
                </div>
            )}

            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search files..."
                            className="h-9 w-full sm:w-52 pl-8 text-sm bg-background border-border/60 focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/20"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-9 w-32 sm:w-36 text-sm justify-between border-border/60"
                            >
                                <span className="truncate text-muted-foreground">
                                    {STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || "Filter"}
                                </span>
                                <Filter className="h-3.5 w-3.5 ml-2 opacity-40" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => setStatusFilter("all")}>All</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("attention")} className="text-amber-600 font-medium">
                                Needs Attention
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("UPLOADED")}>Uploaded</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("DQ_FIXED")}>Processed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("DQ_RUNNING")}>Processing</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("QUEUED")}>Queued</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter("FAILED")}>Failed</DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Quality</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => setStatusFilter("excellent")}>Excellent</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter("good")}>Good</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter("bad")}>Bad</DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {(searchQuery || statusFilter !== "all") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("all");
                            }}
                            title="Clear filters"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    {!loading && files.length > 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium tabular-nums font-mono hidden sm:inline">
                            {filteredFiles.length === files.length
                                ? `${files.length} file${files.length !== 1 ? "s" : ""}`
                                : `${filteredFiles.length} of ${files.length}`}
                        </span>
                    )}
                    {selectedFiles.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-9 gap-1.5 px-3.5"
                            onClick={handleBulkDeleteClick}
                            disabled={bulkDeleting}
                        >
                            {bulkDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                            )}
                            <span className="text-sm font-medium">Delete {selectedFiles.size}</span>
                        </Button>
                    )}
                    <Button
                        size="sm"
                        className="h-9 gap-1.5 px-3.5"
                        onClick={handleNewImportOpen}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">Import</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 border-border/60"
                        onClick={handleManualRefresh}
                        disabled={isManualRefresh}
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isManualRefresh && "animate-spin")} />
                        <span className="text-sm">Refresh</span>
                    </Button>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                onClick={() => setDisplayColumnModalOpen(true)}
                            >
                                <Menu className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Column Picker</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/60 bg-muted/30">
                                <TableHead className="w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                                        onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                    />
                                </TableHead>
                                {visibleColumns.has("file") && (
                                    <TableHead
                                        className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("name")}
                                    >
                                        <span className="flex items-center">File<SortIcon field="name" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("score") && (
                                    <TableHead
                                        className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("score")}
                                    >
                                        <span className="flex items-center">Quality<SortIcon field="score" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("rows") && (
                                    <TableHead className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 text-left">Rows</TableHead>
                                )}
                                {visibleColumns.has("category") && (
                                    <TableHead className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 text-left">Ingestion Type</TableHead>
                                )}
                                {visibleColumns.has("status") && (
                                    <TableHead
                                        className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("status")}
                                    >
                                        <span className="flex items-center">Status<SortIcon field="status" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("uploaded") && (
                                    <TableHead
                                        className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("uploaded")}
                                    >
                                        <span className="flex items-center">Uploaded<SortIcon field="uploaded" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("updated") && (
                                    <TableHead
                                        className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("updated")}
                                    >
                                        <span className="flex items-center">Updated<SortIcon field="updated" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("processingTime") && (
                                    <TableHead className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 text-left">Processing Time</TableHead>
                                )}
                                {visibleColumns.has("actions") && (
                                    <TableHead className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 text-left">Actions</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && files.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-24 text-center">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground/50" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && tableEmpty && (
                                <TableRow>
                                    <TableCell colSpan={11} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center">
                                                <FileText className="h-6 w-6 text-muted-foreground/40" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="font-sans text-sm font-semibold tracking-tight">
                                                    {searchQuery || statusFilter !== "all" ? "No matching files" : "No files yet"}
                                                </p>
                                                <p className="text-xs text-muted-foreground/60">
                                                    {searchQuery || statusFilter !== "all"
                                                        ? "Try adjusting your search or filter"
                                                        : "Import a file to start analyzing data quality"}
                                                </p>
                                            </div>
                                            {!searchQuery && statusFilter === "all" && (
                                                <Button size="sm" className="gap-1.5 mt-1" onClick={handleNewImportOpen}>
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Import File
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredFiles.map((file) => (
                                <TableRow
                                    key={file.upload_id}
                                    data-file-id={file.upload_id}
                                    className={cn(
                                        "hover:bg-muted/20 cursor-pointer transition-all duration-150 border-b border-border/40",
                                        highlightedFileId === file.upload_id && "bg-primary/8 ring-1 ring-primary/20 animate-pulse"
                                    )}
                                    onClick={() => handleViewDetails(file)}
                                >
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selectedFiles.has(file.upload_id)}
                                            onCheckedChange={(checked) => handleSelectFile(file.upload_id, Boolean(checked))}
                                        />
                                    </TableCell>
                                    {visibleColumns.has("file") && (
                                        <TableCell className="text-left">
                                            {(() => {
                                                const upload = file.status === "UPLOADING"
                                                    ? getUploadForFile(file.upload_id) || getUploadForFile(file.original_filename || file.filename || "")
                                                    : undefined;
                                                return (
                                                    <div>
                                                        <p className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[200px]">
                                                            {file.original_filename || file.filename || "Untitled"}
                                                        </p>
                                                        {upload && upload.status === "uploading" ? (
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <Progress value={upload.progress?.percent ?? 0} className="h-1.5 w-20 sm:w-28" />
                                                                <span className="text-[10px] sm:text-xs text-primary font-medium tabular-nums font-mono">
                                                                    {upload.progress?.percent ?? 0}%
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] sm:text-xs text-muted-foreground font-mono tabular-nums">
                                                                {(file.input_size_bytes || file.file_size) ? formatBytes(file.input_size_bytes || file.file_size || 0) : <span className="text-muted-foreground/40">--</span>}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("score") && (
                                        <TableCell className="text-left">
                                            {typeof file.dq_score === "number" ? (
                                                <Badge
                                                    variant="outline"
                                                    className={cn("w-[58px] justify-center text-xs tabular-nums font-mono font-medium", getScoreBadgeColor(file.dq_score))}
                                                >
                                                    {file.dq_score.toFixed(1)}%
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/40">--</span>
                                            )}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("rows") && (
                                        <TableCell className="text-sm text-muted-foreground tabular-nums font-mono text-left">
                                            {(file.rows_clean || file.rows_in) ? (file.rows_clean || file.rows_in) : <span className="text-muted-foreground/40">--</span>}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("category") && (
                                        <TableCell className="text-left">
                                            {(() => {
                                                const hash = file.upload_id
                                                    .split("")
                                                    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                                return (
                                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                                        {hash % 100 < 98 ? "Batch" : "Realtime"}
                                                    </span>
                                                );
                                            })()}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("status") && (
                                        <TableCell className="text-left">
                                            {(() => {
                                                const effectiveStatus =
                                                    file.remediation_state === "REPROCESS_SUBMITTED" && file.status === "DQ_FIXED"
                                                        ? "REPROCESSING"
                                                        : file.remediation_state === "REPROCESS_FAILED" && file.status === "DQ_FIXED"
                                                        ? "REPROCESS_FAILED"
                                                        : file.status;
                                                const active = isActiveStatus(effectiveStatus);
                                                return (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] font-medium whitespace-nowrap px-2 py-0.5 gap-1.5",
                                                            getStatusBadgeColor(effectiveStatus),
                                                        )}
                                                    >
                                                        {active && (
                                                            <span className="relative flex h-1.5 w-1.5">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                                                            </span>
                                                        )}
                                                        {getStatusLabel(effectiveStatus)}
                                                    </Badge>
                                                );
                                            })()}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("uploaded") && (
                                        <TableCell className="text-[11px] text-muted-foreground tabular-nums font-mono text-left">
                                            {formatToIST(file.uploaded_at || file.created_at)}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("updated") && (
                                        <TableCell className="text-[11px] text-muted-foreground tabular-nums font-mono text-left">
                                            {formatToIST(file.updated_at || file.status_timestamp)}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("processingTime") && (
                                        <TableCell className="text-[11px] text-muted-foreground/70 font-mono tabular-nums text-left">
                                            {(() => {
                                                const procTime =
                                                    file.processing_time_seconds ??
                                                    (typeof file.processing_time === "number"
                                                        ? file.processing_time
                                                        : file.processing_time
                                                            ? parseFloat(file.processing_time)
                                                            : 0);
                                                if (procTime && procTime > 0) {
                                                    if (procTime < 1) return `${(procTime * 1000).toFixed(0)}ms`;
                                                    if (procTime < 60) return `${procTime.toFixed(2)}s`;
                                                    const minutes = Math.floor(procTime / 60);
                                                    const remainingSeconds = Math.floor(procTime % 60);
                                                    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
                                                    const hours = Math.floor(minutes / 60);
                                                    const remainingMinutes = minutes % 60;
                                                    return `${hours}h ${remainingMinutes}m`;
                                                }
                                                return "--";
                                            })()}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("actions") && (
                                        <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-start gap-0.5 sm:gap-1">
                                                {(() => {
                                                    const isUploading = file.status === "UPLOADING";
                                                    const isProcessing =
                                                        file.status === "DQ_RUNNING" ||
                                                        file.status === "DQ_DISPATCHED" ||
                                                        isUploading;
                                                    const isProcessed = file.status === "DQ_FIXED" || file.status === "COMPLETED";
                                                    return (
                                                        <>
                                                {!isUploading && (file.status === "UPLOADED" ||
                                                    file.status === "DQ_FAILED" ||
                                                    file.status === "FAILED" ||
                                                    file.status === "UPLOAD_FAILED") && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 sm:h-8 sm:w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                                    onClick={() => handleStartProcessing(file)}
                                                                >
                                                                    <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Start Processing</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                {!isProcessing && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn("h-7 w-7 sm:h-8 sm:w-8", isProcessed ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/40 cursor-not-allowed")}
                                                                disabled={!isProcessed}
                                                                onClick={() => isProcessed && handleViewDetails(file)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{isProcessed ? "Details" : "Available after processing"}</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {isProcessed && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            {(file.rows_quarantined ?? 0) > 0 ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 sm:h-8 sm:w-8 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                                                    onClick={() => handleOpenQuarantineEditor(file)}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground/40 cursor-not-allowed"
                                                                    disabled
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                </Button>
                                                            )}
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {(file.rows_quarantined ?? 0) > 0
                                                                ? `Edit Quarantined Rows (${file.rows_quarantined})`
                                                                : "No Quarantined Rows"}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {/* Export button */}
                                                {!isProcessing && !isUploading && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn("h-7 w-7 sm:h-8 sm:w-8", isProcessed ? "text-primary hover:text-primary hover:bg-primary/10" : "text-muted-foreground/40 cursor-not-allowed")}
                                                                disabled={!isProcessed || downloading === file.upload_id}
                                                                onClick={() => isProcessed && openActionsDialog(file)}
                                                            >
                                                                {downloading === file.upload_id ? (
                                                                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                                                ) : (
                                                                    <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                )}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{isProcessed ? "Export" : "Available after processing"}</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 sm:h-8 sm:w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => {
                                                                // Cancel active upload if file is still uploading
                                                                if (file.status === "UPLOADING") {
                                                                    cancelUpload(file.upload_id);
                                                                    cancelUpload(file.original_filename || file.filename || "");
                                                                }
                                                                handleDeleteClick(file);
                                                            }}
                                                            disabled={deleting === file.upload_id}
                                                        >
                                                            {deleting === file.upload_id ? (
                                                                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{file.status === "UPLOADING" ? "Cancel & Delete" : "Delete"}</TooltipContent>
                                                </Tooltip>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {filteredFiles.length > 0 && (
                    <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/50 border-t border-border/40 font-mono">
                        Timestamps in IST (UTC+5:30)
                    </p>
                )}
            </div>
        </div>
    );
}
