'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth'
import zohoBooksAPI, {
    ZohoBooksConnectionStatus,
    ZohoBooksExportStatusResponse,
    ZohoBooksImportResponse,
} from '@/modules/zoho/api/zoho-books-api'
import { fileManagementAPI, type FileStatusResponse } from '@/modules/files'
import { autoMapColumns, validateMapping } from './zoho-mapping-utils'

// ─── Types ────────────────────────────────────────────────────────
export interface ZohoFile {
    upload_id: string
    filename: string
    original_filename?: string
    status: string
    rows_clean?: number
    created_at?: string
    updated_at?: string
    status_timestamp?: string
}

export interface ZohoImportConfig {
    entity:
    | 'contacts'
    | 'items'
    | 'invoices'
    | 'customers'
    | 'vendors'
    | 'sales_orders'
    | 'purchase_orders'
    | 'inventory_items'
    dateFrom: string
    dateTo: string
    limit: number
    fetchAll: boolean
}

export interface ExportSummary {
    success_count: number
    failed_count: number
    total_records: number
    errors: string[]
}

export interface UseZohoImportProps {
    mode?: 'source' | 'destination'
    uploadId?: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: 'success' | 'error') => void
    onPermissionDenied?: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useZohoImport({
    mode,
    uploadId,
    onImportComplete,
    onNotification,
    onPermissionDenied,
}: UseZohoImportProps) {
    const { idToken } = useAuth()
    const [connected, setConnected] = useState(false)
    const [connectionInfo, setConnectionInfo] = useState<ZohoBooksConnectionStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [isImporting, setIsImporting] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [selectedFile, setSelectedFile] = useState<ZohoFile | null>(null)
    const [files, setFiles] = useState<ZohoFile[]>([])

    const [config, setConfig] = useState<ZohoImportConfig>({
        entity: 'contacts',
        dateFrom: '',
        dateTo: '',
        limit: 200,
        fetchAll: false,
    })

    const [importResult, setImportResult] = useState<ZohoBooksImportResponse | null>(null)
    const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [columnModalOpen, setColumnModalOpen] = useState(false)
    const [availableColumns, setAvailableColumns] = useState<string[]>([])
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
    const [columnsLoading, setColumnsLoading] = useState(false)
    const [columnsError, setColumnsError] = useState<string | null>(null)
    const [mappingOpen, setMappingOpen] = useState(false)
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
    const [orgIdInput, setOrgIdInput] = useState('')

    // ─── Internal helpers ─────────────────────────────────────────
    const isPermissionError = (err: unknown) =>
        ((err as Error)?.message || '').toLowerCase().includes('permission denied') ||
        ((err as Error)?.message || '').toLowerCase().includes('forbidden')

    const notifyPermissionDenied = (err: unknown) => {
        if (isPermissionError(err)) {
            onPermissionDenied?.()
            return true
        }
        return false
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const getUserId = () => {
        if (!idToken) return null
        try {
            const payload = idToken.split('.')[1]
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
            return decoded.sub || decoded.user_id || null
        } catch {
            return null
        }
    }

    const waitForZohoExportCompletion = async (
        fileId: string,
        maxAttempts: number = 40,
        intervalMs: number = 1500
    ): Promise<ZohoBooksExportStatusResponse | null> => {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const status = await zohoBooksAPI.getExportStatus(fileId)
            if (status.status === 'completed' || status.status === 'failed') {
                return status
            }
            await sleep(intervalMs)
        }
        return null
    }

    // ─── Data loaders ─────────────────────────────────────────────
    const loadFiles = async () => {
        if (!idToken) return

        try {
            const response = await fileManagementAPI.getUploads(idToken)
            const uploadedFiles = response.items || []
            const mappedFiles = uploadedFiles.map((f: FileStatusResponse) => ({
                upload_id: f.upload_id,
                filename: f.filename || '',
                original_filename: f.original_filename,
                status: f.status,
                rows_clean: f.rows_clean,
                created_at: f.created_at,
                root_upload_id: (f as any).root_upload_id || f.upload_id,
            }))

            // Deduplicate by version chain (root_upload_id): same root = same file lineage, keep latest.
            // Different roots with the same filename = separate files, both shown.
            const byRoot = new Map<string, typeof mappedFiles[0]>()
            for (const f of mappedFiles) {
                const key = f.root_upload_id
                const existing = byRoot.get(key)
                if (!existing || new Date(f.created_at || 0) > new Date(existing.created_at || 0)) {
                    byRoot.set(key, f)
                }
            }
            const dedupedFiles = Array.from(byRoot.values())

            dedupedFiles.sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime()
                const dateB = new Date(b.created_at || 0).getTime()
                return dateB - dateA
            })

            setFiles(dedupedFiles)
        } catch (err: any) {
            const message = (err?.message || '').toLowerCase()
            if (message.includes('permission denied') || message.includes('forbidden')) {
                onPermissionDenied?.()
            } else {
                console.warn('Failed to load files.')
            }
            setFiles([])
        }
    }

    // ─── Connection handlers ──────────────────────────────────────
    const checkConnection = async () => {
        try {
            setLoading(true)
            const status = await zohoBooksAPI.getConnectionStatus()
            setConnected(status.connected)
            setConnectionInfo(status)
            const uid = getUserId()
            if (uid) {
                const stored = localStorage.getItem(`zoho_org_id:${uid}`)
                setOrgIdInput(status.org_id || stored || '')
            } else {
                setOrgIdInput(status.org_id || '')
            }
        } catch (err) {
            console.error('Error checking connection:', err)
        } finally {
            setLoading(false)
        }
    }

    const connectZoho = async () => {
        try {
            setError(null)
            setExportSummary(null)
            const result = await zohoBooksAPI.openOAuthPopup()

            if (result.success) {
                onNotification?.('Zoho Books connected successfully!', 'success')
                checkConnection()
            } else {
                throw new Error(result.error || 'Failed to connect to Zoho Books')
            }
        } catch (err) {
            console.error('Error connecting Zoho Books:', err)
            const message = (err as Error).message || 'Failed to connect to Zoho Books'
            setError(message)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Failed to connect to Zoho Books', 'error')
            }
        }
    }

    const disconnectZoho = async () => {
        if (!confirm('Are you sure you want to disconnect Zoho Books?')) return

        try {
            await zohoBooksAPI.disconnect()
            setConnected(false)
            setConnectionInfo(null)
            onNotification?.('Disconnected from Zoho Books', 'success')
        } catch (err) {
            console.error('Error disconnecting Zoho Books:', err)
            const message = (err as Error).message || 'Failed to disconnect from Zoho Books'
            setError(message)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Failed to disconnect from Zoho Books', 'error')
            }
        }
    }

    // ─── Column & file handlers ───────────────────────────────────
    const handleFileSelect = async (fileUploadId: string) => {
        const file = files.find((f) => f.upload_id === fileUploadId)
        if (!file) return

        setSelectedFile(file)

        if (mode === 'destination' && idToken) {
            setColumnModalOpen(true)
            setColumnsLoading(true)
            setColumnsError(null)

            try {
                const resp = await fileManagementAPI.getFileColumns(fileUploadId, idToken)
                const cols = resp.columns || []
                setAvailableColumns(cols)
                setSelectedColumns(new Set(cols))
                setColumnMapping(autoMapColumns(config.entity, cols))

                if (cols.length === 0) {
                    setColumnsError('No columns detected for this file. You can still proceed.')
                }
            } catch (err) {
                if (!notifyPermissionDenied(err)) {
                    console.error('Failed to fetch columns:', err)
                }
                setAvailableColumns([])
                setSelectedColumns(new Set())
                setColumnsError('Unable to fetch columns. You can proceed without column selection.')
            } finally {
                setColumnsLoading(false)
            }
        }
    }

    const handleToggleColumn = (col: string, checked: boolean) => {
        setSelectedColumns((prev) => {
            const next = new Set(prev)
            if (checked) {
                next.add(col)
            } else {
                next.delete(col)
            }
            return next
        })
    }

    const handleToggleAllColumns = (checked: boolean) => {
        setSelectedColumns(checked ? new Set(availableColumns) : new Set())
    }

    // ─── Import / Export ──────────────────────────────────────────
    const importFromZoho = async () => {
        if (!connected) {
            setError('Please connect to Zoho Books first')
            return
        }

        try {
            setIsImporting(true)
            setError(null)
            setImportResult(null)

            const filters: Record<string, any> = {
                limit: config.limit,
                page: 1,
                all: config.fetchAll,
            }
            if (config.entity === 'invoices') {
                if (config.dateFrom) filters.date_from = config.dateFrom
                if (config.dateTo) filters.date_to = config.dateTo
            }

            const result = await zohoBooksAPI.importData(
                config.entity,
                filters,
                orgIdInput || connectionInfo?.org_id
            )
            setImportResult(result)
            onImportComplete?.(result.upload_id)
            onNotification?.('Zoho Books import completed', 'success')
        } catch (err) {
            console.error('Zoho Books import error:', err)
            const message = (err as Error).message || 'Failed to import from Zoho Books'
            setError(message)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Failed to import from Zoho Books', 'error')
            }
        } finally {
            setIsImporting(false)
        }
    }

    const exportToZoho = async () => {
        if (!connected) {
            setError('Please connect to Zoho Books first')
            return
        }

        if (mode === 'destination') {
            const validation = validateMapping(config.entity, columnMapping, availableColumns)
            if (!validation.valid) {
                setError(validation.message)
                onNotification?.(validation.message || 'Please complete mapping', 'error')
                setMappingOpen(true)
                return
            }
        }

        try {
            setIsExporting(true)
            setError(null)
            const fileId = uploadId || selectedFile?.upload_id
            if (!fileId) {
                setError('Please select a file to export')
                return
            }

            const result = await zohoBooksAPI.exportToZoho(
                fileId,
                config.entity,
                orgIdInput || connectionInfo?.org_id,
                columnMapping
            )

            if (result.status === 'processing') {
                const finalStatus = await waitForZohoExportCompletion(fileId)
                if (!finalStatus) {
                    throw new Error('Zoho export is still processing. Please refresh in a moment.')
                }
                if (finalStatus.status === 'failed') {
                    throw new Error(finalStatus.error || finalStatus.message || 'Zoho export failed')
                }

                const finalSuccess = finalStatus.success_count || 0
                const finalFailed = finalStatus.failed_count || 0
                const finalTotal = finalStatus.total_count ?? (finalSuccess + finalFailed)
                setExportSummary({
                    success_count: finalSuccess,
                    failed_count: finalFailed,
                    total_records: finalTotal,
                    errors: [],
                })

                onNotification?.(
                    `Exported ${finalSuccess} records to Zoho Books (${finalFailed} failed).`,
                    'success'
                )
            } else {
                const errors = (result.results || [])
                    .filter((r) => r.status === 'failed' && r.error)
                    .slice(0, 5)
                    .map((r) => r.error as string)
                const successCount = result.success_count || 0
                const failedCount = result.failed_count || 0
                const totalRecords = result.total_records ?? result.total_count ?? (successCount + failedCount)
                setExportSummary({
                    success_count: successCount,
                    failed_count: failedCount,
                    total_records: totalRecords,
                    errors,
                })

                onNotification?.(
                    `Exported ${successCount} records to Zoho Books (${failedCount} failed).`,
                    'success'
                )
            }

            if (onImportComplete) {
                onImportComplete(fileId)
            }
        } catch (err) {
            console.error('Zoho Books export error:', err)
            const message = (err as Error).message || 'Failed to export to Zoho Books'
            setError(message)
            setExportSummary(null)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Failed to export to Zoho Books', 'error')
            }
        } finally {
            setIsExporting(false)
        }
    }

    // ─── Effects ──────────────────────────────────────────────────
    useEffect(() => {
        if (mode === 'destination' && idToken) {
            loadFiles()
        }
    }, [mode, idToken])

    useEffect(() => {
        checkConnection()

        const messageHandler = (event: MessageEvent) => {
            if (
                event.data.type === 'zoho-books-auth-success' ||
                event.data.type === 'zoho-books-connection-updated'
            ) {
                setTimeout(() => checkConnection(), 500)
            }
        }

        const visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                checkConnection()
            }
        }

        window.addEventListener('message', messageHandler)
        document.addEventListener('visibilitychange', visibilityHandler)

        return () => {
            window.removeEventListener('message', messageHandler)
            document.removeEventListener('visibilitychange', visibilityHandler)
        }
    }, [])

    // ─── Org ID persistence ───────────────────────────────────────
    const handleOrgIdChange = (value: string) => {
        const trimmed = value.trim()
        setOrgIdInput(trimmed)
        const uid = getUserId()
        if (uid) {
            localStorage.setItem(`zoho_org_id:${uid}`, trimmed)
        }
    }

    return {
        // Connection
        connected,
        connectionInfo,
        loading,
        connectZoho,
        disconnectZoho,
        // Config
        config,
        setConfig,
        orgIdInput,
        handleOrgIdChange,
        // Files & columns
        files,
        selectedFile,
        handleFileSelect,
        columnModalOpen,
        setColumnModalOpen,
        availableColumns,
        selectedColumns,
        columnsLoading,
        columnsError,
        handleToggleColumn,
        handleToggleAllColumns,
        // Mapping
        mappingOpen,
        setMappingOpen,
        columnMapping,
        setColumnMapping,
        // Import / Export
        isImporting,
        isExporting,
        importResult,
        exportSummary,
        error,
        setError,
        importFromZoho,
        exportToZoho,
    }
}
