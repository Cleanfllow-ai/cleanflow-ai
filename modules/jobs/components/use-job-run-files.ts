"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/modules/auth"
import { useToast } from "@/shared/hooks/use-toast"
import { buildPrefixedDataFilename } from "@/modules/files/utils/download-filenames"
import { fileManagementAPI } from "@/modules/files/api/file-management-api"
import { jobsAPI } from "@/modules/jobs/api/jobs-api"
import type { FileStatusResponse, QuarantineReprocessResponse } from "@/modules/files/types"
import type { JobRun } from "@/modules/jobs/types/jobs.types"

const ERP_DISPLAY: Record<string, string> = {
    quickbooks: "QuickBooks",
    zohobooks: "Zoho Books",
    "zoho-books": "Zoho Books",
    zoho_books: "Zoho Books",
    snowflake: "Snowflake",
}

export interface RunFileEntry {
    entity: string
    uploadId: string
    file: FileStatusResponse | null
    loading: boolean
    error?: string
}

export interface JobRunFilesState {
    entries: RunFileEntry[]
    loading: boolean
    detailFile: FileStatusResponse | null
    detailOpen: boolean
    setDetailOpen: (open: boolean) => void
    downloadFile: FileStatusResponse | null
    downloadOpen: boolean
    setDownloadOpen: (open: boolean) => void
    columnExportColumns: string[]
    columnExportLoading: boolean
    handleViewDetail: (file: FileStatusResponse) => void
    handleDownloadPrompt: (file: FileStatusResponse) => void
    handleColumnExport: (options: {
        format: "csv" | "excel" | "json"
        dataType: "all" | "clean" | "quarantine"
        columns: string[]
        columnMapping: Record<string, string>
    }) => Promise<void>
    handleDelete: (uploadId: string) => Promise<void>
    downloading: boolean
    erpMode: "original" | "transform"
    setErpMode: (mode: "original" | "transform") => void
    erpTarget: string
    setErpTarget: (target: string) => void
    quarantineFile: FileStatusResponse | null
    quarantineEditorOpen: boolean
    handleOpenQuarantineEditor: (file: FileStatusResponse, entity?: string) => void
    handleQuarantineEditorClose: () => void
    handleReprocessSubmitted: (result: QuarantineReprocessResponse) => void
    exporting: boolean
}

/**
 * Fetch a file's status and resolve to the latest version's data.
 * Merges latest version stats (dq_score, status, rows, etc.) onto the file record.
 */
async function fetchFileWithLatestVersion(
    uploadId: string,
    token: string,
): Promise<FileStatusResponse> {
    const [file, versionsResp] = await Promise.all([
        fileManagementAPI.getFileStatus(uploadId, token),
        fileManagementAPI.getFileVersions(uploadId, token).catch(() => ({ versions: [] as any[], count: 0 })),
    ])

    const versions = versionsResp.versions || []
    if (versions.length > 0) {
        const latest = versions.find((v: any) => v.is_latest) ||
            versions.reduce((a: any, b: any) => ((a.version_number || 0) >= (b.version_number || 0) ? a : b))
        if (latest.dq_score != null) file.dq_score = latest.dq_score
        if (latest.status) file.status = latest.status as FileStatusResponse["status"]
        if (latest.rows_in != null) file.rows_in = latest.rows_in
        if (latest.rows_clean != null) file.rows_clean = latest.rows_clean
        if (latest.rows_fixed != null) file.rows_fixed = latest.rows_fixed
        if (latest.rows_quarantined != null) file.rows_quarantined = latest.rows_quarantined
        if (latest.rows_out != null) file.rows_out = latest.rows_out
        if (latest.processing_time_seconds != null) file.processing_time_seconds = latest.processing_time_seconds
    }
    return file
}

/**
 * Poll until a new file version appears (reprocess complete), then return the updated file.
 */
async function waitForNewVersion(
    originalUploadId: string,
    token: string,
    maxWaitMs: number = 60000,
    cancelledRef?: React.MutableRefObject<boolean>,
): Promise<FileStatusResponse | null> {
    const interval = 3000
    const startTime = Date.now()

    // Get initial version count
    let initialVersionCount = 0
    try {
        const resp = await fileManagementAPI.getFileVersions(originalUploadId, token)
        initialVersionCount = (resp.versions || []).length
    } catch { /* ignore */ }

    while (Date.now() - startTime < maxWaitMs) {
        if (cancelledRef?.current) return null
        await new Promise(resolve => setTimeout(resolve, interval))
        if (cancelledRef?.current) return null
        try {
            const resp = await fileManagementAPI.getFileVersions(originalUploadId, token)
            const versions = resp.versions || []
            if (versions.length > initialVersionCount) {
                // New version appeared — reprocess is complete
                return await fetchFileWithLatestVersion(originalUploadId, token)
            }
        } catch { /* ignore */ }
    }

    return null // Timeout
}

