"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import { storageConnectorsAPI } from "@/modules/connectors/api/storage-connectors-api"
import { mapErrorToToast } from "@/lib/error-toast"
import type {
    StorageConnectionStatus,
    StorageFile,
    StorageFileListResponse,
    StorageFoldersResponse,
    StorageImportResponse,
} from "@/modules/connectors/types"

/**
 * Build a user-facing message from an unknown error using the typed-error
 * mapper. If the mapper produces an actionable hint (Reconnect, Sign in, …)
 * we append it to the description so users without an action-aware toast UI
 * still get the guidance.
 */
function describeError(err: unknown, fallback: string): string {
    const desc = mapErrorToToast(err)
    const parts = [desc.title, desc.description].filter(
        (s) => !!s && s !== "Error",
    )
    const joined = parts.join(" — ")
    if (joined) {
        return desc.action ? `${joined} (Click ${desc.action.label})` : joined
    }
    return fallback
}

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
    // Chrome-style progress fields surfaced by FileRegistry-V3 (BE contract).
    // Read-only mirror of the latest poll response — drives ImportProgressCard.
    const [progressDetail, setProgressDetail] = useState<{
        importStatus: "downloading" | "uploading" | "completed" | "failed"
        bytesDownloaded: number
        bytesTotal: number
        startedAt: string
        updatedAt: string
        finishedAt?: string
        errorMessage?: string
    } | null>(null)
    // Sticky error message for the failure card so the FE can offer a retry.
    const [importError, setImportError] = useState<string | null>(null)

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Latest file the user clicked Import on; used by retryImport().
    const lastFileRef = useRef<StorageFile | null>(null)

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
            onNotification?.(describeError(error, "Connection failed"), "error")
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
            onNotification?.(describeError(error, "Disconnect failed"), "error")
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
                    describeError(error, "Failed to load files"),
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
            // Mark the chrome-card terminal so it shows the green ✓ + "took N s".
            setProgressDetail((prev) =>
                prev
                    ? {
                          ...prev,
                          importStatus: "completed",
                          bytesDownloaded: prev.bytesTotal || prev.bytesDownloaded,
                          finishedAt: new Date().toISOString(),
                      }
                    : prev
            )
            onNotification?.(`Imported "${fileName}" successfully`, "success")
            onImportComplete?.(result.upload_id)

            setTimeout(() => {
                setIsImporting(false)
                setImportingFileId(null)
                setImportingFileName("")
                setImportProgress(0)
                setImportStatus("")
                setProgressDetail(null)
                setImportError(null)
            }, 4000)
        },
        [stopPolling, onNotification, onImportComplete]
    )

    const importFile = useCallback(
        async (file: StorageFile) => {
            setIsImporting(true)
            setImportingFileId(file.id)
            setImportingFileName(file.name)
            setImportResult(null)
            setImportError(null)
            setImportProgress(0)
            setImportStatus("Starting import...")
            lastFileRef.current = file
            // Seed the Chrome card immediately so the user sees the row appear
            // before the first poll lands.
            setProgressDetail({
                importStatus: "downloading",
                bytesDownloaded: 0,
                bytesTotal: file.size ?? 0,
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })

            try {
                // Start async import — returns immediately
                const result = await storageConnectorsAPI.importFile(
                    provider,
                    file.id,
                )

                setImportStatus("Importing...")
                setImportProgress(2)

                // Known file size from storage provider metadata (bytes).
                const expectedSize = file.size ?? 0

                let pollFailures = 0
                pollRef.current = setInterval(async () => {
                    try {
                        const status = await storageConnectorsAPI.getImportStatus(provider, result.upload_id)
                        pollFailures = 0

                        // ── Chrome-style progress (FileRegistry-V3 contract) ──
                        // Prefer the unified bytes_downloaded/bytes_total pair;
                        // fall back to the legacy bytes_transferred for back-compat
                        // until the BE rolls out fully.
                        const beImportStatus = status.import_status
                        const bytesDownloaded =
                            typeof status.bytes_downloaded === "number"
                                ? status.bytes_downloaded
                                : typeof status.bytes_transferred === "number"
                                    ? status.bytes_transferred
                                    : 0
                        const bytesTotal =
                            typeof status.bytes_total === "number" && status.bytes_total > 0
                                ? status.bytes_total
                                : typeof status.file_size === "number" && status.file_size > 0
                                    ? status.file_size
                                    : expectedSize

                        // Map legacy status if BE hasn't shipped import_status yet.
                        const inferredImportStatus: "downloading" | "uploading" | "completed" | "failed" =
                            beImportStatus
                                ?? (status.status === "UPLOADED" ? "completed"
                                : status.status === "IMPORT_FAILED" ? "failed"
                                : "downloading")

                        setProgressDetail({
                            importStatus: inferredImportStatus,
                            bytesDownloaded,
                            bytesTotal,
                            startedAt: status.download_started_at ?? new Date().toISOString(),
                            updatedAt: status.download_updated_at ?? new Date().toISOString(),
                            finishedAt: status.download_finished_at,
                            errorMessage: status.error_message,
                        })

                        // Maintain the legacy 0–100 bar for any callsites that
                        // still consume `importProgress` directly.
                        if (bytesTotal > 0) {
                            const realPct = Math.min((bytesDownloaded / bytesTotal) * 100, 99)
                            setImportProgress(realPct)
                            const mb = (bytesDownloaded / (1024 * 1024)).toFixed(0)
                            const totalMb = (bytesTotal / (1024 * 1024)).toFixed(0)
                            setImportStatus(`Importing... ${mb} MB / ${totalMb} MB`)
                        } else if (bytesDownloaded > 0) {
                            const mb = (bytesDownloaded / (1024 * 1024)).toFixed(0)
                            setImportStatus(`Importing... ${mb} MB transferred`)
                        }

                        if (status.status === "UPLOADED" || inferredImportStatus === "completed") {
                            finishImport(result, file.name, status.file_size ?? undefined)
                            return
                        }

                        if (status.status === "IMPORT_FAILED" || inferredImportStatus === "failed") {
                            stopPolling()
                            const errMsg = status.error_message || `Import of "${file.name}" failed`
                            setImportError(errMsg)
                            setProgressDetail((prev) =>
                                prev
                                    ? {
                                          ...prev,
                                          importStatus: "failed",
                                          finishedAt: new Date().toISOString(),
                                          errorMessage: errMsg,
                                      }
                                    : prev
                            )
                            // Leave the card visible so the user can hit Retry; clear
                            // legacy state so the old bar doesn't double up.
                            setImportProgress(0)
                            setImportStatus("")
                            onNotification?.(errMsg, "error")
                            return
                        }
                    } catch {
                        pollFailures++
                        if (pollFailures >= 20) {
                            finishImport(result, file.name)
                        }
                        // No fake-progress on transient poll errors — the chrome
                        // card's last-known bytes stay put until the next success.
                    }
                }, 1500)

            } catch (error) {
                stopPolling()
                const errMsg = describeError(error, "Import failed")
                setImportError(errMsg)
                setProgressDetail((prev) =>
                    prev
                        ? { ...prev, importStatus: "failed", errorMessage: errMsg }
                        : {
                              importStatus: "failed",
                              bytesDownloaded: 0,
                              bytesTotal: file.size ?? 0,
                              startedAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              finishedAt: new Date().toISOString(),
                              errorMessage: errMsg,
                          }
                )
                setImportProgress(0)
                setImportStatus("")
                onNotification?.(errMsg, "error")
            }
        },
        [provider, onImportComplete, onNotification, stopPolling, finishImport]
    )

    const cancelImport = useCallback(() => {
        stopPolling()
        setIsImporting(false)
        setImportingFileId(null)
        setImportingFileName("")
        setImportProgress(0)
        setImportStatus("")
        setProgressDetail(null)
        setImportError(null)
    }, [stopPolling])

    const retryImport = useCallback(() => {
        if (lastFileRef.current) {
            void importFile(lastFileRef.current)
        }
    }, [importFile])

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
        // Chrome-download-tray progress card (preferred over importProgress).
        progressDetail,
        importError,
        cancelImport,
        retryImport,
    }
}
