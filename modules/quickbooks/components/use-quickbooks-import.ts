'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/modules/auth'
import quickBooksAPI, {
    QuickBooksConnectionStatus,
    QuickBooksImportResponse,
} from '@/modules/quickbooks/api/quickbooks-api'
import { fileManagementAPI, type FileStatusResponse } from '@/modules/files'
import { autoMapColumns, validateMapping } from './quickbooks-mapping-utils'

// ─── Types ────────────────────────────────────────────────────────
export interface QuickBooksFile {
    upload_id: string
    filename: string
    original_filename?: string
    status: string
    rows_clean?: number
    updated_at?: string
    status_timestamp?: string
}

export type QuickBooksEntity = 'customers' | 'invoices' | 'vendors' | 'items'

export interface QuickBooksConfig {
    entity: QuickBooksEntity
    dateFrom: string
    dateTo: string
    limit: number
}

export interface UseQuickBooksImportProps {
    mode?: 'source' | 'destination'
    uploadId?: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: 'success' | 'error') => void
    onPermissionDenied?: () => void
}

export const ENTITY_OPTIONS = [
    { value: 'customers', label: 'Customers' },
    { value: 'invoices', label: 'Invoices' },
    { value: 'vendors', label: 'Vendors' },
    { value: 'items', label: 'Items' },
]

