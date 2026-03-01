"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/modules/auth"
import { fileManagementAPI } from "@/modules/files/api/file-management-api"
import type { FileStatusResponse } from "@/modules/files/types"
import type { JobRun } from "@/modules/jobs/types/jobs.types"

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
    handleOpenQuarantineEditor: (file: FileStatusResponse) => void
    handleQuarantineEditorClose: () => void
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

export function useJobRunFiles(run: JobRun | null, open: boolean): JobRunFilesState {
    const { idToken } = useAuth()
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

    useEffect(() => {
        if (!open || !run || !idToken) {
            setEntries([])
            return
        }

        const entityResults = run.entity_results || {}
        const entityEntries = Object.entries(entityResults)
            .filter(([, result]) => result.upload_id)
            .map(([entity, result]) => ({
                entity,
                uploadId: result.upload_id!,
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
            const baseFilename = (downloadFile.original_filename || downloadFile.filename || "file").replace(/\.[^/.]+$/, "")
            const extension = options.format === "excel" ? ".xlsx" : options.format === "json" ? ".json" : ".csv"
            const filename = `${baseFilename}_export${extension}`
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

    const handleOpenQuarantineEditor = useCallback((file: FileStatusResponse) => {
        setQuarantineFile(file)
        setQuarantineEditorOpen(true)
    }, [])

    const handleQuarantineEditorClose = useCallback(async () => {
        const closingFile = quarantineFile
        setQuarantineEditorOpen(false)
        setQuarantineFile(null)
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
    }
}
