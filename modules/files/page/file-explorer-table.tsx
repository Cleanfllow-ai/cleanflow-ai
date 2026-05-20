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
    AlertTriangle,
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { ImportProgressRow } from "@/modules/files/components/import-progress-row";
import { OptimizingBadge } from "@/modules/files/components/optimizing-badge";
import { RejectionReasonBadge } from "@/modules/files/components/rejection-reason-badge";
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

// Set to true to re-expose the Generic ERP-template badge (technical detail, hidden for customer-facing UI)
const SHOW_GENERIC_BADGE = false;

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
        handleStopClick, stopping,
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
                            aria-label="Dismiss upload notification"
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
                            aria-label="Clear filters"
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
                                aria-label="Column picker"
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
                                <TableHead
                                    className="w-10 text-center"
                                    data-bulk-checkbox="true"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Checkbox
                                        checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                                        onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                                        aria-label="Select all files"
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
                            {/* W5A-2 — Sarah: "/files takes ~3 seconds to render the
                                table - feels broken." Skeleton rows give the user a
                                solid pattern to look at within the first 200ms instead
                                of an isolated centred spinner. 5 rows that mirror the
                                actual column layout so the table doesn't visibly jump
                                when real data arrives. */}
                            {loading && files.length === 0 && (
                                <>
                                    {Array.from({ length: 5 }).map((_, rowIdx) => (
                                        <TableRow
                                            key={`skeleton-row-${rowIdx}`}
                                            data-testid="files-table-skeleton-row"
                                            className="border-b border-border/40"
                                        >
                                            <TableCell className="text-center">
                                                <Skeleton className="h-4 w-4 rounded-sm mx-auto" />
                                            </TableCell>
                                            {visibleColumns.has("file") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-[140px]" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("score") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-12" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("rows") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-16" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("category") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-20" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("status") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-5 w-20 rounded-full" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("uploaded") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-24" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("updated") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-24" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("processingTime") && (
                                                <TableCell className="text-left">
                                                    <Skeleton className="h-4 w-16" />
                                                </TableCell>
                                            )}
                                            {visibleColumns.has("actions") && (
                                                <TableCell className="text-left">
                                                    <div className="flex items-center gap-2">
                                                        <Skeleton className="h-7 w-7 rounded" />
                                                        <Skeleton className="h-7 w-7 rounded" />
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </>
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
                                                    {searchQuery || statusFilter !== "all" ? "No files match these filters." : "No files yet"}
                                                </p>
                                                <p className="text-xs text-muted-foreground/60">
                                                    {searchQuery || statusFilter !== "all"
                                                        ? "Try clearing them to see all files."
                                                        : "Import a file to start analyzing data quality"}
                                                </p>
                                            </div>
                                            {(searchQuery || statusFilter !== "all") && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 mt-1"
                                                    data-testid="clear-filters-button"
                                                    onClick={() => {
                                                        setSearchQuery("");
                                                        setStatusFilter("all");
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    Clear Filters
                                                </Button>
                                            )}
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
                                    data-testid="file-row"
                                    className={cn(
                                        "hover:bg-muted/20 cursor-pointer transition-all duration-150 border-b border-border/40",
                                        highlightedFileId === file.upload_id && "bg-primary/8 ring-1 ring-primary/20 animate-pulse"
                                    )}
                                    onClick={(e) => {
                                        // Wave 2 FIX D: row-click opens detail dialog, but
                                        // ONLY when the click did NOT originate inside the
                                        // leftmost bulk-select cell (data-bulk-checkbox).
                                        // Preserves Bug 21 bulk-select: checkbox cell selects
                                        // without opening dialog; rest of row opens.
                                        const target = e.target as HTMLElement | null
                                        if (target?.closest('[data-bulk-checkbox="true"]')) {
                                            return
                                        }
                                        handleViewDetails(file)
                                    }}
                                >
                                    <TableCell
                                        className="text-center"
                                        data-bulk-checkbox="true"
                                        data-testid="file-row-checkbox-cell"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Checkbox
                                            checked={selectedFiles.has(file.upload_id)}
                                            onCheckedChange={(checked) => handleSelectFile(file.upload_id, Boolean(checked))}
                                            aria-label={`Select ${file.original_filename || file.filename || 'file'}`}
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
                                                        ) : file.status === "REJECTED" ? (
                                                            <RejectionReasonBadge failureReason={file.failure_reason} />
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
                                            {file.rows_in != null ? file.rows_in : <span className="text-muted-foreground/40">--</span>}
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
                                                // Inline progress bar for in-flight connector imports — replaces
                                                // the static "IMPORTING" pill so the user sees real bytes / MB·s /
                                                // ETA in the row, even after closing the Import Data dialog.
                                                // Phase 7B (logical sharding): the backend may emit OPTIMIZING
                                                // / OPTIMIZE_FAILED while it repacks an upload into shard-aligned
                                                // form. Render the dedicated badge component (amber pill +
                                                // spinner / red pill + tooltip) and bail out before falling
                                                // through to the generic status-pill renderer.
                                                if (
                                                    effectiveStatus === "OPTIMIZING" ||
                                                    effectiveStatus === "OPTIMIZE_FAILED"
                                                ) {
                                                    return (
                                                        <OptimizingBadge
                                                            status={effectiveStatus}
                                                            errorReason={file.error_reason}
                                                        />
                                                    );
                                                }
                                                if (effectiveStatus === "IMPORTING") {
                                                    const importStatus =
                                                        file.import_status === "downloading" ||
                                                        file.import_status === "uploading" ||
                                                        file.import_status === "completed" ||
                                                        file.import_status === "failed"
                                                            ? file.import_status
                                                            : "downloading";
                                                    const bytesDownloaded =
                                                        typeof file.bytes_downloaded === "number"
                                                            ? file.bytes_downloaded
                                                            : typeof file.bytes_transferred === "number"
                                                            ? file.bytes_transferred
                                                            : 0;
                                                    const bytesTotal =
                                                        typeof file.bytes_total === "number" && file.bytes_total > 0
                                                            ? file.bytes_total
                                                            : typeof file.file_size === "number" && file.file_size > 0
                                                            ? file.file_size
                                                            : typeof file.input_size_bytes === "number" && file.input_size_bytes > 0
                                                            ? file.input_size_bytes
                                                            : 0;
                                                    return (
                                                        <ImportProgressRow
                                                            importStatus={importStatus}
                                                            bytesDownloaded={bytesDownloaded}
                                                            bytesTotal={bytesTotal}
                                                            updatedAt={
                                                                file.download_updated_at ||
                                                                file.updated_at ||
                                                                file.status_timestamp ||
                                                                ""
                                                            }
                                                        />
                                                    );
                                                }
                                                const active = isActiveStatus(effectiveStatus);
                                                const showPartialWarning = file.partial_completion === true;
                                                return (
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge
                                                            variant="outline"
                                                            data-testid="file-status-label"
                                                            data-status-raw={effectiveStatus}
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
                                                        {showPartialWarning && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span
                                                                        role="img"
                                                                        aria-label="Processed with warnings — partial completion"
                                                                        title="Processed with warnings — partial completion"
                                                                        data-testid="partial-completion-warning-icon"
                                                                        className="inline-flex shrink-0"
                                                                    >
                                                                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Processed with warnings — some shards encountered errors during DQ processing. Click for details.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {SHOW_GENERIC_BADGE && file.validation?.mode === "GENERIC_FALLBACK" && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-[9px] font-medium whitespace-nowrap px-1.5 py-0 h-4 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                                        data-testid="generic-fallback-badge"
                                                                    >
                                                                        Generic
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    {file.validation?.auto_detect_warning === "no_erp_match"
                                                                        ? "Headers didn't match any registered ERP template — DQ ran in generic mode (template checks skipped). The file is still validated against universal rules."
                                                                        : file.validation?.auto_detect_warning === "ambiguous_match"
                                                                        ? "Headers matched multiple ERP templates ambiguously — DQ ran in generic mode."
                                                                        : "DQ ran in generic mode — ERP-specific template checks were skipped for this file."}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </div>
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
                                                    const isImporting = file.status === "IMPORTING";
                                                    // In-flight states share a single "Stop" affordance. Anything
                                                    // here is non-terminal — Delete is intentionally hidden so the
                                                    // user can't trip the backend's Phase-1 in-flight delete guard
                                                    // (which returns 409 and produced the "unstoppable download"
                                                    // bug this commit fixes).
                                                    const inFlightStates = new Set([
                                                        "UPLOADING",
                                                        "IMPORTING",
                                                        "INITIATING",
                                                        "DQ_DISPATCHED",
                                                        "DQ_RUNNING",
                                                        "NORMALIZING",
                                                        "SHARDING",
                                                        "QUEUED",
                                                        "REPROCESSING",
                                                    ]);
                                                    const isInFlight = inFlightStates.has(file.status);
                                                    const isProcessed = file.status === "DQ_FIXED" || file.status === "COMPLETED";

                                                    // ─── In-flight: collapse to a single Stop button ───
                                                    // This is the bug fix — previously this branch (for IMPORTING)
                                                    // wired the X icon to handleDeleteClick, which then hit
                                                    // DELETE /uploads/{id} and got blocked by the backend's
                                                    // in-flight guard (409). Now X → POST /uploads/{id}/cancel,
                                                    // which transitions the row to IMPORT_FAILED / DQ_FAILED so
                                                    // the trash icon shows up on the next poll tick.
                                                    // ─── Phase 7B: optimizer states ───
                                                    // OPTIMIZING / OPTIMIZE_FAILED show a disabled Play (Process)
                                                    // button with a contextual tooltip per spec, then defer to
                                                    // the standard Delete affordance below. These are kept OUT
                                                    // of `inFlightStates` because we want Process gating, not
                                                    // the in-flight Stop button (the optimizer Lambda owns the
                                                    // lifecycle and is not user-cancellable).
                                                    const isOptimizing = file.status === "OPTIMIZING";
                                                    const isOptimizeFailed = file.status === "OPTIMIZE_FAILED";
                                                    if (isOptimizing || isOptimizeFailed) {
                                                        const tooltip = isOptimizing
                                                            ? "File is being optimized — please wait"
                                                            : "Cannot process — optimize failed. Re-upload or contact support.";
                                                        return (
                                                            <>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="inline-flex">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-muted-foreground/40 cursor-not-allowed"
                                                                                disabled
                                                                                aria-label={tooltip}
                                                                                data-testid="optimize-process-disabled"
                                                                            >
                                                                                <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                            </Button>
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>{tooltip}</TooltipContent>
                                                                </Tooltip>
                                                                {/* Allow delete on OPTIMIZE_FAILED so user can re-upload;
                                                                    suppress on OPTIMIZING — the optimizer is mid-flight
                                                                    and an in-flight delete would race the backend. */}
                                                                {isOptimizeFailed && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                                                onClick={() => handleDeleteClick(file)}
                                                                                disabled={deleting === file.upload_id}
                                                                                aria-label="Delete file"
                                                                            >
                                                                                {deleting === file.upload_id ? (
                                                                                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                                                ) : (
                                                                                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                                )}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Delete</TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </>
                                                        );
                                                    }

                                                    if (isInFlight) {
                                                        // Tooltip mirrors the new "Stop & Delete" semantics —
                                                        // clicking opens the confirm dialog whose primary action
                                                        // cancels the in-flight op AND removes the catalog row.
                                                        const tooltipLabel =
                                                            isImporting ? "Stop import & delete" :
                                                            isUploading ? "Cancel upload & delete" :
                                                            "Stop processing & delete";
                                                        return (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-10 w-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                                        onClick={() => {
                                                                            // For an in-browser XHR upload, also abort the
                                                                            // local upload tracker so we don't keep streaming
                                                                            // bytes to S3 after the user clicked Stop.
                                                                            if (isUploading) {
                                                                                cancelUpload(file.upload_id);
                                                                                cancelUpload(file.original_filename || file.filename || "");
                                                                            }
                                                                            handleStopClick(file);
                                                                        }}
                                                                        disabled={stopping === file.upload_id}
                                                                        data-testid="stop-import-button"
                                                                        aria-label={tooltipLabel}
                                                                    >
                                                                        {stopping === file.upload_id ? (
                                                                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                                        ) : (
                                                                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                        )}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{tooltipLabel}</TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    }

                                                    // ─── Terminal: full actions bar (incl. Delete) ───
                                                    return (
                                                        <>
                                                {(file.status === "UPLOADED" ||
                                                    file.status === "VALIDATED" ||
                                                    file.status === "DQ_FAILED" ||
                                                    file.status === "FAILED") && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-10 w-10 text-primary hover:text-primary hover:bg-primary/10"
                                                                    // R3-3 (2026-05-19): defensive stopPropagation so the
                                                                    // Run DQ click never bubbles to the row's onClick
                                                                    // (which opens the file-details dialog). The wrapping
                                                                    // TableCell already calls stopPropagation, but a
                                                                    // belt-and-braces stop here protects against future
                                                                    // refactors that re-parent this button outside the
                                                                    // cell.
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleStartProcessing(file)
                                                                    }}
                                                                    data-testid="run-dq-button"
                                                                    aria-label="Run DQ"
                                                                >
                                                                    <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {file.status === "VALIDATED" ? "Run DQ" : "Start Processing"}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn("h-10 w-10", isProcessed ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/40 cursor-not-allowed")}
                                                            disabled={!isProcessed}
                                                            onClick={() => isProcessed && handleViewDetails(file)}
                                                            aria-label={isProcessed ? "View file details" : "Details available after processing"}
                                                        >
                                                            <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{isProcessed ? "Details" : "Available after processing"}</TooltipContent>
                                                </Tooltip>
                                                {isProcessed && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            {(file.rows_quarantined ?? 0) > 0 ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-10 w-10 text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                                                                    onClick={() => handleOpenQuarantineEditor(file)}
                                                                    aria-label={`Edit quarantined rows (${file.rows_quarantined})`}
                                                                >
                                                                    <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-10 w-10 text-muted-foreground/40 cursor-not-allowed"
                                                                    disabled
                                                                    aria-label="No quarantined rows to edit"
                                                                >
                                                                    <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
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
                                                {/* Export — single button (icon + label), opens dialog with Download CSV / Parquet / Push to ERP options */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className={cn(
                                                                "h-9 gap-1.5 px-3 text-xs",
                                                                isProcessed
                                                                    ? "border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                                                                    : "text-muted-foreground/40 cursor-not-allowed"
                                                            )}
                                                            disabled={!isProcessed || downloading === file.upload_id}
                                                            onClick={() => isProcessed && openActionsDialog(file)}
                                                            aria-label={isProcessed ? "Export file" : "Export available after processing"}
                                                            data-testid="export-button"
                                                        >
                                                            {downloading === file.upload_id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <Upload className="h-3.5 w-3.5" />
                                                            )}
                                                            Export
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {isProcessed ? "Download CSV/Parquet or push to ERP" : "Available after processing"}
                                                    </TooltipContent>
                                                </Tooltip>
                                                {/* Delete (terminal states only) */}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteClick(file)}
                                                            disabled={deleting === file.upload_id}
                                                            aria-label="Delete file"
                                                        >
                                                            {deleting === file.upload_id ? (
                                                                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                            )}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete</TooltipContent>
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