// ─── Hook ─────────────────────────────────────────────────────────
export function useQuickBooksImport({
    mode,
    uploadId,
    onImportComplete,
    onNotification,
    onPermissionDenied,
}: UseQuickBooksImportProps) {
    const { idToken } = useAuth()
    const [connected, setConnected] = useState(false)
    const [connectionInfo, setConnectionInfo] = useState<QuickBooksConnectionStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [isImporting, setIsImporting] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [selectedFile, setSelectedFile] = useState<QuickBooksFile | null>(null)
    const [files, setFiles] = useState<QuickBooksFile[]>([])

    const [config, setConfig] = useState<QuickBooksConfig>({
        entity: 'invoices',
        dateFrom: '',
        dateTo: '',
        limit: 1000,
    })

    const [importResult, setImportResult] = useState<QuickBooksImportResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Column selection state
    const [columnModalOpen, setColumnModalOpen] = useState(false)
    const [availableColumns, setAvailableColumns] = useState<string[]>([])
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
    const [columnsLoading, setColumnsLoading] = useState(false)
    const [columnsError, setColumnsError] = useState<string | null>(null)

    // Column mapping state
    const [mappingOpen, setMappingOpen] = useState(false)
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

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
                updated_at: f.updated_at,
                status_timestamp: f.status_timestamp,
                root_upload_id: (f as any).root_upload_id || f.upload_id,
            }))

            // Deduplicate by version chain (root_upload_id): same root = same file lineage, keep latest.
            // Different roots with the same filename = separate files, both shown.
            const byRoot = new Map<string, typeof mappedFiles[0]>()
            for (const f of mappedFiles) {
                const key = f.root_upload_id
                const existing = byRoot.get(key)
                const fDate = new Date(f.updated_at || f.status_timestamp || 0).getTime()
                const exDate = new Date(existing?.updated_at || existing?.status_timestamp || 0).getTime()
                if (!existing || fDate > exDate) {
                    byRoot.set(key, f)
                }
            }
            setFiles(Array.from(byRoot.values()))
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
            const status = await quickBooksAPI.getConnectionStatus()
            setConnected(status.connected)
            setConnectionInfo(status)
        } catch (err) {
            console.error('Error checking connection:', err)
        } finally {
            setLoading(false)
        }
    }

    const connectQuickBooks = async () => {
        try {
            setError(null)
            const result = await quickBooksAPI.openOAuthPopup()

            if (result.success) {
                onNotification?.('QuickBooks connected successfully!', 'success')
                checkConnection()
            } else if (result.error) {
                setError(result.error)
                onNotification?.(`Connection failed: ${result.error}`, 'error')
            }
        } catch (err) {
            console.error('Error connecting QuickBooks:', err)
            const message = (err as Error).message || 'Failed to connect to QuickBooks'
            setError(message)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Failed to connect to QuickBooks', 'error')
            }
        }
    }

    const disconnectQuickBooks = async () => {
        if (!confirm('Are you sure you want to disconnect QuickBooks?')) return

        try {
            await quickBooksAPI.disconnect()
            setConnected(false)
            setConnectionInfo(null)
            onNotification?.('Disconnected from QuickBooks', 'success')
        } catch (err) {
            console.error('Error disconnecting QuickBooks:', err)
            const message = (err as Error).message
            setError(message)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Failed to disconnect from QuickBooks', 'error')
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
    const importFromQuickBooks = async () => {
        if (!connected) {
            setError('Please connect to QuickBooks first')
            return
        }

        if (!config.entity) {
            setError('Please select an entity to import')
            return
        }

        try {
            setIsImporting(true)
            setError(null)
            setImportResult(null)

            const filters: { limit: number; date_from?: string; date_to?: string } = {
                limit: config.limit,
            }

            if (config.dateFrom) filters.date_from = config.dateFrom
            if (config.dateTo) filters.date_to = config.dateTo

            const result = await quickBooksAPI.importData(config.entity, filters)
            setImportResult(result)
            onNotification?.(`Successfully imported ${result.records_imported} records!`, 'success')
            onImportComplete?.(result.upload_id)
        } catch (err) {
            console.error('Error importing data:', err)
            const message = (err as Error).message || 'Failed to import data'
            setError(message)
            if (!notifyPermissionDenied(err)) {
                onNotification?.('Import failed: ' + message, 'error')
            }
        } finally {
            setIsImporting(false)
        }
    }

    const exportToQuickBooks = async () => {
        if (!connected) {
            setError('Please connect to QuickBooks first')
            return
        }

        if (!selectedFile && !uploadId) {
            setError('Please select a file to export')
            return
        }

        if (!config.entity) {
            setError('Please select an entity to export')
            return
        }

        if (mode === 'destination') {
            const validation = validateMapping(config.entity, columnMapping, availableColumns)
            if (!validation.valid) {
                setError(validation.message)
                onNotification?.(validation.message || 'Please complete column mapping', 'error')
                setMappingOpen(true)
                return
            }
        }

        try {
            setIsExporting(true)
            setError(null)
            setImportResult(null)

            const fileId = selectedFile?.upload_id || uploadId

            if (!fileId) {
                setError('Please select a file to export')
                return
            }

            const result = await quickBooksAPI.exportToQuickBooks(fileId, config.entity, columnMapping)

            setImportResult({
                success: result.success,
                message: 'Successfully exported to QuickBooks',
                records_imported: result.records_exported || 0,
                filename: '',
                upload_id: fileId,
                entity: config.entity,
            })

            setColumnModalOpen(false)
            onNotification?.('Successfully exported to QuickBooks!', 'success')
        } catch (err) {
            console.error('Error exporting data:', err)
            const errorMsg = (err as Error).message || 'Failed to export data'

            let userMessage = 'Export failed: ' + errorMsg
            if (errorMsg.includes('NoSuchKey') || errorMsg.includes('does not exist')) {
                userMessage = 'The processed data for this file is not available. Please ensure the file has been processed successfully before exporting.'
            } else if (errorMsg.includes('Connection')) {
                userMessage = 'Connection to QuickBooks failed. Please reconnect and try again.'
            }

            setError(userMessage)
            if (!notifyPermissionDenied(err)) {
                onNotification?.(userMessage, 'error')
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
                event.data.type === 'quickbooks-auth-success' ||
                event.data.type === 'quickbooks-connection-updated'
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

    return {
        // Connection
        connected,
        connectionInfo,
        loading,
        connectQuickBooks,
        disconnectQuickBooks,
        // Config
        config,
        setConfig,
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
        error,
        setError,
        importFromQuickBooks,
        exportToQuickBooks,
    }
}
