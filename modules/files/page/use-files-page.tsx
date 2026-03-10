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
} from "@/modules/files/store/filesSlice";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/modules/auth";
import {
    fileManagementAPI,
    type FileStatusResponse,
    type ProfilingResponse,
    type CustomRuleDefinition,
    type CustomRuleSuggestionResponse,
} from "@/modules/files";
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
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        console.log("API Response / Table Source Data:", files);
    }, [files]);

    const [loading, setLoading] = useState(false);
    const [isManualRefresh, setIsManualRefresh] = useState(false);

    // Post-upload prompt state
    const [recentlyUploaded, setRecentlyUploaded] = useState<FileStatusResponse | null>(null);

    // Track previous file statuses for processing completion toast
    const prevStatusesRef = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        setLoading(filesStatus === "loading");
    }, [filesStatus]);

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
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileStatusResponse | null>(null);
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
    const [activeSection, setActiveSection] = useState<"upload" | "explorer">("upload");
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
            "file", "score", "quality", "rows", "category",
            "status", "uploaded", "updated", "processingTime", "actions",
        ]),
    );
    const [selectedDestinationFormat, setSelectedDestinationFormat] = useState<string | null>(null);
    const [pendingVisibleColumns, setPendingVisibleColumns] = useState<Set<string>>(
        new Set([
            "file", "score", "quality", "rows", "category",
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
    const { idToken, hasPermission, permissionsLoaded } = useAuth();
    const canUseFilesActions = hasPermission("files");

    // ─── Permission helpers ───────────────────────────────────────────
    const showFilesPermissionDenied = useCallback(() => {
        toast({
            title: "Permission denied",
            description: "You do not have permission for this action. Contact your organization admin.",
            variant: "destructive",
        });
    }, [toast]);

    const ensureFilesPermission = useCallback(() => {
        if (hasPermission("files")) return true;
        showFilesPermissionDenied();
        return false;
    }, [hasPermission, showFilesPermissionDenied]);

    const renderRestrictedFilesPanel = useCallback(
        (content: React.ReactNode) => {
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
        [canUseFilesActions, showFilesPermissionDenied],
    );

    // ─── Data loading ─────────────────────────────────────────────────
    const loadFiles = useCallback(async (userInitiated = false) => {
        if (!idToken) return;
        if (permissionsLoaded && !hasPermission("files")) {
            dispatch(resetFiles());
            if (userInitiated) {
                ensureFilesPermission();
            }
            return;
        }
        await dispatch(fetchFiles(idToken));
    }, [idToken, permissionsLoaded, hasPermission, dispatch, ensureFilesPermission]);

    useEffect(() => {
        loadFiles(false);
    }, [loadFiles]);

    // Handle query params from Dashboard → Catalog navigation
    const consumedFileParamRef = useRef(false);
    useEffect(() => {
        const tab = searchParams.get("tab");
        const status = searchParams.get("status");
        const fileId = searchParams.get("file");

        if (!tab && !status && !fileId) return;

        if (tab === "explorer") setActiveSection("explorer");
        if (status) setStatusFilter(status);

        // Auto-open file details when linked from Dashboard/Jobs
        if (fileId && files.length > 0) {
            const target = files.find((f) => f.upload_id === fileId);
            if (target) {
                setActiveSection("explorer");
                setSelectedFile(target);
                setDetailsOpen(true);
            }
            // Only clear the `file` param so reload doesn't re-open the panel
            // Keep `tab` and `status` so the page stays on the correct sub-tab
            if (!consumedFileParamRef.current) {
                consumedFileParamRef.current = true;
                const kept = new URLSearchParams();
                if (tab) kept.set("tab", tab);
                if (status) kept.set("status", status);
                const qs = kept.toString();
                router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            }
        }
    }, [searchParams, files, router, pathname]);

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
            toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
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
            await loadFiles();
            // Find the newly uploaded file and show post-upload prompt
            const refreshedFiles = dispatch(fetchFiles(idToken));
            setActiveSection("explorer");
            // Set recently uploaded for the prompt banner (auto-dismiss after 15s)
            const latestFile = files.find((f) =>
                (f.original_filename || f.filename || "").toLowerCase() === file.name.toLowerCase()
            );
            if (latestFile) {
                setRecentlyUploaded(latestFile);
                setTimeout(() => setRecentlyUploaded(null), 15000);
            }
        } catch (error) {
            console.error("Upload failed:", error);
            const message = error instanceof Error ? error.message.toLowerCase() : "";
            toast({
                title: message.includes("permission denied") ? "Permission denied" : "Upload failed",
                description: message.includes("permission denied")
                    ? "You do not have permission for this action. Contact your organization admin."
                    : "Please try again",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
            updateUploadProgress(0);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!ensureFilesPermission()) return;
        if (!idToken) {
            toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
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
    const handleViewDetails = (file: FileStatusResponse) => {
        setSelectedFile(file);
        setDetailsOpen(true);
    };

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

        setQuarantineEditorFile(file);
        setQuarantineEditorOpen(true);
    };

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
        } catch (error) {
            console.error("Processing failed:", error);
            toast({ title: "Processing Failed", description: "Failed to start data quality processing", variant: "destructive" });
        }
    };

    const handleStartProcessing = async (file: FileStatusResponse) => {
        if (!idToken) return;
        if (!ensureFilesPermission()) return;
        setWizardFile(file);
        setWizardOpen(true);
    };

    const handleWizardOpenChange = (open: boolean) => {
        setWizardOpen(open);
        if (!open) setWizardFile(null);
    };

    const handleWizardComplete = () => {
        loadFiles();
        if (wizardFile) {
            setSelectedFile(wizardFile);
            setDetailsOpen(true);
        }
        setWizardOpen(false);
        setWizardFile(null);
    };

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
                const XLSX = await import("xlsx");
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                const parsed = parseSelectionRows(rows);
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
            await fileManagementAPI.deleteUpload(fileToDelete.upload_id, idToken);
            toast({ title: "File deleted", description: "File removed successfully" });
            await loadFiles();
        } catch (error) {
            console.error("Delete error:", error);
            const message =
                error instanceof Error && error.message.toLowerCase().includes("permission denied")
                    ? "You do not have permission for this action. Contact your organization admin."
                    : "Unable to delete file";
            toast({ title: "Delete failed", description: message, variant: "destructive" });
        } finally {
            setDeleting(null);
            setFileToDelete(null);
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
        try {
            const resp = await fileManagementAPI.getFileColumns(file.upload_id, idToken);
            setColumnExportColumns(resp.columns || []);
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
        dataType: "all" | "clean" | "quarantine";
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
            const baseFilename = (columnExportFile.original_filename || columnExportFile.filename || "file").replace(/\.[^/.]+$/, "");
            const extension = options.format === "excel" ? ".xlsx" : options.format === "json" ? ".json" : ".csv";
            const filename = `${baseFilename}_export${extension}`;
            const link = document.createElement("a");
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                link.href = url; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                link.href = exportResult.downloadUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
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
        dataType: "all" | "clean" | "quarantine";
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
            const baseFilename = (columnExportFile.original_filename || columnExportFile.filename || "file").replace(/\.[^/.]+$/, "");
            const extension = options.format === "excel" ? ".xlsx" : options.format === "json" ? ".json" : ".csv";
            const filename = `${baseFilename}_erp${extension}`;
            const link = document.createElement("a");
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                link.href = url; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                link.href = exportResult.downloadUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
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
            const baseFilename = (file.original_filename || file.filename || "file").replace(/\.[^/.]+$/, "");
            const extension = format === "excel" ? ".xlsx" : format === "json" ? ".json" : ".csv";
            const dataSuffix = dataType === "original" ? "_original" : "_clean";
            const filename = `${baseFilename}${dataSuffix}${extension}`;
            const link = document.createElement("a");
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                link.href = url; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                link.href = exportResult.downloadUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            } else {
                throw new Error("No downloadable export payload received");
            }
            toast({ title: "Success", description: "File downloaded" });
        } catch (error) {
            console.error("Download error:", error);
            toast({ title: "Download failed", description: "Unable to download file", variant: "destructive" });
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
            const baseFilename = (file.original_filename || file.filename || "file").replace(/\.[^/.]+$/, "");
            const extension = format === "excel" ? ".xlsx" : format === "json" ? ".json" : ".csv";
            const erpSuffix = targetErp ? `_${targetErp.replace(/\s+/g, "_").toLowerCase()}` : "";
            const dataTypeSuffix = dataType === "clean" ? "_clean" : dataType === "quarantine" ? "_quarantined" : "_full";
            const filename = `${baseFilename}${dataTypeSuffix}${erpSuffix}${extension}`;
            const link = document.createElement("a");
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob);
                link.href = url; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else if (exportResult.downloadUrl) {
                link.href = exportResult.downloadUrl; link.target = "_blank"; link.rel = "noopener noreferrer"; link.download = filename;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            } else {
                throw new Error("No downloadable export payload received");
            }
            toast({
                title: "Success",
                description: targetErp ? `Downloaded with ${targetErp}` : "File downloaded",
            });
        } catch (error) {
            console.error("Download error:", error);
            toast({ title: "Download failed", description: "Unable to download file", variant: "destructive" });
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
        searchQuery, setSearchQuery, statusFilter, setStatusFilter,
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
        handleViewDetails, handleStartProcessing,
        wizardOpen, setWizardOpen, wizardFile, setWizardFile, handleWizardOpenChange, handleWizardComplete,
        // Quarantine editor
        quarantineEditorOpen, setQuarantineEditorOpen,
        quarantineEditorFile, setQuarantineEditorFile,
        handleOpenQuarantineEditor, handleQuarantineEditorComplete,
        // Push to ERP
        pushQBModalOpen, setPushQBModalOpen, fileToPush, setFileToPush,
        handlePushToQuickBooks, handleQuickBooksImportComplete,
        showPushToErpModal, setShowPushToErpModal, pushToErpFile, setPushToErpFile,
        // Profiling
        profilingFileId, setProfilingFileId, profilingData, loadingProfiling, handleViewProfiling,
        // Delete
        deleting, showDeleteModal, setShowDeleteModal, fileToDelete, handleDeleteClick, handleDeleteConfirm,
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