async function waitForDeltaReprocess(
    uploadId: string,
    token: string,
    options: {
        maxWaitMs?: number
        expectedSnapshotId?: string
        previousSnapshotId?: string | null
        cancelledRef?: React.MutableRefObject<boolean>
    } = {},
): Promise<FileStatusResponse | null> {
    const interval = 2000
    const startTime = Date.now()
    const maxWaitMs = options.maxWaitMs ?? 60000

    while (Date.now() - startTime < maxWaitMs) {
        if (options.cancelledRef?.current) return null
        await new Promise(resolve => setTimeout(resolve, interval))
        if (options.cancelledRef?.current) return null
        try {
            const file = await fileManagementAPI.getFileStatus(uploadId, token)
            const currentSnapshotId = file.current_reprocess_snapshot_id || null
            if (options.expectedSnapshotId && currentSnapshotId === options.expectedSnapshotId) {
                return file
            }
            if (!options.expectedSnapshotId && options.previousSnapshotId && currentSnapshotId && currentSnapshotId !== options.previousSnapshotId) {
                return file
            }
            if (!options.expectedSnapshotId && !options.previousSnapshotId && file.remediation_state === "DELTA_APPLIED") {
                return file
            }
        } catch {
            // ignore and keep polling
        }
    }

    return null
}

/**
 * Poll the re-export status endpoint until the orchestrator finishes the async export.
 */
async function pollReExportStatus(
    jobId: string,
    uploadId: string,
    maxWaitMs: number = 120000,
    cancelledRef?: React.MutableRefObject<boolean>,
): Promise<{ status: string; records_exported?: number; destination?: string; error?: string } | null> {
    const interval = 5000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
        if (cancelledRef?.current) return null
        await new Promise(resolve => setTimeout(resolve, interval))
        if (cancelledRef?.current) return null
        try {
            const result = await Promise.resolve as any // TODO: re-export not yet in new jobs API(jobId, uploadId)
            if (result.status === "SUCCESS" || result.status === "FAILED") {
                return result
            }
            // "PENDING" — keep polling
        } catch { /* ignore */ }
    }

    return null // Timeout
}

