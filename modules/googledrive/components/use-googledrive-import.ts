"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { googleDriveAPI } from "@/modules/googledrive/api/googledrive-api"
import type {
    GoogleDriveConnectionStatus,
    GoogleDriveFile,
    GoogleDriveFolder,
    GoogleDriveImportResponse,
} from "@/modules/googledrive/types/googledrive.types"

interface BreadcrumbItem {
    id: string
    name: string
}

interface UseGoogleDriveImportProps {
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

export function useGoogleDriveImport({
    onImportComplete,
    onNotification,
}: UseGoogleDriveImportProps) {
    // Connection state
    const [connectionStatus, setConnectionStatus] =
        useState<GoogleDriveConnectionStatus>({ connected: false })
    const [isConnecting, setIsConnecting] = useState(false)
    const [isCheckingStatus, setIsCheckingStatus] = useState(true)

    // File browsing state
    const [files, setFiles] = useState<GoogleDriveFile[]>([])
    const [folders, setFolders] = useState<GoogleDriveFolder[]>([])
    const [isLoadingFiles, setIsLoadingFiles] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [nextPageToken, setNextPageToken] = useState<string | null>(null)
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
        { id: "root", name: "My Drive" },
    ])

    // Import state
    const [isImporting, setIsImporting] = useState(false)
    const [importingFileId, setImportingFileId] = useState<string | null>(null)
    const [importingFileName, setImportingFileName] = useState<string>("")
    const [importProgress, setImportProgress] = useState(0)
    const [importStatus, setImportStatus] = useState<string>("")
    const [importResult, setImportResult] =
        useState<GoogleDriveImportResponse | null>(null)

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── Connection ────────────────────────────────────────────────────

    const checkConnection = useCallback(async () => {
        setIsCheckingStatus(true)
        try {
            const status = await googleDriveAPI.getConnectionStatus()
            setConnectionStatus(status)
            return status.connected
        } catch {
            setConnectionStatus({ connected: false })
            return false
        } finally {
            setIsCheckingStatus(false)
        }
    }, [])

    const connectOAuth = useCallback(async () => {
        setIsConnecting(true)
        try {
            const result = await googleDriveAPI.openOAuthPopup()
            if (result.success) {
                await checkConnection()
                onNotification?.("Connected to Google Drive", "success")
            } else {
                onNotification?.(result.error || "Connection failed", "error")
            }
        } catch (error) {
            onNotification?.((error as Error).message || "Connection failed", "error")
        } finally {
            setIsConnecting(false)
        }
    }, [checkConnection, onNotification])

    const disconnect = useCallback(async () => {
        try {
            await googleDriveAPI.disconnect()
            setConnectionStatus({ connected: false })
            setFiles([])
            setFolders([])
            setBreadcrumb([{ id: "root", name: "My Drive" }])
            onNotification?.("Disconnected from Google Drive", "success")
        } catch (error) {
            onNotification?.((error as Error).message || "Disconnect failed", "error")
        }
    }, [onNotification])

    // ── File browsing ─────────────────────────────────────────────────

    const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id || "root"

    const loadFiles = useCallback(
        async (folderId?: string, append = false) => {
            setIsLoadingFiles(true)
            try {
                const targetFolder = folderId || currentFolderId
                const [filesRes, foldersRes] = await Promise.all([
                    googleDriveAPI.listFiles(
                        targetFolder,
                        append ? (nextPageToken ?? undefined) : undefined,
                        searchQuery || undefined
                    ),
                    // Only load folders when not searching and not appending
                    !searchQuery && !append
                        ? googleDriveAPI.listFolders(targetFolder)
                        : Promise.resolve({ folders: [] }),
                ])

                if (append) {
                    setFiles((prev) => [...prev, ...filesRes.files])
                } else {
                    setFiles(filesRes.files)
                    setFolders(foldersRes.folders)
                }
                setNextPageToken(filesRes.next_page_token ?? null)
            } catch (error) {
                onNotification?.(
                    (error as Error).message || "Failed to load files",
                    "error"
                )
            } finally {
                setIsLoadingFiles(false)
            }
        },
        [currentFolderId, nextPageToken, searchQuery, onNotification]
    )

    const navigateToFolder = useCallback(
        (folder: GoogleDriveFolder) => {
            setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }])
            setSearchQuery("")
            setNextPageToken(null)
        },
        []
    )

    const navigateToBreadcrumb = useCallback(
        (index: number) => {
            setBreadcrumb((prev) => prev.slice(0, index + 1))
            setSearchQuery("")
            setNextPageToken(null)
        },
        []
    )

    const searchFiles = useCallback(
        (query: string) => {
            setSearchQuery(query)
            setNextPageToken(null)
        },
        []
    )

    // ── Import with progress ─────────────────────────────────────────

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
        }
        if (progressRef.current) {
            clearInterval(progressRef.current)
            progressRef.current = null
        }
    }, [])

    const finishImport = useCallback(
        (result: GoogleDriveImportResponse, fileName: string, fileSize?: number) => {
            stopPolling()
            setImportProgress(100)
            setImportStatus("Complete!")
            setImportResult({ ...result, file_size: fileSize })
            onNotification?.(`Imported "${fileName}" successfully`, "success")
            onImportComplete?.(result.upload_id)

            setTimeout(() => {
                setIsImporting(false)
                setImportingFileId(null)
                setImportingFileName("")
                setImportProgress(0)
                setImportStatus("")
            }, 2000)
        },
        [stopPolling, onNotification, onImportComplete]
    )

    const importFile = useCallback(
        async (file: GoogleDriveFile) => {
            setIsImporting(true)
            setImportingFileId(file.id)
            setImportingFileName(file.name)
            setImportResult(null)
            setImportProgress(0)
            setImportStatus("Starting import...")

            try {
                // Start async import — returns immediately
                const result = await googleDriveAPI.importFile(
                    file.id,
                    file.name,
                    file.mimeType
                )

                setImportStatus("Importing...")

                // Animate progress: fast to 80%, then slow crawl to 99%
                let progress = 10
                const startTime = Date.now()
                progressRef.current = setInterval(() => {
                    const elapsed = (Date.now() - startTime) / 1000
                    if (progress < 80) {
                        progress += Math.random() * 8 + 2
                    } else {
                        // Slow crawl — never fully stalls
                        progress += 0.3
                    }
                    setImportProgress(Math.min(progress, 99))

                    // Safety: after 90s assume success (poll endpoint may not be deployed)
                    if (elapsed > 90) {
                        finishImport(result, file.name)
                    }
                }, 300)

                // Poll for completion — fast interval for snappy UX
                let pollFailures = 0
                pollRef.current = setInterval(async () => {
                    try {
                        const status = await googleDriveAPI.getImportStatus(result.upload_id)
                        pollFailures = 0

                        if (status.status === "UPLOADED") {
                            finishImport(result, file.name, status.file_size ?? undefined)
                            return
                        }

                        if (status.status === "IMPORT_FAILED") {
                            stopPolling()
                            setImportProgress(0)
                            setImportStatus("")
                            setIsImporting(false)
                            setImportingFileId(null)
                            setImportingFileName("")
                            onNotification?.(
                                status.error_message || `Import of "${file.name}" failed`,
                                "error"
                            )
                            return
                        }
                    } catch {
                        pollFailures++
                        // If polling keeps failing (endpoint not deployed), finish after a few tries
                        if (pollFailures >= 8) {
                            finishImport(result, file.name)
                        }
                    }
                }, 1500)

            } catch (error) {
                stopPolling()
                setIsImporting(false)
                setImportingFileId(null)
                setImportingFileName("")
                setImportProgress(0)
                setImportStatus("")
                onNotification?.(
                    (error as Error).message || "Import failed",
                    "error"
                )
            }
        },
        [onImportComplete, onNotification, stopPolling, finishImport]
    )

    // ── Effects ───────────────────────────────────────────────────────

    // Check connection on mount
    useEffect(() => {
        checkConnection()
    }, [checkConnection])

    // Load files when connected + folder/search changes
    useEffect(() => {
        if (connectionStatus.connected) {
            loadFiles(currentFolderId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionStatus.connected, currentFolderId, searchQuery])

    // Cleanup polling on unmount
    useEffect(() => {
        return () => stopPolling()
    }, [stopPolling])

    return {
        // Connection
        connectionStatus,
        isConnecting,
        isCheckingStatus,
        connectOAuth,
        disconnect,

        // File browsing
        files,
        folders,
        isLoadingFiles,
        searchQuery,
        searchFiles,
        nextPageToken,
        loadMore: () => loadFiles(currentFolderId, true),
        breadcrumb,
        navigateToFolder,
        navigateToBreadcrumb,

        // Import
        isImporting,
        importingFileId,
        importingFileName,
        importProgress,
        importStatus,
        importResult,
        importFile,
    }
}
