"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    ChevronDown,
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
    isActiveStatus,
} from "@/modules/files/page/utils";
import { getFriendlyStatusLabel } from "@/shared/lib/file-status-label";
import { formatFileDisplayName } from "@/shared/lib/file-name-format";
import { useUploadManager } from "@/modules/files/context/upload-manager";
import type { FilesPageState } from "./use-files-page";

// Set to true to re-expose the Generic ERP-template badge (technical detail, hidden for customer-facing UI)
const SHOW_GENERIC_BADGE = false;

// ─── Bug 3 (P1, 2026-05-21): multi-status filter chips ─────────────────
// Power users asked for "show me only failed + quarantined". The legacy
// single-status dropdown lives in the hook (use-files-page); we layer chip
// state on top of it purely in this component so the hook contract stays
// frozen for Wave 1C. Chip clicks force statusFilter -> "all" (broadest
// underlying pool) and we re-filter `visibleFiles`/`filteredFiles` locally.
// URL persistence uses `status_multi=cleaned,failed` so back/forward works.
type StatusChipKey = "cleaned" | "quarantined" | "failed" | "processing" | "ready";

const STATUS_CHIPS: Array<{
    key: StatusChipKey;
    label: string;
    /** Predicate against a FilesPageState file row. */
    match: (file: { status?: string; rows_quarantined?: number | null }) => boolean;
}> = [
    {
        key: "cleaned",
        label: "Cleaned",
        // DQ_FIXED rows with NO outstanding quarantine = truly clean.
        match: (f) => f.status === "DQ_FIXED" && !((f.rows_quarantined ?? 0) > 0),
    },
    {
        key: "quarantined",
        label: "Quarantined",
        // Any processed file with at least one quarantined row.
        match: (f) => f.status === "DQ_FIXED" && (f.rows_quarantined ?? 0) > 0,
    },
    {
        key: "failed",
        label: "Failed",
        match: (f) =>
            f.status === "DQ_FAILED" ||
            f.status === "FAILED" ||
            f.status === "UPLOAD_FAILED" ||
            f.status === "REJECTED",
    },
    {
        key: "processing",
        label: "Processing",
        match: (f) =>
            f.status === "DQ_RUNNING" ||
            f.status === "DQ_DISPATCHED" ||
            f.status === "QUEUED" ||
            f.status === "REPROCESSING" ||
            f.status === "NORMALIZING" ||
            f.status === "SHARDING" ||
            f.status === "IMPORTING" ||
            f.status === "UPLOADING" ||
            f.status === "INITIATING" ||
            f.status === "OPTIMIZING",
    },
    {
        key: "ready",
        label: "Ready",
        // Validated / uploaded — waiting for the user to kick off DQ.
        match: (f) => f.status === "UPLOADED" || f.status === "VALIDATED",
    },
];
const CHIP_KEYS = new Set<StatusChipKey>(STATUS_CHIPS.map((c) => c.key));

interface FileExplorerTableProps {
    state: FilesPageState;
}

