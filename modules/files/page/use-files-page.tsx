"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/shared/store/store";
import {
    fetchFiles,
    resetFiles,
    updateFile,
    removeFile,
    selectFiles,
    selectFilesStatus,
    selectFilesError,
} from "@/modules/files/store/filesSlice";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/modules/auth";
import { ApiError } from "@/modules/shared/api-error";
import { toastFromError, toastFromQuarantineError } from "@/lib/error-toast-jsx";
import { ToastAction as _ToastAction } from "@/components/ui/toast";
import { buildPrefixedDataFilename, sanitizeFilenamePart } from "@/modules/files/utils/download-filenames";
import { triggerBlobDownload, triggerPresignedDownload } from "@/modules/files/utils/trigger-download";
import {
    fileManagementAPI,
    type FileStatusResponse,
    type ProfilingResponse,
    type CustomRuleDefinition,
    type CustomRuleSuggestionResponse,
} from "@/modules/files";
import { useImportingFilesPoll } from "@/modules/files/hooks/use-importing-files-poll";
import { useOptimizingFilesPoll } from "@/modules/files/hooks/use-optimizing-files-poll";
import {
    STATUS_OPTIONS,
} from "@/modules/files/page/constants";
import {
    getDqQuality,
} from "@/modules/files/page/utils";

