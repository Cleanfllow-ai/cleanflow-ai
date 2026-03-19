"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import { storageConnectorsAPI } from "@/modules/connectors/api/storage-connectors-api"
import type {
    StorageConnectionStatus,
    StorageFile,
    StorageFileListResponse,
    StorageFoldersResponse,
    StorageImportResponse,
} from "@/modules/connectors/types"

interface BreadcrumbItem {
    id: string
    name: string
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    googledrive: "Google Drive",
    onedrive: "OneDrive",
    dropbox: "Dropbox",
}

function getProviderDisplayName(provider: string): string {
    return PROVIDER_DISPLAY_NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
}

interface UseStorageImportProps {
    provider: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

export function useStorageImport({
    provider,
    onImportComplete,
    onNotification,
}: UseStorageImportProps) {
    const providerDisplayName = getProviderDisplayName(provider)

    // Connection state
    const [connectionStatus, setConnectionStatus] =
        useState<StorageConnectionStatus>({ connected: false })
    const [isConnecting, setIsConnecting] = useState(false)
    const [isCheckingStatus, setIsCheckingStatus] = useState(true)

    // File browsing state
    const [files, setFiles] = useState<StorageFile[]>([])
    const [folders, setFolders] = useState<{ id: string; name: string }[]>([])
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
        useState<StorageImportResponse | null>(null)

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── Connection ────────────────────────────────────────────────────

    const checkConnection = useCallback(async () => {
        setIsCheckingStatus(true)
        try {
            const status = await connectorsAPI.getConnectionStatus(provider)
            setConnectionStatus(status)
            return status.connected
        } catch {
            setConnectionStatus({ connected: false })
            return false
        } finally {
            setIsCheckingStatus(false)
        }
    }, [provider])

    const connectOAuth = useCallback(async () => {
        setIsConnecting(true)
        try {
            const result = await connectorsAPI.openOAuthPopupForProvider(provider)
            if (result.success) {
                await checkConnection()
                onNotification?.(`Connected to ${providerDisplayName}`, "success")
            } else {
                onNotification?.(result.error || "Connection failed", "error")
            }
        } catch (error) {
            onNotification?.((error as Error).message || "Connection failed", "error")
        } finally {
            setIsConnecting(false)
        }
    }, [provider, providerDisplayName, checkConnection, onNotification])

    const disconnect = useCallback(async () => {
        try {
            await connectorsAPI.disconnect(provider)
            setConnectionStatus({ connected: false })
            setFiles([])
            setFolders([])
            setBreadcrumb([{ id: "root", name: "My Drive" }])
            onNotification?.(`Disconnected from ${providerDisplayName}`, "success")
        } catch (error) {
            onNotification?.((error as Error).message || "Disconnect failed", "error")
        }
    }, [provider, providerDisplayName, onNotification])

    // ── File browsing ─────────────────────────────────────────────────

    const currentFolderId = breadcrumb[breadcrumb.length - 1]?.id || "root"

    const loadFiles = useCallback(
        async (folderId?: string, append = false) => {
            setIsLoadingFiles(true)
            try {
                const targetFolder = folderId || currentFolderId
                const [filesRes, foldersRes] = await Promise.all([
                    storageConnectorsAPI.listFiles(
                        provider,
                        targetFolder,
                        append ? (nextPageToken ?? undefined) : undefined,
                        searchQuery || undefined
                    ),
                    // Only load folders when not searching and not appending
                    !searchQuery && !append
                        ? storageConnectorsAPI.listFolders(provider, targetFolder)
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
        [provider, currentFolderId, nextPageToken, searchQuery, onNotification]
    )

    const navigateToFolder = useCallback(
        (folder: { id: string; name: string }) => {
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
        (result: StorageImportResponse, fileName: string, fileSize?: number) => {
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
        async (file: StorageFile) => {
            setIsImporting(true)
            setImportingFileId(file.id)
            setImportingFileName(file.name)
            setImportResult(null)
            setImportProgress(0)
            setImportStatus("Starting import...")

            try {
                // Start async import — returns immediately
                const result = await storageConnectorsAPI.importFile(
                    provider,
                    file.id,
                )

                setImportStatus("Importing...")
                setImportProgress(1)

                // Known file size from storage provider metadata (bytes)
                const expectedSize = file.size ?? 0

                // Poll for real progress from backend
                // TODO: import status polling not yet available in unified connectors API
                let pollFailures = 0
                pollRef.current = setInterval(async () => {
                    try {
                        const status = await storageConnectorsAPI.getImportStatus(provider, result.upload_id)
                        pollFailures = 0

                        // Real progress from bytes_transferred
                        if (status.bytes_transferred && expectedSize > 0) {
                            const pct = Math.min((status.bytes_transferred / expectedSize) * 100, 99)
                            setImportProgress(pct)
                            const mb = (status.bytes_transferred / (1024 * 1024)).toFixed(0)
                            const totalMb = (expectedSize / (1024 * 1024)).toFixed(0)
                            setImportStatus(`Importing... ${mb} MB / ${totalMb} MB`)
                        } else if (status.bytes_transferred) {
                            // No expected size — show bytes only
                            const mb = (status.bytes_transferred / (1024 * 1024)).toFixed(0)
                            setImportStatus(`Importing... ${mb} MB transferred`)
                        }

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
                        if (pollFailures >= 20) {
                            finishImport(result, file.name)
                        }
                    }
                }, 2000)

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
        [provider, onImportComplete, onNotification, stopPolling, finishImport]
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
        // Provider
        providerDisplayName,

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