export function FileExplorerTable({ state }: FileExplorerTableProps) {
    const {
        files, loading, filteredFiles, tableEmpty,
        // Bug #2: render `visibleFiles` (windowed) instead of `filteredFiles`
        // so the DOM stays bounded at PAGE_SIZE rows (100 default). The
        // "Showing N of M / Load more" affordance lives below the table.
        visibleFiles, hasMoreFiles, handleLoadMoreFiles, visibleRowLimit,
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
        // Bug #6: bulk Re-run DQ
        handleBulkRerunDq, bulkRerunning,
        recentlyUploaded, setRecentlyUploaded,
        setWizardFile, setWizardOpen,
        handleNewImportOpen,
    } = state;
    const { activeUploads, getUploadForFile, cancelUpload } = useUploadManager();

    // ─── Bug 3: chip filter state (URL-synced) ─────────────────────────
    // Single source of truth: ?status_multi=cleaned,failed in the URL. We
    // hydrate from the URL on mount, push back to the URL on toggle. The
    // hook's `statusFilter` stays decoupled — when chips are active we
    // force-call setStatusFilter("all") so the underlying pool is broad
    // enough to feed our local re-filter.
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [statusChips, setStatusChips] = useState<Set<StatusChipKey>>(new Set());

    // Hydrate chip state from URL on mount + when the user navigates back.
    useEffect(() => {
        const raw = searchParams.get("status_multi");
        if (!raw) {
            if (statusChips.size > 0) setStatusChips(new Set());
            return;
        }
        const next = new Set<StatusChipKey>();
        for (const part of raw.split(",")) {
            const trimmed = part.trim() as StatusChipKey;
            if (CHIP_KEYS.has(trimmed)) next.add(trimmed);
        }
        // Only update if it actually changed to avoid render loops.
        const sameSize = next.size === statusChips.size;
        const sameMembers = sameSize && Array.from(next).every((k) => statusChips.has(k));
        if (!sameMembers) setStatusChips(next);
        // We intentionally depend only on searchParams — statusChips would
        // create a feedback loop with the URL writer below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const writeChipsToUrl = (next: Set<StatusChipKey>) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.size === 0) {
            params.delete("status_multi");
        } else {
            params.set("status_multi", Array.from(next).join(","));
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    const chipsActive = statusChips.size > 0;

    // Mutual exclusion: when chips are active, force the legacy dropdown to
    // "all" so the hook returns the broadest possible pool that we then
    // re-filter below.
    useEffect(() => {
        if (chipsActive && statusFilter !== "all") {
            setStatusFilter("all");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chipsActive]);

    const toggleChip = (key: StatusChipKey) => {
        const next = new Set(statusChips);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setStatusChips(next);
        writeChipsToUrl(next);
        // Picking a chip implicitly clears any single-status dropdown
        // selection so we don't end up with two filters fighting.
        if (next.size > 0 && statusFilter !== "all") setStatusFilter("all");
    };

    const clearChips = () => {
        if (statusChips.size === 0) return;
        setStatusChips(new Set());
        writeChipsToUrl(new Set());
    };

    // Dropdown picks override chips — wrap setStatusFilter so we always
    // clear chips when the user picks a single-status option.
    const handleDropdownPick = (value: string) => {
        if (chipsActive) {
            setStatusChips(new Set());
            writeChipsToUrl(new Set());
        }
        setStatusFilter(value);
    };

    // Apply chip filter on top of the hook output. When no chips are
    // active these collapse to the pass-through identity (no-op cost).
    const chipFilteredVisible = useMemo(() => {
        if (!chipsActive) return visibleFiles;
        const matchers = STATUS_CHIPS.filter((c) => statusChips.has(c.key));
        return visibleFiles.filter((f) => matchers.some((m) => m.match(f)));
    }, [chipsActive, statusChips, visibleFiles]);

    const chipFilteredAll = useMemo(() => {
        if (!chipsActive) return filteredFiles;
        const matchers = STATUS_CHIPS.filter((c) => statusChips.has(c.key));
        return filteredFiles.filter((f) => matchers.some((m) => m.match(f)));
    }, [chipsActive, statusChips, filteredFiles]);

    // Effective values the table body should read. Falls back to the hook
    // outputs when chips are inactive so we don't subtly change behaviour
    // for the existing single-status path.
    const effectiveVisibleFiles = chipsActive ? chipFilteredVisible : visibleFiles;
    const effectiveFilteredFiles = chipsActive ? chipFilteredAll : filteredFiles;
    const effectiveTableEmpty = chipsActive ? chipFilteredAll.length === 0 : tableEmpty;
    const hasAnyActiveFilter = chipsActive || !!searchQuery || statusFilter !== "all";

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
                                    {chipsActive
                                        ? "Custom"
                                        : STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || "Filter"}
                                </span>
                                <Filter className="h-3.5 w-3.5 ml-2 opacity-40" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => handleDropdownPick("all")}>All</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDropdownPick("attention")} className="text-amber-600 font-medium">
                                Needs Attention
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDropdownPick("UPLOADED")}>Uploaded</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDropdownPick("DQ_FIXED")}>Processed</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDropdownPick("DQ_RUNNING")}>Processing</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDropdownPick("QUEUED")}>Queued</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDropdownPick("FAILED")}>Failed</DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Quality</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => handleDropdownPick("excellent")}>Excellent</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDropdownPick("good")}>Good</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDropdownPick("bad")}>Bad</DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {(searchQuery || statusFilter !== "all" || chipsActive) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Clear filters"
                            className="h-9 px-2 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("all");
                                clearChips();
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
                            {effectiveFilteredFiles.length === files.length
                                ? `${files.length} file${files.length !== 1 ? "s" : ""}`
                                : `${effectiveFilteredFiles.length} of ${files.length}`}
                        </span>
                    )}
                    {/*
                      * Bug #6 (P1, 2026-05-21): bulk-action toolbar. Previously
                      * the only bulk action was Delete; power users asked for
                      * Re-run DQ (loops POST /files/{id}/process). Archive is
                      * NOT exposed: no BE archive endpoint exists today —
                      * surfacing a button that always errors would be worse
                      * than silence. TODO: wire to /uploads/{id}/archive once
                      * the connectors-context owners add it. The pattern here
                      * mirrors `modules/jobs/components/jobs-list.tsx` so the
                      * two batch toolbars stay visually consistent.
                      */}
                    {selectedFiles.size > 0 && (
                        <>
                            <span
                                className="hidden sm:inline text-[11px] font-semibold tabular-nums text-primary mr-1"
                                style={{ fontFamily: "'IBM Plex Mono', var(--font-mono, monospace)" }}
                                data-testid="bulk-selection-count"
                            >
                                {selectedFiles.size} selected
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 px-3 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                                onClick={handleBulkRerunDq}
                                disabled={bulkRerunning || bulkDeleting}
                                data-testid="bulk-rerun-dq-button"
                            >
                                {bulkRerunning ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Play className="h-3.5 w-3.5" />
                                )}
                                <span className="text-sm font-medium">Re-run DQ</span>
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-9 gap-1.5 px-3.5"
                                onClick={handleBulkDeleteClick}
                                disabled={bulkDeleting || bulkRerunning}
                                data-testid="bulk-delete-button"
                            >
                                {bulkDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                )}
                                <span className="text-sm font-medium">Delete {selectedFiles.size}</span>
                            </Button>
                        </>
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

            {/* Bug 3 (P1, 2026-05-21): multi-status chip strip. Sits below the
                search/filter bar so it doesn't fight for horizontal space on
                small screens. Each chip toggles independently; "Clear filters"
                appears next to them when at least one is active. */}
            <div
                className="flex flex-wrap items-center gap-1.5"
                data-testid="files-status-chip-strip"
                role="group"
                aria-label="Filter files by status"
            >
                {STATUS_CHIPS.map((chip) => {
                    const active = statusChips.has(chip.key);
                    return (
                        <button
                            key={chip.key}
                            type="button"
                            data-testid={`status-chip-${chip.key}`}
                            data-active={active}
                            aria-pressed={active}
                            onClick={() => toggleChip(chip.key)}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                active
                                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                                    : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50",
                            )}
                        >
                            {chip.label}
                            {chip.key === "cleaned" && active && (
                                <CheckCircle className="h-3 w-3" aria-hidden />
                            )}
                            {chip.key === "cleaned" && !active && (
                                <span aria-hidden className="text-muted-foreground/50">{"✓"}</span>
                            )}
                        </button>
                    );
                })}
                {chipsActive && (
                    <button
                        type="button"
                        onClick={clearChips}
                        data-testid="status-chip-clear"
                        className="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                        Clear filters
                    </button>
                )}
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
                                        checked={effectiveFilteredFiles.length > 0 && selectedFiles.size === effectiveFilteredFiles.length}
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
                            {!loading && effectiveTableEmpty && (
                                <TableRow>
                                    <TableCell colSpan={11} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center">
                                                <FileText className="h-6 w-6 text-muted-foreground/40" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="font-sans text-sm font-semibold tracking-tight">
                                                    {hasAnyActiveFilter ? "No files match these filters." : "No files yet"}
                                                </p>
                                                <p className="text-xs text-muted-foreground/60">
                                                    {hasAnyActiveFilter
                                                        ? "Try clearing them to see all files."
                                                        : "Import a file to start analyzing data quality"}
                                                </p>
                                            </div>
                                            {hasAnyActiveFilter && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 mt-1"
                                                    data-testid="clear-filters-button"
                                                    onClick={() => {
                                                        setSearchQuery("");
                                                        setStatusFilter("all");
                                                        clearChips();
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    Clear Filters
                                                </Button>
                                            )}
                                            {!hasAnyActiveFilter && (
                                                <Button size="sm" className="gap-1.5 mt-1" onClick={handleNewImportOpen}>
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Import File
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {/* Bug #2: render windowed `visibleFiles` (capped at
                                visibleRowLimit ≤ filteredFiles.length) instead of
                                the full filtered list to keep the DOM bounded at
                                100 rows by default. "Load more" footer below
                                grows the window in PAGE_SIZE increments. */}
                            {effectiveVisibleFiles.map((file) => (
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
                                                // Bug 4: friendly display name for connector imports and
                                                // unstructured-* UUID filenames. The raw filename is preserved
                                                // in `original_filename`/`filename` for downloads + search; only
                                                // the rendered string here changes.
                                                const rawName = file.original_filename || file.filename || "";
                                                const friendlyName = rawName
                                                    ? formatFileDisplayName(rawName, {
                                                          source: file.source_type,
                                                          importedAt: file.uploaded_at || file.created_at,
                                                      })
                                                    : "Untitled";
                                                return (
                                                    <div>
                                                        <p
                                                            className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[200px]"
                                                            title={rawName || undefined}
                                                            data-testid="file-row-display-name"
                                                        >
                                                            {friendlyName}
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
                                                            {getFriendlyStatusLabel(effectiveStatus)}
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
                                                            className="h-10 w-10 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleViewDetails(file)}
                                                            aria-label="View file details"
                                                        >
                                                            <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{isProcessed ? "Details" : "Preview"}</TooltipContent>
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
                {/* Bug #2 (P1, 2026-05-21): pagination affordance. Only rendered
                    when the windowed slice hides at least one row; the user gets
                    "Showing X of Y" + a Load More button that grows the window
                    by PAGE_SIZE. Below-the-fold timestamps note moved into the
                    same border-top stripe so we don't ship two separate rules. */}
                {effectiveFilteredFiles.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border/40 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-mono">
                            {/* When chips are active we hide "Load more" because the
                                local re-filter is applied AFTER the hook's PAGE_SIZE
                                window — bumping the window wouldn't change the chip
                                output reliably. The page-size window still works for
                                the non-chip path, which is what most users hit. */}
                            {hasMoreFiles && !chipsActive ? (
                                <>
                                    Showing {effectiveVisibleFiles.length} of {effectiveFilteredFiles.length}
                                    <span className="ml-2 text-muted-foreground/40">
                                        · Timestamps in IST (UTC+5:30)
                                    </span>
                                </>
                            ) : (
                                <>Timestamps in IST (UTC+5:30)</>
                            )}
                        </p>
                        {hasMoreFiles && !chipsActive && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 self-start sm:self-auto"
                                onClick={handleLoadMoreFiles}
                                data-testid="files-load-more-button"
                            >
                                <ChevronDown className="h-3.5 w-3.5" />
                                Load more
                                <span className="text-[10px] text-muted-foreground/70 tabular-nums font-mono">
                                    ({filteredFiles.length - visibleFiles.length} remaining)
                                </span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
