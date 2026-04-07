"use client"

import { useState, useCallback, useEffect } from "react"
import { useAuth } from "@/modules/auth"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import { warehouseConnectorsAPI } from "@/modules/connectors/api/warehouse-connectors-api"
import { fileManagementAPI, type FileStatusResponse } from "@/modules/files"
import type { WarehouseConnectionStatus, WarehouseMetadataItem } from "@/modules/connectors/types"
import type { WarehouseImportResponse, WarehouseExportResponse } from "@/modules/connectors/api/warehouse-connectors-api"
import { autoMapColumns } from "./warehouse-mapping-utils"
import { filterDQColumns } from "@/modules/files/utils/dq-columns"
import { ensureConnectorConfig } from "@/modules/connectors/hooks/use-connector-metadata-cache"

// ─── Types ────────────────────────────────────────────────────────

export interface WarehouseFile {
    upload_id: string
    filename: string
    original_filename?: string
    status: string
    rows_clean?: number
    updated_at?: string
    status_timestamp?: string
}

/** Destination mode: "" = not yet selected, "new" = create new table, "existing" = existing table */
export type DestinationMode = "" | "new" | "existing"

interface UseWarehouseImportProps {
    provider: string
    mode?: "source" | "destination"
    uploadId?: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useWarehouseImport({
    provider,
    mode = "source",
    uploadId,
    onImportComplete,
    onNotification,
}: UseWarehouseImportProps) {
    const { idToken } = useAuth()

    const providerDisplayName = provider.charAt(0).toUpperCase() + provider.slice(1)

    // Connection state
    const [connectionStatus, setConnectionStatus] =
        useState<WarehouseConnectionStatus>({ connected: false })
    const [isConnecting, setIsConnecting] = useState(false)
    const [isCheckingStatus, setIsCheckingStatus] = useState(false)

    // Import — metadata state (warehouse/database come from admin config)
    const [schemas, setSchemas] = useState<WarehouseMetadataItem[]>([])
    const [tables, setTables] = useState<WarehouseMetadataItem[]>([])
    const [metadataLoading, setMetadataLoading] = useState(false)

    // Admin-configured warehouse/database (read-only from connector config)
    const [configuredWarehouse, setConfiguredWarehouse] = useState("")
    const [configuredDatabase, setConfiguredDatabase] = useState("")
    const [configMissing, setConfigMissing] = useState(false)

    // Import — selection state (only schema/table are user-selectable)
    const [selectedSchema, setSelectedSchema] = useState("")
    const [selectedTable, setSelectedTable] = useState("")
    const [importLimit, setImportLimit] = useState(10000)

    // Import state
    const [isImporting, setIsImporting] = useState(false)
    const [importResult, setImportResult] =
        useState<WarehouseImportResponse | null>(null)

    // Export — file management
    const [files, setFiles] = useState<WarehouseFile[]>([])
    const [selectedFile, setSelectedFile] = useState<WarehouseFile | null>(null)

    // Export — destination: new table vs existing table
    const [destinationMode, setDestinationMode] = useState<DestinationMode>("")
    const [newTableName, setNewTableName] = useState("")
    const [selectedExistingTable, setSelectedExistingTable] = useState("")

    // Export — columns & mapping
    const [availableColumns, setAvailableColumns] = useState<string[]>([])
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
    const [columnsLoading, setColumnsLoading] = useState(false)
    const [columnsError, setColumnsError] = useState<string | null>(null)
    const [columnModalOpen, setColumnModalOpen] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

    // Export — target table columns (fetched from warehouse for existing tables)
    const [targetTableColumns, setTargetTableColumns] = useState<string[]>([])
    const [targetColumnsLoading, setTargetColumnsLoading] = useState(false)

    // Export — config (always merge to prevent duplicates)
    const exportWriteMode = "merge" as const
    const [isExporting, setIsExporting] = useState(false)
    const [exportResult, setExportResult] =
        useState<WarehouseExportResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    // ─── Connection ───────────────────────────────────────────────────────

    const checkConnection = useCallback(async () => {
        setIsCheckingStatus(true)
        try {
            const rawStatus = await connectorsAPI.getConnectionStatus(provider)
            const status = rawStatus as WarehouseConnectionStatus
            setConnectionStatus(status)

            // Schema: provisioned default
            if (status.connected && status.sf_provisioned && status.sf_user_schema) {
                setSelectedSchema((prev) => prev || status.sf_user_schema!)
            }

            return status.connected
        } catch {
            setConnectionStatus({ connected: false })
            return false
        } finally {
            setIsCheckingStatus(false)
        }
    }, [provider])

    const loadMetadata = useCallback(async () => {
        setMetadataLoading(true)
        try {
            // Load warehouse/database from admin connector config
            const config = await ensureConnectorConfig(provider)
            const wh = config.warehouse || ""
            const db = config.database || ""
            setConfiguredWarehouse(wh)
            setConfiguredDatabase(db)

            if (!wh && !db) {
                setConfigMissing(true)
                return
            }
            setConfigMissing(false)

            // Load schemas using the configured database
            if (db) {
                const schemaItems = await warehouseConnectorsAPI.listSchemas(provider, db)
                    .catch(() => [] as WarehouseMetadataItem[])
                setSchemas(schemaItems)
            }

            if (db && selectedSchema) {
                const tbl = await warehouseConnectorsAPI.listTables(provider, db, selectedSchema)
                    .catch(() => [] as WarehouseMetadataItem[])
                setTables(tbl)
            }
        } catch (error) {
            console.error("Failed to load metadata:", error)
            onNotification?.(
                `Failed to load ${providerDisplayName} metadata. Please check your connection.`,
                "error"
            )
        } finally {
            setMetadataLoading(false)
        }
    }, [provider, providerDisplayName, onNotification, selectedSchema])

    const connectOAuth = useCallback(async () => {
        setIsConnecting(true)
        try {
            const result = await connectorsAPI.openOAuthPopupForProvider(provider)
            if (result.success) {
                onNotification?.(`Connected to ${providerDisplayName}!`, "success")
                const connected = await checkConnection()
                if (connected) {
                    loadMetadata()
                }
            } else {
                onNotification?.(result.error || "Connection failed", "error")
            }
        } catch (error) {
            onNotification?.(
                (error as Error).message || "Connection failed",
                "error"
            )
        } finally {
            setIsConnecting(false)
        }
    }, [provider, providerDisplayName, checkConnection, onNotification, loadMetadata])

    const disconnect = useCallback(async () => {
        try {
            await connectorsAPI.disconnect(provider)
            setConnectionStatus({ connected: false })
            setSchemas([])
            setTables([])
            setConfiguredWarehouse("")
            setConfiguredDatabase("")
            setConfigMissing(false)
            setSelectedSchema("")
            setSelectedTable("")
            setSelectedFile(null)
            onNotification?.(`Disconnected from ${providerDisplayName}`, "success")
        } catch (error) {
            onNotification?.(
                (error as Error).message || "Disconnect failed",
                "error"
            )
        }
    }, [provider, providerDisplayName, onNotification])

    // ─── Metadata loading ─────────────────────────────────────────────────

    const loadTables = useCallback(async (database: string, schema: string) => {
        if (!database || !schema) return
        setTables([])
        setSelectedTable("")
        try {
            const items = await warehouseConnectorsAPI.listTables(provider, database, schema)
            setTables(items)
        } catch (error) {
            console.error("Failed to load tables:", error)
        }
    }, [provider])

    // Load schemas when configuredDatabase changes
    useEffect(() => {
        if (!configuredDatabase) return
        setSchemas([])
        setSelectedSchema("")
        setSelectedTable("")
        warehouseConnectorsAPI.listSchemas(provider, configuredDatabase)
            .then(items => setSchemas(items))
            .catch(() => setSchemas([]))
    }, [provider, configuredDatabase])

    // Load tables when schema changes
    useEffect(() => {
        if (configuredDatabase && selectedSchema) {
            loadTables(configuredDatabase, selectedSchema)
        }
    }, [configuredDatabase, selectedSchema, loadTables])

    // Load metadata on mount if already connected
    useEffect(() => {
        checkConnection().then((connected) => {
            if (connected) {
                loadMetadata()
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ─── Fetch existing table columns when an existing table is selected ──

    useEffect(() => {
        if (destinationMode !== "existing" || !selectedExistingTable || !configuredDatabase || !selectedSchema) {
            setTargetTableColumns([])
            setColumnMapping({})
            return
        }
        let cancelled = false
        setTargetColumnsLoading(true)
        warehouseConnectorsAPI
            .getTableColumns(provider, configuredDatabase, selectedSchema, selectedExistingTable)
            .then((cols) => {
                if (cancelled) return
                const names = cols.map((c) => c.name)
                setTargetTableColumns(names)
                // Auto-map file columns to target table columns
                if (availableColumns.length > 0) {
                    setColumnMapping(autoMapColumns(names, availableColumns))
                }
            })
            .catch((err) => {
                if (cancelled) return
                console.error("Failed to fetch table columns:", err)
                setTargetTableColumns([])
            })
            .finally(() => {
                if (!cancelled) setTargetColumnsLoading(false)
            })
        return () => { cancelled = true }
    }, [provider, destinationMode, selectedExistingTable, configuredDatabase, selectedSchema, availableColumns])

    // ─── File management (export) ──────────────────────────────────────────

    const loadFiles = useCallback(async () => {
        if (!idToken) return
        try {
            const response = await fileManagementAPI.getUploads(idToken)
            const uploadedFiles = response.items || []
            const mapped = uploadedFiles.map((f: FileStatusResponse) => ({
                upload_id: f.upload_id,
                filename: f.filename || "",
                original_filename: f.original_filename,
                status: f.status,
                rows_clean: f.rows_clean,
                updated_at: f.updated_at,
                status_timestamp: f.status_timestamp,
            }))
            setFiles(mapped)
        } catch (err) {
            console.warn("Failed to load files:", err)
            setFiles([])
        }
    }, [idToken])

    const handleFileSelect = useCallback(async (fileUploadId: string) => {
        const file = files.find((f) => f.upload_id === fileUploadId)
        if (!file) return

        setSelectedFile(file)

        if (mode === "destination" && idToken) {
            setColumnModalOpen(true)
            setColumnsLoading(true)
            setColumnsError(null)

            try {
                const resp = await fileManagementAPI.getFileColumns(fileUploadId, idToken)
                const cols = filterDQColumns(resp.columns || [])
                setAvailableColumns(cols)
                setSelectedColumns(new Set(cols))

                if (cols.length === 0) {
                    setColumnsError("No columns detected for this file. You can still proceed.")
                }
            } catch (err) {
                console.error("Failed to fetch columns:", err)
                setAvailableColumns([])
                setSelectedColumns(new Set())
                setColumnsError("Unable to fetch columns. You can proceed without column selection.")
            } finally {
                setColumnsLoading(false)
            }
        }
    }, [files, mode, idToken])

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

    // Load files when in destination mode
    useEffect(() => {
        if (mode === "destination" && idToken) {
            loadFiles()
        }
    }, [mode, idToken, loadFiles])

    // ─── Import ───────────────────────────────────────────────────────────

    const runImport = useCallback(async () => {
        if (!selectedTable) {
            onNotification?.("Please select a table to import", "error")
            return
        }

        setIsImporting(true)
        setImportResult(null)
        try {
            const result = await warehouseConnectorsAPI.importData(provider, {
                table: selectedTable,
                limit: importLimit,
                warehouse: configuredWarehouse || undefined,
                database: configuredDatabase || undefined,
                schema: selectedSchema || undefined,
            })
            setImportResult(result)
            onNotification?.(
                `Imported ${result.records_imported ?? 0} records from ${providerDisplayName}`,
                "success"
            )
            if (result.upload_id) {
                onImportComplete?.(result.upload_id)
            }
        } catch (error) {
            onNotification?.(
                (error as Error).message || "Import failed",
                "error"
            )
        } finally {
            setIsImporting(false)
        }
    }, [
        provider,
        providerDisplayName,
        selectedTable,
        importLimit,
        configuredWarehouse,
        configuredDatabase,
        selectedSchema,
        onNotification,
        onImportComplete,
    ])

    // ─── Export ───────────────────────────────────────────────────────────

    const runExport = useCallback(async () => {
        if (!selectedFile && !uploadId) {
            onNotification?.("Please select a file to export", "error")
            return
        }

        // Determine target table name
        let targetTable: string
        if (destinationMode === "existing") {
            targetTable = selectedExistingTable
        } else {
            // New table: use user-entered name, or fall back to sanitized filename
            targetTable = newTableName.trim()
                ? newTableName.trim().replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase()
                : (selectedFile?.original_filename || selectedFile?.filename || "EXPORT_DATA")
                    .replace(/\.[^/.]+$/, "")
                    .replace(/[^a-zA-Z0-9_]/g, "_")
                    .toUpperCase()
        }

        if (!targetTable) {
            onNotification?.("Please enter a table name or select an existing table.", "error")
            return
        }

        const fileId = selectedFile?.upload_id || uploadId
        if (!fileId) {
            onNotification?.("Please select a file to export", "error")
            return
        }

        setIsExporting(true)
        setExportResult(null)
        setError(null)
        try {
            // For existing tables, send column_mapping. For new tables, no mapping needed.
            const result = await warehouseConnectorsAPI.exportData(provider, {
                upload_id: fileId,
                target_table: targetTable,
                warehouse: configuredWarehouse || undefined,
                database: configuredDatabase || undefined,
                schema: selectedSchema || undefined,
                write_mode: exportWriteMode,
                column_mapping: destinationMode === "existing" && Object.keys(columnMapping).length > 0
                    ? columnMapping
                    : undefined,
            })
            setExportResult(result)
            onNotification?.(
                result.message || `Exported ${result.rows_affected ?? 0} records to ${providerDisplayName}`,
                "success"
            )
        } catch (error) {
            const msg = (error as Error).message || "Export failed"
            setError(msg)
            onNotification?.(msg, "error")
        } finally {
            setIsExporting(false)
        }
    }, [
        provider,
        providerDisplayName,
        selectedFile,
        uploadId,
        destinationMode,
        selectedExistingTable,
        newTableName,
        columnMapping,
        configuredWarehouse,
        configuredDatabase,
        selectedSchema,
        onNotification,
    ])

    return {
        // Provider display name
        providerDisplayName,

        // Connection
        connectionStatus,
        isConnecting,
        isCheckingStatus,
        connectOAuth,
        disconnect,
        checkConnection,

        // Metadata (import)
        schemas,
        tables,
        metadataLoading,

        // Admin-configured warehouse/database (read-only)
        configuredWarehouse,
        configuredDatabase,
        configMissing,

        // Import selections
        selectedSchema,
        setSelectedSchema,
        selectedTable,
        setSelectedTable,
        importLimit,
        setImportLimit,

        // Import
        isImporting,
        importResult,
        runImport,

        // Export — files
        files,
        selectedFile,
        handleFileSelect,

        // Export — destination
        destinationMode,
        setDestinationMode,
        newTableName,
        setNewTableName,
        selectedExistingTable,
        setSelectedExistingTable,

        // Export — columns
        availableColumns,
        selectedColumns,
        columnsLoading,
        columnsError,
        columnModalOpen,
        setColumnModalOpen,
        handleToggleColumn,
        handleToggleAllColumns,

        // Export — mapping (existing table only)
        mappingOpen,
        setMappingOpen,
        columnMapping,
        setColumnMapping,
        targetTableColumns,
        targetColumnsLoading,

        // Export — config & execution
        isExporting,
        exportResult,
        error,
        setError,
        runExport,
    }
}
