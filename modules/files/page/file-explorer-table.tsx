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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatBytes, formatToIST } from "@/shared/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
        handleViewDetails, handleStartProcessing,
        openActionsDialog, handleDeleteClick,
        downloading, deleting,
        handleOpenQuarantineEditor,
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
            return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
        return sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3 ml-1" />
        ) : (
            <ArrowDown className="h-3 w-3 ml-1" />
        );
    };

    return (
        <div className="space-y-4">
            {/* Post-upload prompt */}
            {recentlyUploaded && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span>
                            <strong>{recentlyUploaded.original_filename || recentlyUploaded.filename}</strong> uploaded successfully
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={() => {
                                setWizardFile(recentlyUploaded);
                                setWizardOpen(true);
                                setRecentlyUploaded(null);
                            }}
                        >
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            Start Processing
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setRecentlyUploaded(null)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="h-9 w-full sm:w-48 pl-8 text-sm"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-9 w-32 sm:w-36 text-sm justify-between"
                            >
                                <span className="truncate">
                                    {STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || "Filter"}
                                </span>
                                <Filter className="h-3.5 w-3.5 ml-2 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => setStatusFilter("all")}>All</DropdownMenuItem>
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
                        <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {filteredFiles.length === files.length
                                ? `${files.length} file${files.length !== 1 ? "s" : ""}`
                                : `${filteredFiles.length} of ${files.length}`}
                        </span>
                    )}
                    <Button
                        size="sm"
                        className="h-9 gap-1.5 px-3"
                        onClick={handleNewImportOpen}
                    >
                        <Plus className="h-4 w-4" />
                        Import
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        onClick={handleManualRefresh}
                        disabled={isManualRefresh}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-1.5", isManualRefresh && "animate-spin")} />
                        Refresh
                    </Button>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
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
            <div className="rounded-lg border bg-card">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                {visibleColumns.has("file") && (
                                    <TableHead
                                        className="text-xs cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("name")}
                                    >
                                        <span className="flex items-center">File<SortIcon field="name" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("score") && (
                                    <TableHead
                                        className="text-xs cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("score")}
                                    >
                                        <span className="flex items-center">Quality<SortIcon field="score" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("rows") && (
                                    <TableHead className="text-xs text-left">Rows</TableHead>
                                )}
                                {visibleColumns.has("category") && (
                                    <TableHead className="text-xs text-left">Ingestion Type</TableHead>
                                )}
                                {visibleColumns.has("status") && (
                                    <TableHead
                                        className="text-xs cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("status")}
                                    >
                                        <span className="flex items-center">Status<SortIcon field="status" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("uploaded") && (
                                    <TableHead
                                        className="text-xs cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("uploaded")}
                                    >
                                        <span className="flex items-center">Uploaded<SortIcon field="uploaded" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("updated") && (
                                    <TableHead
                                        className="text-xs cursor-pointer hover:text-foreground transition-colors text-left"
                                        onClick={() => handleSort("updated")}
                                    >
                                        <span className="flex items-center">Updated<SortIcon field="updated" /></span>
                                    </TableHead>
                                )}
                                {visibleColumns.has("processingTime") && (
                                    <TableHead className="text-xs text-left">Processing Time</TableHead>
                                )}
                                {visibleColumns.has("actions") && (
                                    <TableHead className="text-xs text-left">Actions</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && files.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && tableEmpty && (
                                <TableRow>
                                    <TableCell colSpan={10} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
                                                <FileText className="h-6 w-6 text-muted-foreground/60" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">
                                                    {searchQuery || statusFilter !== "all" ? "No matching files" : "No files yet"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
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
                                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => handleViewDetails(file)}
                                >
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
                                                                <span className="text-[10px] sm:text-xs text-primary font-medium tabular-nums">
                                                                    {upload.progress?.percent ?? 0}%
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                                                                {formatBytes(file.input_size_bytes || file.file_size || 0)}
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
                                                    className={cn("w-[58px] justify-center text-xs tabular-nums font-medium", getScoreBadgeColor(file.dq_score))}
                                                >
                                                    {file.dq_score.toFixed(1)}%
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("rows") && (
                                        <TableCell className="text-sm text-muted-foreground tabular-nums text-left">
                                            {file.rows_clean || file.rows_in || 0}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("category") && (
                                        <TableCell className="text-xs text-muted-foreground text-left">
                                            {(() => {
                                                const hash = file.upload_id
                                                    .split("")
                                                    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                                return hash % 100 < 98 ? "Batch" : "Realtime";
                                            })()}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("status") && (
                                        <TableCell className="text-left">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs font-medium whitespace-nowrap px-2 py-0.5",
                                                    getStatusBadgeColor(file.status),
                                                )}
                                            >
                                                {file.status || "UNKNOWN"}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("uploaded") && (
                                        <TableCell className="text-xs text-muted-foreground tabular-nums text-left">
                                            {formatToIST(file.uploaded_at || file.created_at)}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("updated") && (
                                        <TableCell className="text-xs text-muted-foreground tabular-nums text-left">
                                            {formatToIST(file.updated_at || file.status_timestamp)}
                                        </TableCell>
                                    )}
                                    {visibleColumns.has("processingTime") && (
                                        <TableCell className="text-xs text-muted-foreground text-left">
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
                                                return "—";
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
                                                                className="h-7 w-7 sm:h-8 sm:w-8"
                                                                onClick={() => handleViewDetails(file)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Details</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {(file.rows_quarantined ?? 0) > 0 && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 sm:h-8 sm:w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                onClick={() => handleOpenQuarantineEditor(file)}
                                                                disabled={!(file.status === "DQ_FIXED" || file.status === "COMPLETED")}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {file.status === "DQ_FIXED" || file.status === "COMPLETED"
                                                                ? `Edit Quarantined Rows (${file.rows_quarantined})`
                                                                : "Run DQ first to edit quarantined rows"}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {!isProcessing && !isUploading && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 sm:h-8 gap-1 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
                                                                disabled={downloading === file.upload_id}
                                                                onClick={() => openActionsDialog(file)}
                                                            >
                                                                {downloading === file.upload_id ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Upload className="h-3.5 w-3.5" />
                                                                )}
                                                                <span className="hidden sm:inline">Export</span>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Export / Download</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
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
                    <p className="px-4 py-2 text-xs text-muted-foreground border-t">
                        Timestamps in IST (UTC+5:30)
                    </p>
                )}
            </div>
        </div>
    );
}