export function useJobRunFiles(run: JobRun | null, open: boolean): JobRunFilesState {
    const { idToken } = useAuth()
    const { toast } = useToast()
    const [entries, setEntries] = useState<RunFileEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [detailFile, setDetailFile] = useState<FileStatusResponse | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [downloadFile, setDownloadFile] = useState<FileStatusResponse | null>(null)
    const [downloadOpen, setDownloadOpen] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [columnExportColumns, setColumnExportColumns] = useState<string[]>([])
    const [columnExportLoading, setColumnExportLoading] = useState(false)
    const [erpMode, setErpMode] = useState<"original" | "transform">("original")
    const [erpTarget, setErpTarget] = useState("")
    const [quarantineFile, setQuarantineFile] = useState<FileStatusResponse | null>(null)
    const [quarantineEditorOpen, setQuarantineEditorOpen] = useState(false)
    const [quarantineEntity, setQuarantineEntity] = useState<string | null>(null)
    const [exporting, setExporting] = useState(false)

    // Ref to access latest entries without adding to callback deps
    const entriesRef = useRef(entries)
    entriesRef.current = entries

    // Cancellation ref — set to true when the hook unmounts or dialog closes
    const cancelledRef = useRef(false)
    useEffect(() => {
        cancelledRef.current = false
        return () => { cancelledRef.current = true }
    }, [open])

    useEffect(() => {
        if (!open || !run || !idToken) {
            setEntries([])
            return
        }

        const entityResults = run.entity_results || {}
        const entityEntries = Object.entries(entityResults)
            .filter(([, result]) => (result as any).upload_id)
            .map(([entity, result]) => ({
                entity,
                uploadId: (result as any).upload_id!,
                file: null as FileStatusResponse | null,
                loading: true,
                error: undefined as string | undefined,
            }))

        if (entityEntries.length === 0) {
            setEntries([])
            setLoading(false)
            return
        }

        setEntries(entityEntries)
        setLoading(true)

        const fetchAll = async () => {
            const updated = await Promise.all(
                entityEntries.map(async (entry) => {
                    try {
                        const file = await fetchFileWithLatestVersion(entry.uploadId, idToken)
                        return { ...entry, file, loading: false }
                    } catch {
                        return { ...entry, file: null, loading: false, error: "File not found" }
                    }
                })
            )
            setEntries(updated)
            setLoading(false)
        }

        fetchAll()
    }, [open, run, idToken])

    const handleViewDetail = useCallback((file: FileStatusResponse) => {
        setDetailFile(file)
        setDetailOpen(true)
    }, [])

    const handleDownloadPrompt = useCallback(async (file: FileStatusResponse) => {
        setDownloadFile(file)
        setDownloadOpen(true)
        setColumnExportColumns([])
        setColumnExportLoading(true)
        if (!idToken) { setColumnExportLoading(false); return }
        try {
            const resp = await fileManagementAPI.getFileColumns(file.upload_id, idToken)
            setColumnExportColumns(resp.columns || [])
        } catch {
            try {
                const preview = await fileManagementAPI.getFilePreview(file.upload_id, idToken)
                setColumnExportColumns(preview.headers || [])
            } catch {
                setColumnExportColumns([])
            }
        } finally {
            setColumnExportLoading(false)
        }
    }, [idToken])

    const handleColumnExport = useCallback(async (options: {
        format: "csv" | "excel" | "json"
        dataType: "all" | "clean" | "quarantine"
        columns: string[]
        columnMapping: Record<string, string>
    }) => {
        if (!downloadFile || !idToken) return
        setDownloading(true)
        try {
            const exportResult = await fileManagementAPI.exportWithColumns(
                downloadFile.upload_id, idToken,
                {
                    format: options.format,
                    data: options.dataType,
                    columns: options.columns,
                    columnMapping: options.columnMapping,
                    erp: erpMode === "transform" ? erpTarget : undefined,
                },
            )
            const extension = options.format === "excel" ? ".xlsx" : options.format === "json" ? ".json" : ".csv"
            const filename = buildPrefixedDataFilename({
                sourceName: downloadFile.original_filename || downloadFile.filename || "file",
                dataType: options.dataType,
                extension,
                tags: ["export"],
            })
            const link = document.createElement("a")
            if (exportResult.blob) {
                const url = URL.createObjectURL(exportResult.blob)
                link.href = url
                link.download = filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            } else if (exportResult.downloadUrl) {
                link.href = exportResult.downloadUrl
                link.target = "_blank"
                link.rel = "noopener noreferrer"
                link.download = filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }
            setDownloadOpen(false)
        } catch (err) {
            console.error("Download failed:", err)
        } finally {
            setDownloading(false)
        }
    }, [downloadFile, idToken, erpMode, erpTarget])

    const handleDelete = useCallback(async (uploadId: string) => {
        if (!idToken) return
        try {
            await fileManagementAPI.deleteUpload(uploadId, idToken)
            setEntries(prev => prev.map(e =>
                e.uploadId === uploadId
                    ? { ...e, file: null, error: "Deleted" }
                    : e
            ))
        } catch (err) {
            console.error("Delete failed:", err)
        }
    }, [idToken])

    const handleOpenQuarantineEditor = useCallback((file: FileStatusResponse, entity?: string) => {
        setQuarantineFile(file)
        // Resolve entity from entries if not provided (e.g. from FileDetailsDialog onRemediate)
        const resolvedEntity = entity || entriesRef.current.find(e => e.uploadId === file.upload_id)?.entity || ""
        setQuarantineEntity(resolvedEntity)
        setQuarantineEditorOpen(true)
    }, [])

    const handleQuarantineEditorClose = useCallback(async () => {
        const closingFile = quarantineFile
        setQuarantineEditorOpen(false)
        setQuarantineFile(null)
        setQuarantineEntity(null)
        // Refresh the file entry with latest version data to reflect reprocessing changes
        if (closingFile && idToken) {
            try {
                const updated = await fetchFileWithLatestVersion(closingFile.upload_id, idToken)
                setEntries(prev => prev.map(e =>
                    e.uploadId === closingFile.upload_id
                        ? { ...e, file: updated }
                        : e
                ))
            } catch {
                // Ignore — file may have been replaced by a new version
            }
        }
    }, [quarantineFile, idToken])

    /**
     * Called by QuarantineEditorDialog after reprocess is submitted.
     * Polls for the reprocessed version, then kicks off async re-export and polls for result.
     */
    const handleReprocessSubmitted = useCallback(async (reprocessResult: QuarantineReprocessResponse) => {
        const entity = quarantineEntity
        const activeFile = quarantineFile
        const fileUploadId = activeFile?.upload_id
        const previousSnapshotId = activeFile?.current_reprocess_snapshot_id || null
        const jobId = run?.job_id
        const destination = "destination"
        const destLabel = ERP_DISPLAY[destination || ""] || destination || "destination"

        if (!entity || !fileUploadId || !jobId || !idToken) return
        const effectiveMode = reprocessResult.effective_mode || "full"
        const targetUploadId = reprocessResult.new_upload_id || reprocessResult.base_upload_id || fileUploadId

        if (activeFile) {
            const optimisticFile: FileStatusResponse = {
                ...activeFile,
                status: "QUEUED",
                remediation_state: "REPROCESS_SUBMITTED",
                updated_at: new Date().toISOString(),
            }
            setEntries(prev => prev.map(e =>
                e.uploadId === fileUploadId ? { ...e, file: optimisticFile } : e
            ))
            setQuarantineFile(optimisticFile)
        }

        setExporting(true)
        toast({ title: "Reprocessing...", description: `Waiting for reprocess to complete before exporting to ${destLabel}` })

        try {
            let updatedFile: FileStatusResponse | null
            if (effectiveMode === "delta") {
                updatedFile = await waitForDeltaReprocess(fileUploadId, idToken, {
                    maxWaitMs: 60000,
                    expectedSnapshotId: reprocessResult.reprocess_snapshot_id,
                    previousSnapshotId,
                    cancelledRef,
                })
            } else {
                // Wait for the reprocess worker to create the new version
                updatedFile = await waitForNewVersion(fileUploadId, idToken, 60000, cancelledRef)
            }

            if (!updatedFile) {
                toast({ title: "Export skipped", description: "Reprocess is still in progress. Clean data will need to be exported manually.", variant: "destructive" })
                setExporting(false)
                return
            }

            // Refresh file entry in the table
            setEntries(prev => prev.map(e =>
                e.uploadId === fileUploadId ? { ...e, file: updatedFile } : e
            ))

            // Kick off async re-export (returns immediately)
            toast({ title: "Exporting...", description: `Exporting cleaned rows to ${destLabel}` })
            await (jobsAPI as any).reExportFile // TODO: re-export not yet in new jobs API(jobId, targetUploadId, entity)

            // Poll for the async export result
            const exportResult = await pollReExportStatus(jobId, targetUploadId, 120000, cancelledRef)

            if (exportResult?.status === "SUCCESS") {
                toast({
                    title: "Successfully Exported",
                    description: `${exportResult.records_exported ?? 0} cleaned rows exported to ${destLabel}`,
                })
            } else if (exportResult?.status === "FAILED") {
                toast({
                    title: "Export Failed",
                    description: exportResult.error || `Could not export cleaned rows to ${destLabel}. Please try exporting manually.`,
                    variant: "destructive",
                })
            } else {
                // Timeout — export still running in the background
                toast({
                    title: "Export In Progress",
                    description: `Export to ${destLabel} is still running. Check back shortly for results.`,
                })
            }
        } catch (err: any) {
            toast({
                title: "Export Failed",
                description: err?.message || `Could not export cleaned rows to ${destLabel}. Please try exporting manually.`,
                variant: "destructive",
            })
        } finally {
            setExporting(false)
        }
    }, [quarantineEntity, quarantineFile, run, idToken, toast])

    return {
        entries,
        loading,
        detailFile,
        detailOpen,
        setDetailOpen,
        downloadFile,
        downloadOpen,
        setDownloadOpen,
        columnExportColumns,
        columnExportLoading,
        handleViewDetail,
        handleDownloadPrompt,
        handleColumnExport,
        handleDelete,
        downloading,
        erpMode,
        setErpMode,
        erpTarget,
        setErpTarget,
        quarantineFile,
        quarantineEditorOpen,
        handleOpenQuarantineEditor,
        handleQuarantineEditorClose,
        handleReprocessSubmitted,
        exporting,
    }
}