export function useFilesPage() {
    const dispatch = useAppDispatch();
    const files = useAppSelector(selectFiles);
    const filesStatus = useAppSelector(selectFilesStatus);
    const filesError = useAppSelector(selectFilesError);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // W5A-2 — start true so the very first mount paints skeleton rows
    // (instead of the empty-state card) before fetchFiles even dispatches.
    // Once Redux flips out of "idle"/"loading" we mirror its value.
    const [loading, setLoading] = useState(true);
    const [isManualRefresh, setIsManualRefresh] = useState(false);

    // Post-upload prompt state
    const [recentlyUploaded, setRecentlyUploaded] = useState<FileStatusResponse | null>(null);

    // Track previous file statuses for processing completion toast
    const prevStatusesRef = useRef<Map<string, string>>(new Map());

    // Ref to latest files for polling callbacks
    const filesRef = useRef(files);
    useEffect(() => { filesRef.current = files; }, [files]);

    useEffect(() => {
        // W5A-2 — keep loading=true while idle (pre-fetch) and loading. Only
        // flip to false once the fetch has actually completed (succeeded or
        // failed). This keeps the skeleton rows visible across the entire
        // "perceived load" window Sarah complained about.
        setLoading(filesStatus === "loading" || filesStatus === "idle");
    }, [filesStatus]);

    // ─── Files-list load error toast (States 4 + 5) ──────────────────
    // React to Redux "failed" status and surface the appropriate toast.
    // 401 → session-expired + Sign In; 5xx / network → retry prompt.
    // A stable ref prevents re-showing the same toast on unrelated re-renders.
    const shownListErrorRef = useRef<string | null>(null);
    useEffect(() => {
        if (filesStatus !== "failed" || !filesError) return;
        const key = `${filesError.status ?? "net"}-${filesError.message}`;
        if (shownListErrorRef.current === key) return;
        shownListErrorRef.current = key;

        // Build a typed ApiError so mapQuarantineErrorToToast can route
        // 401 (session expired + Sign In) vs 5xx (server error + Retry).
        const apiErr = new ApiError({
            status: filesError.status ?? 500,
            message: filesError.message,
            action: filesError.status === 401 ? "signin" : "retry",
        });

        const retryFn = () => {
            shownListErrorRef.current = null;
            loadFiles(true);
        };

        if (filesError.status === 401) {
            toast(toastFromQuarantineError(apiErr, { action: "load your files" }));
        } else {
            toast(toastFromQuarantineError(apiErr, {
                action: "load your files",
                retryFn,
            }));
        }
    }, [filesStatus, filesError]); // eslint-disable-line react-hooks/exhaustive-deps

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [renameError, setRenameError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<FileStatusResponse | null>(null);
    // ─── Stop (cancel in-flight import / processing) ─────────────────────
    // Functionally distinct from delete: hits POST /uploads/{id}/cancel and
    // transitions the row to IMPORT_FAILED / DQ_FAILED instead of removing it.
    const [stopping, setStopping] = useState<string | null>(null);
    const [showStopModal, setShowStopModal] = useState(false);
    const [fileToStop, setFileToStop] = useState<FileStatusResponse | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [downloadModalFile, setDownloadModalFile] = useState<FileStatusResponse | null>(null);
    const [erpModalConfig, setErpModalConfig] = useState<{
        file: FileStatusResponse;
        format: "csv" | "excel" | "json";
    } | null>(null);
    const [showErpModal, setShowErpModal] = useState(false);
    const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [detailsOpen, setDetailsOpenState] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileStatusResponse | null>(null);

    // URL-synced helpers so browser back/forward restores the dialog.
    // Opening: push a history entry (?detail=<uploadId>) so Forward can replay it.
    // Closing: replace (no new entry) so closing doesn't pollute the back stack.
    const openDetailsWithUrl = useCallback((file: FileStatusResponse) => {
        setSelectedFile(file);
        setDetailsOpenState(true);
        const next = new URLSearchParams(searchParams.toString());
        next.set("detail", file.upload_id);
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    const setDetailsOpen = useCallback((open: boolean) => {
        setDetailsOpenState(open);
        if (!open) {
            const next = new URLSearchParams(searchParams.toString());
            next.delete("detail");
            const qs = next.toString();
            // Use push (not replace) so closing the dialog creates a history entry.
            // This means: open → [/files, /files?detail=X], close → [/files, /files?detail=X, /files]
            // Browser Back → /files?detail=X → useEffect restores dialog.
            // Browser Forward → /files → useEffect closes dialog. (Bug 15 fix)
            router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }
    }, [searchParams, router, pathname]);
    const [showPushToErpModal, setShowPushToErpModal] = useState(false);
    const [pushToErpFile, setPushToErpFile] = useState<FileStatusResponse | null>(null);

    // Wizard state
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardFile, setWizardFile] = useState<FileStatusResponse | null>(null);

    // Profiling state
    const [profilingFileId, setProfilingFileId] = useState<string | null>(null);
    const [profilingData, setProfilingData] = useState<ProfilingResponse | null>(null);
    const [loadingProfiling, setLoadingProfiling] = useState(false);
    const [pushQBModalOpen, setPushQBModalOpen] = useState(false);
    const [fileToPush, setFileToPush] = useState<FileStatusResponse | null>(null);
    const [activeSection, setActiveSection] = useState<"upload" | "explorer">("explorer");
    // New import wizard state
    const [newImportWizardOpen, setNewImportWizardOpen] = useState(false);
    const [selectedSource, setSelectedSource] = useState("local");
    const [selectedDestination, setSelectedDestination] = useState("null");
    const [lastActiveSelector, setLastActiveSelector] = useState<'source' | 'destination'>('source');
    const [selectedErp, setSelectedErp] = useState("quickbooks");

    // Quarantine editor state
    const [quarantineEditorOpen, setQuarantineEditorOpen] = useState(false);
    const [quarantineEditorFile, setQuarantineEditorFile] = useState<FileStatusResponse | null>(null);

    const updateUploadProgress = useCallback((value: number) => {
        const clamped = Math.min(100, Math.max(0, value));
        setUploadProgress(Number(clamped.toFixed(2)));
    }, []);

    const [selectedDestinationErp, setSelectedDestinationErp] = useState("quickbooks");
    const [sortField, setSortField] = useState<
        "name" | "score" | "status" | "uploaded" | "updated"
    >("uploaded");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [columnModalOpen, setColumnModalOpen] = useState(false);
    const [columnModalFile, setColumnModalFile] = useState<FileStatusResponse | null>(null);
    const [availableColumns, setAvailableColumns] = useState<string[]>([]);
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
    const [columnsLoading, setColumnsLoading] = useState(false);
    const [columnsError, setColumnsError] = useState<string | null>(null);
    const [selectionFileError, setSelectionFileError] = useState<string | null>(null);
    const [displayColumnModalOpen, setDisplayColumnModalOpen] = useState(false);
    const [useCustomRules, setUseCustomRules] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
        new Set([
            "file", "score", "rows",
            "status", "uploaded", "updated", "processingTime", "actions",
        ]),
    );
    const [selectedDestinationFormat, setSelectedDestinationFormat] = useState<string | null>(null);
    const [pendingVisibleColumns, setPendingVisibleColumns] = useState<Set<string>>(
        new Set([
            "file", "score", "rows",
            "status", "uploaded", "updated", "processingTime", "actions",
        ]),
    );
    const [confirmColumnsOpen, setConfirmColumnsOpen] = useState(false);
    const [confirmColumns, setConfirmColumns] = useState<string[]>([]);
    const [confirmAllColumns, setConfirmAllColumns] = useState(false);
    const [selectionProfilingData, setSelectionProfilingData] = useState<ProfilingResponse | null>(null);
    const [selectionProfilingLoading, setSelectionProfilingLoading] = useState(false);
    const [selectionProfilingError, setSelectionProfilingError] = useState<string | null>(null);
    const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
    const [rulesConfirmed, setRulesConfirmed] = useState(false);
    const [globalDisabledRules, setGlobalDisabledRules] = useState<string[]>([]);
    const [requiredColumns, setRequiredColumns] = useState<Set<string>>(new Set());
    const [disableRulesByColumn, setDisableRulesByColumn] = useState<Record<string, string[]>>({});
    const [overrideRulesByColumn, setOverrideRulesByColumn] = useState<Record<string, string[]>>({});
    const [rulesDisableColumn, setRulesDisableColumn] = useState<string>("");
    const [rulesOverrideColumn, setRulesOverrideColumn] = useState<string>("");
    const [customRules, setCustomRules] = useState<CustomRuleDefinition[]>([]);
    const [customRuleColumn, setCustomRuleColumn] = useState<string>("");
    const [customRulePrompt, setCustomRulePrompt] = useState<string>("");
    const [customRuleSuggestion, setCustomRuleSuggestion] = useState<CustomRuleSuggestionResponse | null>(null);
    const [customRuleSuggesting, setCustomRuleSuggesting] = useState(false);
    const [customRuleSuggestError, setCustomRuleSuggestError] = useState<string | null>(null);

    // Column Export state
    const [showColumnExportModal, setShowColumnExportModal] = useState(false);
    const [columnExportFile, setColumnExportFile] = useState<FileStatusResponse | null>(null);
    const [columnExportColumns, setColumnExportColumns] = useState<string[]>([]);
    const [columnExportLoading, setColumnExportLoading] = useState(false);
    const [actionsDialogOpen, setActionsDialogOpen] = useState(false);
    const [actionsDialogFile, setActionsDialogFile] = useState<FileStatusResponse | null>(null);
    const [actionsErpMode, setActionsErpMode] = useState<"original" | "transform">("original");
    const [actionsErpTarget, setActionsErpTarget] = useState<string>("Oracle Fusion");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectionFileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { idToken, hasPermission, permissionsLoaded, permissionsError, refreshPermissions } = useAuth();
    const canUseFilesActions = hasPermission("files");

    // ─── Permission helpers ───────────────────────────────────────────
    const showFilesPermissionDenied = useCallback(() => {
        toast({
            title: "Permission denied",
            description: "You do not have permission for this action. Contact your organization admin.",
            variant: "destructive",
        });
    }, [toast]);

    // P0-1 fix (2026-05-19): /org/me may not have resolved (or may have failed
    // silently — see auth-provider catch block) when a user clicks an action.
    // `hasPermission()` returns false in BOTH cases (empty permissions map),
    // which previously caused a destructive "Permission denied" toast even for
    // Super Admins (the "headline workflow broken on click #1" finding). We
    // now distinguish three cases:
    //   - !permissionsLoaded            → friendly "Loading..." info toast + nudge refresh
    //   - permissionsError              → friendly "Re-checking..." info toast + force refresh
    //   - loaded && !canPerformAction   → legitimate deny toast (destructive, unchanged)
    // This guard wraps ALL action buttons in /files: Import, Upload,
    // Push-to-ERP, Delete, Stop, Wizard, etc — 17+ call sites.
    const ensureFilesPermission = useCallback(() => {
        if (!permissionsLoaded) {
            toast({
                title: "Loading your permissions",
                description: "Please try again in a moment.",
            });
            try { void refreshPermissions(); } catch { /* no-op */ }
            return false;
        }
        if (permissionsError) {
            toast({
                title: "Re-checking your permissions",
                description: "We could not verify your permissions a moment ago. Retrying — please try again in a moment.",
            });
            try { void refreshPermissions(); } catch { /* no-op */ }
            return false;
        }
        if (hasPermission("files")) return true;
        showFilesPermissionDenied();
        return false;
    }, [permissionsLoaded, permissionsError, hasPermission, showFilesPermissionDenied, refreshPermissions, toast]);

    const renderRestrictedFilesPanel = useCallback(
        (content: React.ReactNode) => {
            // P0-1 race fix (2026-05-19): show content optimistically during the
            // permissions-loading window (or after a /org/me failure) so a
            // Super Admin doesn't see a locked overlay flash. The overlay-click
            // handler routes through ensureFilesPermission, which correctly
            // shows the friendly loading/retry toast in those cases and only
            // surfaces the destructive deny toast for genuinely-denied users.
            if (!permissionsLoaded || permissionsError) return content;
            if (canUseFilesActions) return content;
            return (
                <div className="relative">
                    <div className="pointer-events-none select-none opacity-80 grayscale">
                        {content}
                    </div>
                    <button
                        type="button"
                        aria-label="Permission restricted"
                        className="absolute inset-0 z-10 cursor-not-allowed"
                        onClick={showFilesPermissionDenied}
                    />
                </div>
            );
        },
        [permissionsLoaded, permissionsError, canUseFilesActions, showFilesPermissionDenied],
    );

    // ─── Data loading ─────────────────────────────────────────────────
    const loadFiles = useCallback(async (userInitiated = false) => {
        if (!idToken) return;
        // P0-1 (2026-05-19): when permissionsError is set, the permissions map
        // is empty due to /org/me failure — NOT a real deny. Fall through to
        // fetchFiles (BE is the source of truth) so the user's data still loads
        // when /org/me transiently flaked. ensureFilesPermission still gates
        // mutating actions and will route to the friendly retry toast.
        if (permissionsLoaded && !permissionsError && !hasPermission("files")) {
            dispatch(resetFiles());
            if (userInitiated) {
                ensureFilesPermission();
            }
            return;
        }
        await dispatch(fetchFiles(idToken));
    }, [idToken, permissionsLoaded, permissionsError, hasPermission, dispatch, ensureFilesPermission]);

    useEffect(() => {
        loadFiles(false);
    }, [loadFiles]);

    // Highlighted file (from activity feed click — animates the row)
    const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);

    // ── URL-state hydration: pick up search/sort/status from query on mount ─
    // We persist these on change too (effect below) so a Cmd+R / opening the
    // page in a new tab preserves the filtered view. Hydration runs exactly
    // once per page-mount via a ref guard — otherwise the URL-write effect
    // and this hydration effect would ping-pong.
    const urlStateHydratedRef = useRef(false);
    useEffect(() => {
        if (urlStateHydratedRef.current) return;
        urlStateHydratedRef.current = true;
        const q = searchParams.get("q");
        const sf = searchParams.get("sort");
        const sd = searchParams.get("dir");
        if (q) setSearchQuery(q);
        if (sf === "name" || sf === "score" || sf === "status" || sf === "uploaded" || sf === "updated") {
            setSortField(sf);
        }
        if (sd === "asc" || sd === "desc") setSortDirection(sd);
        // statusFilter is hydrated by the existing effect below
    }, [searchParams]);

    // ── URL-state write-back: keep ?q / ?status / ?sort / ?dir in sync ──
    // Debounced to avoid a router.replace per keystroke. Skipped until the
    // hydration ref has flipped so we don't clobber URL params during the
    // initial mount race. Uses replace() so the browser back-stack stays
    // clean — these are view-state changes, not navigation.
    useEffect(() => {
        if (!urlStateHydratedRef.current) return;
        const timer = setTimeout(() => {
            const next = new URLSearchParams(searchParams.toString());
            if (searchQuery) next.set("q", searchQuery); else next.delete("q");
            if (statusFilter && statusFilter !== "all") next.set("status", statusFilter); else next.delete("status");
            if (sortField && sortField !== "uploaded") next.set("sort", sortField); else next.delete("sort");
            if (sortDirection && sortDirection !== "desc") next.set("dir", sortDirection); else next.delete("dir");
            const qs = next.toString();
            const target = qs ? `${pathname}?${qs}` : pathname;
            // Only replace if URL actually changed — guards against an
            // infinite loop with the hydration effect.
            const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
            if (target !== current) router.replace(target, { scroll: false });
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, statusFilter, sortField, sortDirection, pathname, router, searchParams]);

    // Handle query params from Dashboard → Catalog navigation
    const consumedFileParamRef = useRef(false);
    useEffect(() => {
        const tab = searchParams.get("tab");
        const status = searchParams.get("status");
        const fileId = searchParams.get("file");
        const highlightId = searchParams.get("highlight");

        if (!tab && !status && !fileId && !highlightId) return;

        if (tab === "explorer") setActiveSection("explorer");
        if (status) setStatusFilter(status);

        // Highlight a file row (from activity feed) — scroll to it, animate it
        if (highlightId && files.length > 0) {
            setActiveSection("explorer");
            setHighlightedFileId(highlightId);
            // Auto-clear highlight after animation
            setTimeout(() => setHighlightedFileId(null), 3000);
            // Scroll to the row after a short delay for render
            setTimeout(() => {
                const row = document.querySelector(`[data-file-id="${highlightId}"]`);
                if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 200);
        }

        // Auto-open file details when linked from Dashboard/Jobs
        if (fileId && files.length > 0) {
            const target = files.find((f) => f.upload_id === fileId);
            if (target) {
                setActiveSection("explorer");
                openDetailsWithUrl(target);
            }
        }

        // Clear consumed params
        if ((fileId || highlightId) && !consumedFileParamRef.current) {
            consumedFileParamRef.current = true;
            const kept = new URLSearchParams();
            if (tab) kept.set("tab", tab);
            if (status) kept.set("status", status);
            const qs = kept.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }
    }, [searchParams, files, router, pathname, openDetailsWithUrl]);

    // Restore file-details dialog from URL ?detail=<uploadId> (browser back/forward).
    // Runs whenever searchParams or files change. If ?detail is present and the file
    // exists in the local store, open the dialog without pushing a new history entry
    // (the URL already carries the state).
    useEffect(() => {
        const detailId = searchParams.get("detail");
        if (!detailId || files.length === 0) return;
        const target = files.find((f) => f.upload_id === detailId);
        if (!target) return;
        // Only open if the dialog isn't already showing this file (avoids re-render loop).
        setSelectedFile((prev) => {
            if (prev?.upload_id !== target.upload_id) return target;
            return prev;
        });
        setDetailsOpenState(true);
    }, [searchParams, files]);

    // Processing completion toast — detect status transitions
    useEffect(() => {
        for (const file of files) {
            const prev = prevStatusesRef.current.get(file.upload_id);
            if (prev && prev !== file.status) {
                if (file.status === "DQ_FIXED") {
                    toast({
                        title: "Processing Complete",
                        description: `${file.original_filename || file.filename} — DQ Score: ${file.dq_score?.toFixed(1) ?? "N/A"}%`,
                    });
                } else if (file.status === "DQ_FAILED") {
                    toast({
                        title: "Processing Failed",
                        description: `${file.original_filename || file.filename} encountered errors`,
                        variant: "destructive",
                    });
                }
            }
            prevStatusesRef.current.set(file.upload_id, file.status);
        }
    }, [files, toast]);

    const handleManualRefresh = useCallback(async () => {
        setIsManualRefresh(true);
        const startedAt = Date.now();
        try {
            await loadFiles(true);
            const elapsed = Date.now() - startedAt;
            const minSpinDurationMs = 450;
            if (elapsed < minSpinDurationMs) {
                await new Promise((resolve) =>
                    setTimeout(resolve, minSpinDurationMs - elapsed),
                );
            }
        } finally {
            setIsManualRefresh(false);
        }
    }, [loadFiles]);

    // ─── Filtering & sorting ─────────────────────────────────────────
    const filteredFiles = useMemo(() => files
        .filter((file) => !file.parent_upload_id) // Hide versioned files - accessible via Versions tab
        .filter((file) => {
            const name = (file.original_filename || file.filename || "").toLowerCase();
            const matchesSearch = name.includes(searchQuery.toLowerCase());
            const filterOption = STATUS_OPTIONS.find((opt) => opt.value === statusFilter);
            if (!filterOption || filterOption.value === "all") return matchesSearch;
            if (filterOption.type === "attention") {
                // "Needs Attention" = failed files + files with quarantined rows
                const isFailed = ["DQ_FAILED", "UPLOAD_FAILED", "FAILED", "REJECTED"].includes(file.status);
                const hasQuarantined = file.status === "DQ_FIXED" && (file.rows_quarantined ?? 0) > 0;
                return matchesSearch && (isFailed || hasQuarantined);
            }
            if (filterOption.type === "status") return matchesSearch && file.status === statusFilter;
            if (filterOption.type === "quality") {
                const fileQuality = getDqQuality(file.dq_score);
                return matchesSearch && fileQuality === statusFilter;
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case "name":
                    const nameA = (a.original_filename || a.filename || "").toLowerCase();
                    const nameB = (b.original_filename || b.filename || "").toLowerCase();
                    comparison = nameA.localeCompare(nameB);
                    break;
                case "score":
                    const scoreA = a.dq_score ?? -1;
                    const scoreB = b.dq_score ?? -1;
                    comparison = scoreA - scoreB;
                    break;
                case "status":
                    comparison = (a.status || "").localeCompare(b.status || "");
                    break;
                case "uploaded":
                    const uploadedA = new Date(a.uploaded_at || a.created_at || 0).getTime();
                    const uploadedB = new Date(b.uploaded_at || b.created_at || 0).getTime();
                    comparison = uploadedA - uploadedB;
                    break;
                case "updated":
                    const updatedA = new Date(a.updated_at || a.status_timestamp || 0).getTime();
                    const updatedB = new Date(b.updated_at || b.status_timestamp || 0).getTime();
                    comparison = updatedA - updatedB;
                    break;
            }
            return sortDirection === "asc" ? comparison : -comparison;
        }), [files, searchQuery, statusFilter, sortField, sortDirection]);

    const handleSort = (field: "name" | "score" | "status" | "uploaded" | "updated") => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    // ─── File upload ──────────────────────────────────────────────────
    // Normalise a filename for collision comparison: lowercase, collapse spaces,
    // strip spaces adjacent to dots, collapse consecutive dots
    const normalizeFilename = (name: string) =>
        name.toLowerCase()
            .replace(/\s+/g, " ")      // collapse whitespace runs to single space
            .replace(/\s*\.\s*/g, ".") // remove spaces around every dot
            .replace(/\.{2,}/g, ".")   // "file..csv" → "file.csv"
            .trim();

    const suggestFilename = (name: string, existingFiles: typeof files): string => {
        const dotIndex = name.lastIndexOf(".");
        const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
        const ext = dotIndex !== -1 ? name.slice(dotIndex) : "";
        // Strip any existing " (n)" suffix from base
        const cleanBase = base.replace(/ \(\d+\)$/, "");
        let counter = 2;
        while (true) {
            const candidate = `${cleanBase} (${counter})${ext}`;
            const taken = existingFiles.some(
                (f) => normalizeFilename(f.original_filename || f.filename || "") === normalizeFilename(candidate)
            );
            if (!taken) return candidate;
            counter++;
        }
    };

    const doUpload = async (file: File) => {
        if (!idToken) {
            toast({
                title: "Session expired",
                description: "Sign in again to continue.",
                variant: "destructive",
            });
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            await fileManagementAPI.uploadFileComplete(
                file, idToken, useAI,
                (progress) => updateUploadProgress(progress),
                (status) => { dispatch(updateFile(status)); },
                false,
            );
            toast({ title: "Upload Complete", description: "File uploaded successfully." });
            // Refresh the list and read the refreshed items directly from the
            // thunk result so we don't search the stale closure `files` (which
            // is captured at upload-time and never sees the just-uploaded row).
            // Previously this branch dispatched fetchFiles twice and never
            // surfaced the post-upload prompt — fixed in fe/files audit (CC4).
            setActiveSection("explorer");
            try {
                const action: any = await dispatch(fetchFiles(idToken));
                const refreshedItems: FileStatusResponse[] = Array.isArray(action?.payload)
                    ? action.payload
                    : (filesRef.current ?? files);
                const target = refreshedItems.find((f) =>
                    (f.original_filename || f.filename || "").toLowerCase() ===
                    file.name.toLowerCase()
                );
                if (target) {
                    setRecentlyUploaded(target);
                    setTimeout(() => setRecentlyUploaded(null), 15000);
                }
            } catch {
                // Refresh failure here is non-fatal — the upload itself
                // succeeded and the polling loops will pick up the row.
            }
        } catch (error) {
            console.error("Upload failed:", error);
            // Prefer the typed ApiError mapping for actionable copy
            // (Reconnect / Sign in / 422-validation / 500-server-error).
            // Permission-denied keeps its custom message for org-admin context.
            const message = error instanceof Error ? error.message.toLowerCase() : "";
            if (message.includes("permission denied")) {
                toast({
                    title: "Permission denied",
                    description:
                        "You do not have permission for this action. Contact your organization admin.",
                    variant: "destructive",
                });
            } else if (error instanceof ApiError) {
                toast(toastFromError(error));
            } else {
                toast({
                    title: "Upload failed",
                    description: "Please try again",
                    variant: "destructive",
                });
            }
        } finally {
            setUploading(false);
            updateUploadProgress(0);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!ensureFilesPermission()) return;
        if (!idToken) {
            toast({
                title: "Session expired",
                description: "Sign in again to continue.",
                variant: "destructive",
            });
            return;
        }
        const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
        const validExtensions = [".csv", ".xlsx", ".xls", ".json"];
        if (!validExtensions.includes(extension)) {
            toast({ title: "Invalid file", description: "Please upload a CSV, Excel, or JSON file", variant: "destructive" });
            return;
        }
        // Check for filename collision (normalised to catch "file .csv" == "file.csv")
        const collision = files.find(
            (f) => normalizeFilename(f.original_filename || f.filename || "") === normalizeFilename(file.name)
        );
        if (collision) {
            setPendingUploadFile(file);
            const suggested = suggestFilename(file.name, files);
            // Store only the base name (no extension) — ext shown as static label in dialog
            const suggestedBase = suggested.lastIndexOf(".") !== -1
                ? suggested.slice(0, suggested.lastIndexOf("."))
                : suggested;
            setRenameValue(suggestedBase);
            setShowRenameDialog(true);
            return;
        }
        await doUpload(file);
    };

    const handleRenameConfirm = async () => {
        if (!pendingUploadFile) return;
        // Base name only — strip ALL dots (user cannot change extension)
        const baseName = renameValue.trim().replace(/\s+/g, " ").replace(/\./g, "");
        if (!baseName) return;
        // Re-attach the original extension
        const origExt = pendingUploadFile.name.lastIndexOf(".") !== -1
            ? pendingUploadFile.name.slice(pendingUploadFile.name.lastIndexOf("."))
            : "";
        const newName = baseName + origExt;
        // Collision check
        const collision = files.find(
            (f) => normalizeFilename(f.original_filename || f.filename || "") === normalizeFilename(newName)
        );
        if (collision) {
            setRenameError(`"${newName}" already exists. Please choose a different name.`);
            return;
        }
        setRenameError(null);
        const renamed = new File([pendingUploadFile], newName, { type: pendingUploadFile.type });
        setShowRenameDialog(false);
        setPendingUploadFile(null);
        await doUpload(renamed);
    };


    const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) handleFileUpload(file);
    };

    const handleDrag = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.type === "dragenter" || event.type === "dragover") {
            setDragActive(true);
        } else if (event.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);
        const file = event.dataTransfer.files?.[0];
        if (file) handleFileUpload(file);
    };

    // ─── Details / processing / profiling ─────────────────────────────
    const handleViewDetails = useCallback(async (file: FileStatusResponse) => {
        // State 6: guard against clicking a stale row (file deleted in another
        // tab). Verify the file still exists before opening the detail panel;
        // on 404, remove it from the store and show a toast with a Refresh button.
        if (idToken) {
            try {
                await fileManagementAPI.getFileStatus(file.upload_id, idToken);
            } catch (err: any) {
                const isNotFound =
                    err?.status === 404 ||
                    (err?.message || "").toLowerCase().includes("not found");
                if (isNotFound) {
                    dispatch(removeFile(file.upload_id));
                    toast({
                        title: "This file was deleted.",
                        description: "It may have been removed in another session.",
                        variant: "destructive",
                        action: (
                            <_ToastAction altText="Refresh List" onClick={() => loadFiles(true)}>
                                Refresh List
                            </_ToastAction>
                        ) as any,
                    });
                    return;
                }
                // Non-404 errors: surface the failure (401 → Sign In, 5xx →
                // Retry) instead of silently opening with stale cached data.
                // Previously this branch fell through and the user saw a
                // detail panel that looked fine but had outdated rows /
                // missing DQ score. Toast routes via the standard matrix.
                if (err instanceof ApiError && err.status === 401) {
                    toast(toastFromQuarantineError(err, { action: "view file details" }));
                    return;
                }
                if (err instanceof ApiError && err.status >= 500) {
                    toast(
                        toastFromQuarantineError(err, {
                            action: "view file details",
                            retryFn: () => handleViewDetails(file),
                        }),
                    );
                    return;
                }
                // Network / unknown errors: fall through and open with
                // cached data, but surface a non-blocking warning so the
                // user knows the panel may be stale.
                console.warn("getFileStatus pre-check failed; opening with cached data", err);
            }
        }
        // W5B-3: navigate to the dedicated /files/{uploadId} page route.
        // The legacy `openDetailsWithUrl(file)` modal path remains alive
        // (FilesPageDialogs still renders <FileDetailsDialog>) but the row
        // click no longer triggers it. Deep-linkable, refresh-stable URLs.
        router.push(`/files/${file.upload_id}`);
    }, [idToken, dispatch, toast, loadFiles, router]);

    const handleOpenQuarantineEditor = (file: FileStatusResponse) => {
        if (!ensureFilesPermission()) return;

        // Validate quarantine editor availability
        const quarantinedRows = Number(file.rows_quarantined || 0);
        const status = file.status;
        const canOpen = quarantinedRows > 0 && (status === "DQ_FIXED" || status === "COMPLETED");

        if (!canOpen) {
            toast({
                title: "Quarantine editor unavailable",
                description: "Run DQ and ensure quarantined rows are present before remediation.",
                variant: "destructive",
            });
            return;
        }

        router.push(`/files/${file.upload_id}/quarantine`);
    };

    const reprocessPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const handleReprocessSubmitted = useCallback((result: any) => {
        const activeFile = quarantineEditorFile;
        if (activeFile) {
            const optimisticFile: FileStatusResponse = {
                ...activeFile,
                status: "QUEUED",
                remediation_state: "REPROCESS_SUBMITTED",
                updated_at: new Date().toISOString(),
            };

            dispatch(updateFile(optimisticFile));
            filesRef.current = (filesRef.current ?? []).map((file) =>
                file.upload_id === optimisticFile.upload_id ? optimisticFile : file
            );
            setSelectedFile((prev) =>
                prev?.upload_id === optimisticFile.upload_id
                    ? { ...prev, ...optimisticFile }
                    : prev
            );
            setQuarantineEditorFile(optimisticFile);
        }

        // Immediately refresh to pick up remediation_state=REPROCESS_SUBMITTED
        loadFiles();

        // Poll until both the reprocess AND the new DQ processing complete.
        // The reprocess worker creates a new version that goes through
        // DQ_DISPATCHED → DQ_RUNNING → DQ_FIXED. We need to keep polling
        // until no file is in any active/transitional state.
        if (reprocessPollRef.current) clearInterval(reprocessPollRef.current);
        let pollCount = 0;
        const maxPolls = 120; // 30 minutes max
        const ACTIVE_STATES = new Set([
            "DQ_DISPATCHED", "DQ_RUNNING", "QUEUED", "PROCESSING",
            "REPROCESS_SUBMITTED", "REPROCESSING",
        ]);
        reprocessPollRef.current = setInterval(async () => {
            pollCount++;
            await loadFiles();
            const currentFiles = filesRef.current ?? [];
            const stillActive = currentFiles.some(
                (f: any) =>
                    ACTIVE_STATES.has(f.status) ||
                    f.remediation_state === "REPROCESS_SUBMITTED"
            );
            if (!stillActive || pollCount >= maxPolls) {
                if (reprocessPollRef.current) {
                    clearInterval(reprocessPollRef.current);
                    reprocessPollRef.current = null;
                }
                if (pollCount >= maxPolls && stillActive) {
                    // 30-min ceiling hit while at least one file is still
                    // active. Previously this branch silently stopped the
                    // poll and the user had no indication that we'd given
                    // up. Surface a non-blocking warning + manual-refresh
                    // affordance so the user can re-check the status.
                    toast({
                        title: "Reprocess is taking longer than expected",
                        description:
                            "We stopped auto-polling after 30 minutes. Use Refresh to check the latest status.",
                        variant: "destructive",
                        action: (
                            <_ToastAction altText="Refresh" onClick={() => loadFiles(true)}>
                                Refresh
                            </_ToastAction>
                        ) as any,
                    });
                }
            }
        }, 5000); // poll every 5s for snappier UX
    }, [dispatch, loadFiles, quarantineEditorFile]);

    // Clean up reprocess polling on unmount
    useEffect(() => {
        return () => {
            if (reprocessPollRef.current) clearInterval(reprocessPollRef.current);
        };
    }, []);

    // Background polling for in-flight connector imports (Google Drive, …).
    // Refreshes the file list every 2 s while ≥ 1 row is IMPORTING so the
    // inline progress bar in the data-catalog row stays live even when the
    // Import Data dialog has been closed (or the page was just reloaded
    // mid-import). No-op once all imports terminate.
    // While the user-initiated Stop & Delete chain is mid-flight we pause the
    // 2-second IMPORTING refresh so a stale list response doesn't clobber the
    // optimistic local state between the cancel and delete API calls.
    useImportingFilesPoll({ files, onRefresh: loadFiles, isPaused: stopping !== null });

    // Phase 7B (logical sharding): while ≥ 1 file is OPTIMIZING, refresh the
    // catalog list every 5 s so the badge transitions out promptly when the
    // optimizer Lambda finishes (→ UPLOADED / VALIDATED / OPTIMIZE_FAILED).
    // Same pause semantics as the IMPORTING poller — suspend during a
    // user-initiated stop+delete to avoid clobbering optimistic state.
    useOptimizingFilesPoll({ files, onRefresh: loadFiles, isPaused: stopping !== null });

    const handleQuarantineEditorComplete = () => {
        // Reload files to reflect new version
        loadFiles();
    };

    const handlePushToQuickBooks = (file: FileStatusResponse) => {
        if (!ensureFilesPermission()) return;
        setFileToPush(file);
        setPushQBModalOpen(true);
    };

    const handleQuickBooksImportComplete = async (uploadId: string) => {
        loadFiles();
        toast({ title: "Import Complete", description: "File imported successfully. Click the play button to start processing." });
    };

    const doStartProcessing = async (file: FileStatusResponse, cols?: string[]) => {
        if (!idToken) return;
        if (!ensureFilesPermission()) return;
        try {
            await fileManagementAPI.startProcessing(file.upload_id, idToken, {
                selected_columns: cols,
                required_columns: Array.from(requiredColumns),
                global_disabled_rules: globalDisabledRules,
                disable_rules: disableRulesByColumn,
                column_rules_override: overrideRulesByColumn,
                custom_rules: customRules,
            });
            toast({
                title: "Processing Started",
                description: `Starting data quality processing for ${file.original_filename || file.filename}...`,
            });
            loadFiles();
        } catch (error: any) {
            console.error("Processing failed:", error);
            const msg = (error?.message || "").toLowerCase();
            if (msg.includes("already being processed")) {
                toast({
                    title: "Already Processing",
                    description: `${file.original_filename || file.filename} is already in progress.`,
                });
                loadFiles();
                return;
            }
            toast({ title: "Processing Failed", description: "Failed to start data quality processing", variant: "destructive" });
        }
    };

    const handleStartProcessing = async (file: FileStatusResponse) => {
        if (!idToken) return;
        if (!ensureFilesPermission()) return;
        setWizardFile(file);
        setWizardOpen(true);
    };

    /** Quick Process: one-click with default settings (skips wizard) */
    const handleQuickProcess = async (file: FileStatusResponse) => {
        if (!idToken) return;
        if (!ensureFilesPermission()) return;
        try {
            await fileManagementAPI.startProcessing(file.upload_id, idToken);
            toast({
                title: "Processing Started",
                description: `${file.original_filename || file.filename} is being processed with default settings.`,
            });
            setRecentlyUploaded(null);
            loadFiles();
        } catch (error: any) {
            console.error("Quick processing failed:", error);
            const msg = (error?.message || "").toLowerCase();
            if (msg.includes("already being processed")) {
                toast({
                    title: "Already Processing",
                    description: `${file.original_filename || file.filename} is already in progress.`,
                });
                loadFiles();
                return;
            }
            toast({ title: "Processing Failed", description: "Failed to start processing. Try using Configure for more options.", variant: "destructive" });
        }
    };

    const handleWizardOpenChange = (open: boolean) => {
        setWizardOpen(open);
        if (!open) setWizardFile(null);
    };

    const handleWizardComplete = () => {
        loadFiles();
        setWizardOpen(false);
        setWizardFile(null);
    };

    const handleNewImportOpen = useCallback(() => {
        if (!ensureFilesPermission()) return;
        setNewImportWizardOpen(true);
    }, [ensureFilesPermission]);

    const handleNewImportClose = useCallback((reload?: boolean) => {
        setNewImportWizardOpen(false);
        if (reload) loadFiles();
    }, [loadFiles]);

    // ─── Column selection ─────────────────────────────────────────────
    const handleColumnConfirm = async () => {
        if (!columnModalFile || !idToken) return;
        const cols = availableColumns.length === 0
            ? undefined
            : Array.from(selectedColumns.values());
        if (availableColumns.length > 0 && (!cols || cols.length === 0)) {
            toast({ title: "Select at least one column", description: "Choose the columns to process or cancel.", variant: "destructive" });
            return;
        }
        setConfirmColumns(cols ?? []);
        setConfirmAllColumns(!cols || cols.length === 0);
        setConfirmColumnsOpen(true);
        setColumnModalOpen(false);
    };

    const handleColumnCancel = () => {
        setColumnModalOpen(false);
        setColumnModalFile(null);
        setSelectedColumns(new Set());
        setAvailableColumns([]);
        setColumnsError(null);
        setSelectionFileError(null);
        setSelectionProfilingData(null);
        setSelectionProfilingError(null);
        setSelectionProfilingLoading(false);
    };

    const handleOpenRulesDialog = () => setRulesDialogOpen(true);
    const handleCloseRulesDialog = () => setRulesDialogOpen(false);
    const handleConfirmRulesDialog = () => {
        setRulesConfirmed(true);
        setRulesDialogOpen(false);
    };

    // ─── Custom rules ─────────────────────────────────────────────────
    const handleGenerateCustomRule = async () => {
        if (!columnModalFile || !idToken) return;
        if (!customRuleColumn) {
            toast({ title: "Select a column", description: "Choose the column to apply the custom check.", variant: "destructive" });
            return;
        }
        if (!customRulePrompt.trim()) {
            toast({ title: "Enter a prompt", description: "Describe the validation rule you want to create.", variant: "destructive" });
            return;
        }
        setCustomRuleSuggesting(true);
        setCustomRuleSuggestError(null);
        try {
            const response = await fileManagementAPI.suggestCustomRule(
                columnModalFile.upload_id, idToken,
                { column: customRuleColumn, prompt: customRulePrompt.trim() },
            );
            setCustomRuleSuggestion(response);
            if (response.error) setCustomRuleSuggestError(response.error);
        } catch (error) {
            console.error("Custom rule suggestion failed:", error);
            setCustomRuleSuggestError("Failed to generate rule suggestion.");
        } finally {
            setCustomRuleSuggesting(false);
        }
    };

    const handleApproveCustomRule = () => {
        const suggestion = customRuleSuggestion?.suggestion;
        if (!suggestion || customRuleSuggestion?.executable === false) return;
        const ruleId =
            suggestion.rule_id?.toUpperCase() ||
            `CUST_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
        const nextRule: CustomRuleDefinition = {
            ...suggestion,
            rule_id: ruleId,
            column: customRuleColumn,
        };
        setCustomRules((prev) => [...prev, nextRule]);
        setCustomRuleSuggestion(null);
        setCustomRulePrompt("");
    };

    const handleRemoveCustomRule = (ruleId?: string) => {
        if (!ruleId) return;
        setCustomRules((prev) => prev.filter((rule) => rule.rule_id !== ruleId));
    };

    // ─── Rule toggles ────────────────────────────────────────────────
    const toggleRuleInList = (rules: string[], ruleId: string, checked: boolean) => {
        const normalized = ruleId.toUpperCase();
        if (checked) return rules.includes(normalized) ? rules : [...rules, normalized];
        return rules.filter((r) => r !== normalized);
    };

    const getSuggestedRules = (column: string) => {
        const profile = selectionProfilingData?.profiles?.[column];
        if (!profile?.rules) return [];
        return profile.rules.map((r) => r.rule_id.toUpperCase());
    };

    const handleToggleGlobalRule = (ruleId: string, checked: boolean) => {
        setGlobalDisabledRules((prev) => toggleRuleInList(prev, ruleId, checked));
    };

    const handleToggleRequiredColumn = (col: string, checked: boolean) => {
        setRequiredColumns((prev) => {
            const next = new Set(prev);
            if (checked) next.add(col); else next.delete(col);
            return next;
        });
    };

    const handleSelectDisableColumn = (col: string) => {
        setRulesDisableColumn(col);
        if (!disableRulesByColumn[col]) {
            setDisableRulesByColumn((prev) => ({ ...prev, [col]: [] }));
        }
    };

    const handleSelectOverrideColumn = (col: string) => {
        setRulesOverrideColumn(col);
        if (!overrideRulesByColumn[col]) {
            const suggested = getSuggestedRules(col);
            setOverrideRulesByColumn((prev) => ({ ...prev, [col]: suggested }));
        }
    };

    const handleToggleDisableRule = (col: string, ruleId: string, checked: boolean) => {
        setDisableRulesByColumn((prev) => {
            const current = prev[col] || [];
            return { ...prev, [col]: toggleRuleInList(current, ruleId, checked) };
        });
    };

    const handleToggleOverrideRule = (col: string, ruleId: string, checked: boolean) => {
        setOverrideRulesByColumn((prev) => {
            const current = prev[col] || [];
            return { ...prev, [col]: toggleRuleInList(current, ruleId, checked) };
        });
    };

    const handleToggleColumn = (col: string, checked: boolean) => {
        setSelectedColumns((prev) => {
            const next = new Set(prev);
            if (checked) next.add(col); else next.delete(col);
            return next;
        });
    };

    const handleToggleAllColumns = (checked: boolean) => {
        setSelectedColumns(checked ? new Set(availableColumns) : new Set());
    };

    const handleConfirmColumnsCancel = () => {
        setConfirmColumnsOpen(false);
        setConfirmColumns([]);
        setConfirmAllColumns(false);
        setColumnModalOpen(true);
    };

    const handleConfirmColumnsProceed = async () => {
        if (!columnModalFile || !idToken) return;
        const cols = confirmAllColumns ? undefined : confirmColumns;
        setConfirmColumnsOpen(false);
        await doStartProcessing(columnModalFile, cols);
        setColumnModalFile(null);
        setSelectedColumns(new Set());
        setAvailableColumns([]);
        setSelectionFileError(null);
        setConfirmColumns([]);
        setConfirmAllColumns(false);
    };

    // ─── Selection file helpers ───────────────────────────────────────
    const normalizeColumnName = (name: string) => name.trim();

    const applySelection = (mode: "include" | "exclude", cols: string[]) => {
        if (!availableColumns.length) return;
        const normalizedSet = new Set(cols.map(normalizeColumnName).filter(Boolean));
        let next: Set<string>;
        if (mode === "include") {
            next = new Set(availableColumns.filter((c) => normalizedSet.has(normalizeColumnName(c))));
        } else {
            next = new Set(availableColumns.filter((c) => !normalizedSet.has(normalizeColumnName(c))));
        }
        if (next.size === 0) {
            setSelectionFileError("Selection file resulted in zero columns. Please adjust and try again.");
            return;
        }
        setSelectionFileError(null);
        setSelectedColumns(next);
        toast({
            title: "Selection applied",
            description: `${mode === "include" ? "Included" : "Excluded"} ${next.size} column(s) based on file.`,
        });
    };

    const parseSelectionJson = (
        text: string,
    ): { mode: "include" | "exclude"; columns: string[] } | null => {
        try {
            const obj = JSON.parse(text);
            if (Array.isArray(obj?.columns)) {
                const mode = obj.mode === "exclude" ? "exclude" : "include";
                return { mode, columns: obj.columns.map((c: any) => String(c.name ?? c.column ?? c).trim()) };
            }
            if (Array.isArray(obj)) {
                return { mode: "include", columns: obj.map((c: any) => String(c).trim()) };
            }
        } catch (e) {
            console.error("Failed to parse JSON selection file", e);
        }
        return null;
    };

    const parseSelectionRows = (
        rows: any[][],
    ): { mode: "include" | "exclude"; columns: string[] } | null => {
        if (!rows.length) return null;
        const header = rows[0].map((h: any) => String(h || "").toLowerCase().trim());
        const nameIdx = header.findIndex((h: string) => ["name", "column", "column_name"].includes(h));
        const includeIdx = header.findIndex((h: string) => ["include", "selected", "select"].includes(h));
        if (nameIdx === -1 || includeIdx === -1) return null;
        const truthy = new Set(["true", "1", "yes", "y", "include"]);
        const selected: string[] = [];
        rows.slice(1).forEach((row) => {
            const colName = String(row[nameIdx] ?? "").trim();
            if (!colName) return;
            const includeVal = String(row[includeIdx] ?? "").toLowerCase().trim();
            if (truthy.has(includeVal)) selected.push(colName);
        });
        return { mode: "include", columns: selected };
    };

    const handleSelectionFile = async (file: File) => {
        setSelectionFileError(null);
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        try {
            if (ext === "json") {
                const text = await file.text();
                const parsed = parseSelectionJson(text);
                if (parsed) { applySelection(parsed.mode, parsed.columns); return; }
            } else if (ext === "csv") {
                const text = await file.text();
                const rows = text.split(/\r?\n/).filter((line) => line.trim() !== "").map((line) => line.split(","));
                const parsed = parseSelectionRows(rows);
                if (parsed) { applySelection(parsed.mode, parsed.columns); return; }
            } else if (ext === "xlsx" || ext === "xls") {
                // 5 MB cap — selection files are tiny; reject anything larger to avoid
                // parsing a user-uploaded data file with the CVE-free exceljs parser.
                if (file.size > 5 * 1024 * 1024) {
                    setSelectionFileError("Selection file must be under 5 MB.");
                    return;
                }
                const ExcelJS = await import("exceljs");
                const buffer = await file.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.worksheets[0];
                if (!worksheet) {
                    setSelectionFileError("Could not understand selection file. Use columns with 'name' and 'include'.");
                    return;
                }
                const rows: any[][] = [];
                worksheet.eachRow((row) => {
                    rows.push(row.values as any[]);
                });
                // exceljs rows are 1-indexed (row.values[0] is undefined); strip it
                const normalizedRows = rows.map((r) => (Array.isArray(r) && r[0] === undefined ? r.slice(1) : r));
                const parsed = parseSelectionRows(normalizedRows);
                if (parsed) { applySelection(parsed.mode, parsed.columns); return; }
            }
            setSelectionFileError("Could not understand selection file. Use columns with 'name' and 'include'.");
        } catch (error) {
            console.error("Failed to apply selection file", error);
            setSelectionFileError("Unable to apply selection file. Please check the format and try again.");
        }
    };

    const handleSelectionFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) handleSelectionFile(file);
        if (selectionFileInputRef.current) selectionFileInputRef.current.value = "";
    };

    // ─── Profiling ────────────────────────────────────────────────────
    const handleViewProfiling = async (fileId: string) => {
        setProfilingFileId(fileId);
        setLoadingProfiling(true);
        setProfilingData(null);
        try {
            if (!idToken) return;
            const data = await fileManagementAPI.getColumnProfiling(fileId, idToken);
            setProfilingData(data);
        } catch (error) {
            console.error("Failed to load profiling data:", error);
            toast({ title: "Error", description: "Failed to load column profiling data", variant: "destructive" });
            setProfilingFileId(null);
        } finally {
            setLoadingProfiling(false);
        }
    };

    // ─── Delete ───────────────────────────────────────────────────────
    const handleDeleteClick = (file: FileStatusResponse) => {
        setFileToDelete(file);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!fileToDelete || !idToken) return;
        if (!ensureFilesPermission()) return;
        setDeleting(fileToDelete.upload_id);
        setShowDeleteModal(false);
        try {
            const result = await fileManagementAPI.deleteUpload(fileToDelete.upload_id, idToken);
            // 202 path: poll the operation until terminal before clearing the row.
            if (result?.accepted && result.operation_id) {
                await fileManagementAPI.pollDeleteOperation(result.operation_id, idToken);
            }
            toast({ title: "File deleted", description: "File removed successfully" });
            await loadFiles();
        } catch (error) {
            console.error("Delete error:", error);
            // 409 = backend's in-flight delete guard (Phase 1) or the file was
            // already removed concurrently. Treat both as a soft success — the
            // user's intent (row gone) is satisfied either way; if the row is
            // still there, the polling loop will refresh it and the user can
            // click Stop instead.
            if (error instanceof ApiError && error.status === 409) {
                const msg = (error.message || "").toLowerCase();
                if (msg.includes("in progress") || msg.includes("uploading") || msg.includes("importing") || msg.includes("processing")) {
                    toast({
                        title: "Cannot delete while in progress",
                        description: "Stop the import first, then delete.",
                        variant: "destructive",
                    });
                } else {
                    toast({ title: "Already deleted", description: "The file is no longer in the catalog." });
                    await loadFiles();
                }
            } else {
                // Route through the quarantine error matrix so 401 shows Sign In,
                // 403 shows Contact Support, 500 shows Retry — matching CC3's spec.
                toast(toastFromQuarantineError(error, { action: "delete" }));
            }
        } finally {
            setDeleting(null);
            setFileToDelete(null);
        }
    };

    // ─── Stop (cancel in-flight import / processing) ─────────────────────
    const handleStopClick = (file: FileStatusResponse) => {
        setFileToStop(file);
        setShowStopModal(true);
    };

    /**
     * Stop & Delete in one click.
     *
     * Flow:
     *   1. POST /uploads/{id}/cancel   — transitions the row to a terminal
     *      state (IMPORT_FAILED / DQ_FAILED / UPLOAD_FAILED). Idempotent
     *      ("noop" + new_status terminal also counts as success).
     *   2. DELETE /uploads/{id}        — clears the row from the catalog.
     *      Only attempted if (1) succeeded.
     *
     * Toasts:
     *   • Success path        → "Import stopped and deleted"
     *   • cancel 403          → "Only Super Admin or Admin can stop imports"
     *   • cancel 404          → "Already deleted" (skip delete, refresh list)
     *   • cancel other error  → "Failed to stop import" (skip delete)
     *   • cancel ok, delete err → "Import stopped (delete failed: …)" so the
     *                              user can manually delete via trash later.
     *
     * The IMPORTING poll loop is suspended for the duration of this chain
     * (see `useImportingFilesPoll({ isPaused: stopping !== null })`) so a
     * stale list refresh between the two HTTP calls can't reintroduce a row
     * that's about to be deleted.
     */
    const handleStopConfirm = async () => {
        if (!fileToStop || !idToken) return;
        if (!ensureFilesPermission()) return;
        const target = fileToStop;
        setStopping(target.upload_id);
        setShowStopModal(false);

        // ── Step 1: cancel ──────────────────────────────────────────────
        let cancelOk = false;
        try {
            const result = await fileManagementAPI.cancelUpload(target.upload_id, idToken);
            const newStatus = (result?.new_status || "").toUpperCase();
            const isTerminal =
                newStatus === "IMPORT_FAILED" ||
                newStatus === "DQ_FAILED" ||
                newStatus === "UPLOAD_FAILED" ||
                newStatus === "REJECTED" ||
                newStatus === "DQ_FIXED";
            const reqStatusCancelling = (result?.status || "").toLowerCase() === "cancelling";
            const reqStatusNoop = (result?.status || "").toLowerCase() === "noop";
            // Treat a fresh cancel OR a no-op-on-terminal as successful — both
            // mean it's safe to follow up with delete. (The row is or will be
            // in a deletable state.)
            cancelOk = reqStatusCancelling || (reqStatusNoop && isTerminal) || isTerminal;
        } catch (error) {
            console.error("Cancel error:", error);
            if (error instanceof ApiError && error.status === 403) {
                toast({
                    title: "Permission denied",
                    description: "Only Super Admin or Admin can stop imports.",
                    variant: "destructive",
                });
            } else if (error instanceof ApiError && error.status === 404) {
                // The upload row is already gone — there is nothing to delete.
                toast({ title: "Already deleted", description: "This file no longer exists in the catalog." });
                await loadFiles();
            } else {
                const code =
                    error instanceof ApiError && error.code
                        ? ` (${error.code})`
                        : error instanceof ApiError
                          ? ` (HTTP ${error.status})`
                          : "";
                toast({
                    title: "Failed to stop import",
                    description: `Could not cancel the operation${code}. Please try again.`,
                    variant: "destructive",
                });
            }
            setStopping(null);
            setFileToStop(null);
            return;
        }

        if (!cancelOk) {
            // Defensive: cancel returned an unexpected shape — treat as
            // partial success and surface the ambiguity to the user.
            toast({
                title: "Import stop status unclear",
                description: "The cancel call returned unexpectedly. Please refresh and retry the trash icon.",
                variant: "destructive",
            });
            await loadFiles();
            setStopping(null);
            setFileToStop(null);
            return;
        }

        // ── Step 2: delete ──────────────────────────────────────────────
        try {
            const result = await fileManagementAPI.deleteUpload(target.upload_id, idToken);
            if (result?.accepted && result.operation_id) {
                await fileManagementAPI.pollDeleteOperation(result.operation_id, idToken);
            }
            toast({
                title: "Import stopped and deleted",
                description: "The in-progress operation was cancelled and the file removed.",
            });
        } catch (error) {
            console.error("Post-cancel delete error:", error);
            // Cancel succeeded but delete didn't — surface a partial-success
            // toast and let the user retry the trash icon manually. The row
            // is now in a terminal state so the trash icon will be visible.
            toast({
                title: "Import stopped",
                description: "Cancelled, but the file could not be deleted. You can retry from the trash icon.",
                variant: "destructive",
            });
        } finally {
            await loadFiles();
            setStopping(null);
            setFileToStop(null);
        }
    };

    // ─── Multi-select & Bulk Delete ──────────────────────────────────
    const handleSelectFile = (uploadId: string, checked: boolean) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (checked) next.add(uploadId); else next.delete(uploadId);
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedFiles(new Set(filteredFiles.map(f => f.upload_id)));
        } else {
            setSelectedFiles(new Set());
        }
    };

    const handleBulkDeleteClick = () => {
        if (selectedFiles.size === 0) return;
        setShowBulkDeleteModal(true);
    };

    const handleBulkDeleteConfirm = async () => {
        if (selectedFiles.size === 0 || !idToken) return;
        if (!ensureFilesPermission()) return;
        setShowBulkDeleteModal(false);
        setBulkDeleting(true);
        const ids = Array.from(selectedFiles);
        let successCount = 0;
        let failCount = 0;
        // Capture last error so we can surface session-expired / permission
        // distinctly instead of the previous opaque "Bulk delete partial"
        // toast. A 401 also bails the loop early — every subsequent call
        // would 401 too, and the user needs to re-auth before retrying.
        let lastError: unknown = null;
        let bailedOnAuth = false;
        for (const id of ids) {
            try {
                setDeleting(id);
                const result = await fileManagementAPI.deleteUpload(id, idToken);
                if (result?.accepted && result.operation_id) {
                    await fileManagementAPI.pollDeleteOperation(result.operation_id, idToken);
                }
                successCount++;
            } catch (err) {
                lastError = err;
                failCount++;
                console.error(`Bulk delete failed for ${id}:`, err);
                if (err instanceof ApiError && err.status === 401) {
                    bailedOnAuth = true;
                    break;
                }
            } finally {
                setDeleting(null);
            }
        }
        setSelectedFiles(new Set());
        setBulkDeleting(false);
        await loadFiles();
        if (failCount === 0) {
            toast({ title: "Files deleted", description: `${successCount} file(s) removed successfully` });
        } else if (bailedOnAuth) {
            // Session expired mid-loop — route through the typed-error mapper
            // so the toast carries the standard "Sign In" action.
            toast(toastFromQuarantineError(lastError, { action: "delete files" }));
        } else if (lastError instanceof ApiError && lastError.status === 403) {
            toast({
                title: "Permission denied",
                description: `${successCount} deleted, ${failCount} blocked. You don't have permission to delete some of the selected files.`,
                variant: "destructive",
            });
        } else {
            toast({ title: "Bulk delete partial", description: `${successCount} deleted, ${failCount} failed`, variant: "destructive" });
        }
    };

    // ─── Download / export ────────────────────────────────────────────
    const handleDownloadClick = (file: FileStatusResponse) => {
        if (!ensureFilesPermission()) return;
        setDownloadModalFile(file);
        setShowDownloadModal(true);
    };

    const openActionsDialog = (file: FileStatusResponse) => {
        if (!ensureFilesPermission()) return;
        // FIX (Bug: Export column selector empty): set loading state + clear stale
        // columns SYNCHRONOUSLY so the dialog opens in "Loading columns..." state
        // instead of briefly rendering "0 of 0 selected, No columns match" while
        // the async /versions → /columns round-trip is in flight. Previously the
        // dialog opened with isLoadingColumns=false (default) and columns=[]
        // (default), producing the empty-selector flash that greys out Download.
        setColumnExportFile(file);
        setColumnExportColumns([]);
        setColumnExportLoading(true);
        setActionsDialogFile(file);
        setActionsDialogOpen(true);
        void (async () => {
            // Resolve latest version upload_id so export downloads the correct version
            let exportFile = file;
            if (idToken) {
                try {
                    const versionsResp = await fileManagementAPI.getFileVersions(file.upload_id, idToken);
                    const versions = versionsResp.versions || [];
                    if (versions.length > 0) {
                        const latest = versions.find((v: any) => v.is_latest) ||
                            versions.reduce((a: any, b: any) => ((a.version_number || 0) >= (b.version_number || 0) ? a : b));
                        if (latest?.upload_id) {
                            exportFile = { ...file, upload_id: latest.upload_id };
                        }
                    }
                } catch {
                    // fall back to root upload_id
                }
            }
            setColumnExportFile(exportFile);
            void handleColumnExportClick(exportFile);
        })();
    };

    const handleColumnExportClick = async (file: FileStatusResponse) => {
        if (!idToken) return;
        if (!ensureFilesPermission()) return;
        setColumnExportFile(file);
        setColumnExportLoading(true);
        // FIX: try /columns first; if it returns [], fall back to preview headers
        // (some uploads have a parquet result that read_parquet_columns trims).
        // If BOTH return empty, surface a warning toast so the user is not stuck
        // on a silently-empty dialog (Download stays disabled in that case).
        try {
            const resp = await fileManagementAPI.getFileColumns(file.upload_id, idToken);
            const cols = resp.columns || [];
            if (cols.length > 0) {
                setColumnExportColumns(cols);
            } else {
                // /columns returned empty → fall back to preview headers
                try {
                    const preview = await fileManagementAPI.getFilePreview(file.upload_id, idToken);
                    const previewCols = preview.headers || [];
                    setColumnExportColumns(previewCols);
                    if (previewCols.length === 0) {
                        toast({
                            title: "No columns detected",
                            description: "We could not detect any columns for this file. Try re-uploading or contact support.",
                            variant: "destructive",
                        });
                    }
                } catch (previewError) {
                    console.error("Failed to get columns from preview:", previewError);
                    setColumnExportColumns([]);
                    toast({ title: "No columns detected", description: "Could not load column list. Export may not work correctly.", variant: "destructive" });
                }
            }
        } catch (error) {
            console.error("Failed to fetch columns for export:", error);
            try {
                const preview = await fileManagementAPI.getFilePreview(file.upload_id, idToken);
                setColumnExportColumns(preview.headers || []);
            } catch (previewError) {
                console.error("Failed to get columns from preview:", previewError);
                setColumnExportColumns([]);
                toast({ title: "Warning", description: "Could not load column list. Export may not work correctly.", variant: "destructive" });
            }
        } finally {
            setColumnExportLoading(false);
        }
    };

    const handleColumnExport = async (options: {
        format: "csv" | "excel" | "json";
        dataType: "raw" | "all" | "clean" | "quarantine";
        columns: string[];
        columnMapping: Record<string, string>;
    }) => {
        if (!columnExportFile || !idToken) return;
        if (!ensureFilesPermission()) return;
        setDownloading(columnExportFile.upload_id);
        try {
            const exportResult = await fileManagementAPI.exportWithColumns(
                columnExportFile.upload_id, idToken,
                { format: options.format, data: options.dataType, columns: options.columns, columnMapping: options.columnMapping },
            );
            const extension = options.format === "excel" ? ".xlsx" : options.format === "json" ? ".json" : ".csv";
            const filename = buildPrefixedDataFilename({
                sourceName: columnExportFile.original_filename || columnExportFile.filename || "file",
                dataType: options.dataType,
                extension,
                tags: ["export"],
            });
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                triggerBlobDownload(url, filename);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                triggerPresignedDownload(exportResult.downloadUrl);
            } else {
                throw new Error("No downloadable export payload received");
            }
            toast({ title: "Export Complete", description: `Exported ${options.columns.length} columns with ${Object.keys(options.columnMapping).length} renamed` });
            setActionsDialogOpen(false);
            setColumnExportFile(null);
        } catch (error) {
            console.error("Column export error:", error);
            toast({ title: "Export Failed", description: "Unable to export file with selected columns", variant: "destructive" });
        } finally {
            setDownloading(null);
        }
    };

    const handleColumnExportWithErp = async (options: {
        format: "csv" | "excel" | "json";
        dataType: "raw" | "all" | "clean" | "quarantine";
        columns: string[];
        columnMapping: Record<string, string>;
    }) => {
        if (!columnExportFile || !idToken) return;
        if (!ensureFilesPermission()) return;
        setDownloading(columnExportFile.upload_id);
        try {
            const exportResult = await fileManagementAPI.exportWithColumns(
                columnExportFile.upload_id, idToken,
                {
                    format: options.format, data: options.dataType, columns: options.columns,
                    columnMapping: options.columnMapping,
                    erp: actionsErpMode === "transform" ? actionsErpTarget : undefined,
                },
            );
            const extension = options.format === "excel" ? ".xlsx" : options.format === "json" ? ".json" : ".csv";
            const filename = buildPrefixedDataFilename({
                sourceName: columnExportFile.original_filename || columnExportFile.filename || "file",
                dataType: options.dataType,
                extension,
                tags: ["erp", actionsErpMode === "transform" ? actionsErpTarget : null],
            });
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                triggerBlobDownload(url, filename);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                triggerPresignedDownload(exportResult.downloadUrl);
            } else {
                throw new Error("No downloadable export payload received");
            }
            toast({
                title: "ERP Export Complete",
                description: actionsErpMode === "transform" ? `Exported with ${actionsErpTarget} formatting` : "Exported in original format",
            });
            setActionsDialogOpen(false);
        } catch (error) {
            console.error("ERP export error:", error);
            const message =
                error instanceof Error && error.message.toLowerCase().includes("permission denied")
                    ? "You do not have permission for this action. Contact your organization admin."
                    : "Unable to export ERP file";
            toast({ title: "ERP Export Failed", description: message, variant: "destructive" });
        } finally {
            setDownloading(null);
        }
    };

    const handleFormatSelected = (
        format: "csv" | "excel" | "json",
        dataType: "original" | "clean",
    ) => {
        if (!downloadModalFile) return;
        if (!ensureFilesPermission()) return;
        setShowDownloadModal(false);
        if (dataType === "clean") {
            setErpModalConfig({ file: downloadModalFile, format });
            setShowErpModal(true);
        } else {
            handleDirectDownload(downloadModalFile, format, dataType);
        }
    };

    const handleDirectDownload = async (
        file: FileStatusResponse,
        format: "csv" | "excel" | "json",
        dataType: "original" | "clean",
    ) => {
        if (!idToken) return;
        if (!ensureFilesPermission()) return;
        setDownloadingFormat(`${file.upload_id}-${format}`);
        setDownloading(file.upload_id);
        try {
            const exportResult = await fileManagementAPI.exportWithColumns(
                file.upload_id, idToken,
                { format, data: dataType === "original" ? "raw" : "clean" },
            );
            const extension = format === "excel" ? ".xlsx" : format === "json" ? ".json" : ".csv";
            const filename = buildPrefixedDataFilename({
                sourceName: file.original_filename || file.filename || "file",
                dataType: dataType === "original" ? "original" : "clean",
                extension,
            });
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                triggerBlobDownload(url, filename);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                triggerPresignedDownload(exportResult.downloadUrl);
            } else {
                throw new Error("No downloadable export payload received");
            }
            toast({ title: "Success", description: "File downloaded" });
        } catch (error) {
            console.error("Download error:", error);
            // Route 401 / 403 / 5xx through the typed-error matrix so the
            // toast carries the correct action (Sign In / Contact Support /
            // Retry) instead of the previous opaque "Unable to download".
            if (error instanceof ApiError) {
                toast(
                    toastFromQuarantineError(error, {
                        action: "download this file",
                        retryFn:
                            error.status >= 500
                                ? () => handleDirectDownload(file, format, dataType)
                                : undefined,
                    }),
                );
            } else {
                toast({ title: "Download failed", description: "Unable to download file", variant: "destructive" });
            }
        } finally {
            setDownloadingFormat(null);
            setDownloading(null);
        }
    };

    const handleDownloadWithErp = async (
        targetErp: string | null,
        dataType: "clean" | "quarantine" | "all" = "all",
    ) => {
        if (!erpModalConfig || !idToken) return;
        if (!ensureFilesPermission()) return;
        const { file, format } = erpModalConfig;
        setDownloadingFormat(`${file.upload_id}-${format}`);
        setDownloading(file.upload_id);
        setShowErpModal(false);
        try {
            const exportResult = await fileManagementAPI.exportWithColumns(
                file.upload_id, idToken,
                { format, data: dataType, erp: targetErp || undefined },
            );
            const extension = format === "excel" ? ".xlsx" : format === "json" ? ".json" : ".csv";
            const filename = buildPrefixedDataFilename({
                sourceName: file.original_filename || file.filename || "file",
                dataType,
                extension,
                tags: targetErp ? [sanitizeFilenamePart(targetErp)] : [],
            });
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                triggerBlobDownload(url, filename);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                triggerPresignedDownload(exportResult.downloadUrl);
            } else {
                throw new Error("No downloadable export payload received");
            }
            toast({
                title: "Success",
                description: targetErp ? `Downloaded with ${targetErp}` : "File downloaded",
            });
        } catch (error) {
            console.error("Download error:", error);
            if (error instanceof ApiError) {
                toast(
                    toastFromQuarantineError(error, {
                        action: "download this file",
                        retryFn:
                            error.status >= 500
                                ? () => handleDownloadWithErp(targetErp, dataType)
                                : undefined,
                    }),
                );
            } else {
                toast({ title: "Download failed", description: "Unable to download file", variant: "destructive" });
            }
        } finally {
            setDownloadingFormat(null);
            setDownloading(null);
            setErpModalConfig(null);
        }
    };

    // ─── Derived state ────────────────────────────────────────────────
    const tableEmpty = filteredFiles.length === 0;

    const pageMode: 'import' | 'export' =
        lastActiveSelector === 'destination' && selectedDestination !== 'null'
            ? 'export'
            : 'import';

    // ─── Return ───────────────────────────────────────────────────────
    return {
        // Redux
        files, loading, dispatch,
        // Refs
        fileInputRef, selectionFileInputRef,
        // Auth
        idToken, canUseFilesActions, permissionsLoaded,
        showFilesPermissionDenied, ensureFilesPermission, renderRestrictedFilesPanel,
        // Upload
        uploading, uploadProgress, dragActive, useAI, setUseAI,
        handleFileInput, handleDrag, handleDrop,
        // Rename-on-duplicate dialog
        showRenameDialog, setShowRenameDialog,
        pendingUploadFile, renameValue, setRenameValue,
        renameError, setRenameError,
        handleRenameConfirm,
        // Post-upload prompt
        recentlyUploaded, setRecentlyUploaded,
        // Manual refresh
        isManualRefresh, handleManualRefresh,
        // Search / filter / sort
        searchQuery, setSearchQuery, statusFilter, setStatusFilter, highlightedFileId,
        sortField, sortDirection, handleSort, filteredFiles, tableEmpty,
        // Section
        activeSection, setActiveSection,
        // Source / destination
        selectedSource, setSelectedSource, selectedDestination, setSelectedDestination,
        lastActiveSelector, setLastActiveSelector,
        selectedErp, setSelectedErp,
        selectedDestinationErp, setSelectedDestinationErp,
        selectedDestinationFormat, setSelectedDestinationFormat,
        pageMode,
        // Details / wizard
        detailsOpen, setDetailsOpen, selectedFile, setSelectedFile,
        handleViewDetails, handleStartProcessing, handleQuickProcess,
        wizardOpen, setWizardOpen, wizardFile, setWizardFile, handleWizardOpenChange, handleWizardComplete,
        // New import wizard
        newImportWizardOpen, setNewImportWizardOpen,
        handleNewImportOpen, handleNewImportClose,
        // Quarantine editor
        quarantineEditorOpen, setQuarantineEditorOpen,
        quarantineEditorFile, setQuarantineEditorFile,
        handleOpenQuarantineEditor, handleQuarantineEditorComplete, handleReprocessSubmitted,
        // Push to ERP
        pushQBModalOpen, setPushQBModalOpen, fileToPush, setFileToPush,
        handlePushToQuickBooks, handleQuickBooksImportComplete,
        showPushToErpModal, setShowPushToErpModal, pushToErpFile, setPushToErpFile,
        // Profiling
        profilingFileId, setProfilingFileId, profilingData, loadingProfiling, handleViewProfiling,
        // Delete
        deleting, showDeleteModal, setShowDeleteModal, fileToDelete, handleDeleteClick, handleDeleteConfirm,
        // Stop (cancel in-flight import / processing)
        stopping, showStopModal, setShowStopModal, fileToStop, handleStopClick, handleStopConfirm,
        // Multi-select & Bulk Delete
        selectedFiles, handleSelectFile, handleSelectAll, handleBulkDeleteClick,
        showBulkDeleteModal, setShowBulkDeleteModal, handleBulkDeleteConfirm, bulkDeleting,
        // Download / export
        downloading, downloadingFormat,
        showDownloadModal, setShowDownloadModal, downloadModalFile,
        handleDownloadClick, handleFormatSelected, handleDirectDownload,
        showErpModal, setShowErpModal, erpModalConfig, handleDownloadWithErp,
        // Column export
        showColumnExportModal, setShowColumnExportModal,
        columnExportFile, setColumnExportFile,
        columnExportColumns, setColumnExportColumns, columnExportLoading,
        handleColumnExportClick, handleColumnExport, handleColumnExportWithErp,
        openActionsDialog,
        actionsDialogOpen, setActionsDialogOpen,
        actionsDialogFile, setActionsDialogFile,
        actionsErpMode, setActionsErpMode, actionsErpTarget, setActionsErpTarget,
        // Column selection modal
        columnModalOpen, setColumnModalOpen, columnModalFile,
        availableColumns, selectedColumns, columnsLoading, columnsError,
        selectionFileError, selectionProfilingData, selectionProfilingLoading, selectionProfilingError,
        handleToggleColumn, handleToggleAllColumns, handleColumnConfirm, handleColumnCancel,
        handleSelectionFileInput,
        // Display columns
        displayColumnModalOpen, setDisplayColumnModalOpen,
        visibleColumns, setVisibleColumns,
        pendingVisibleColumns, setPendingVisibleColumns,
        // Confirm columns
        confirmColumnsOpen, setConfirmColumnsOpen, confirmColumns, confirmAllColumns,
        handleConfirmColumnsCancel, handleConfirmColumnsProceed,
        // Rules dialog
        rulesDialogOpen, setRulesDialogOpen, rulesConfirmed,
        handleOpenRulesDialog, handleCloseRulesDialog, handleConfirmRulesDialog,
        globalDisabledRules, requiredColumns,
        disableRulesByColumn, overrideRulesByColumn,
        rulesDisableColumn, rulesOverrideColumn,
        handleToggleGlobalRule, handleToggleRequiredColumn,
        handleSelectDisableColumn, handleSelectOverrideColumn,
        handleToggleDisableRule, handleToggleOverrideRule,
        // Custom rules
        useCustomRules, setUseCustomRules,
        customRules, customRuleColumn, setCustomRuleColumn,
        customRulePrompt, setCustomRulePrompt,
        customRuleSuggestion, setCustomRuleSuggestion,
        customRuleSuggesting, customRuleSuggestError,
        handleGenerateCustomRule, handleApproveCustomRule, handleRemoveCustomRule,
        // Load files (for external consumers)
        loadFiles,
    };
}

export type FilesPageState = ReturnType<typeof useFilesPage>;
