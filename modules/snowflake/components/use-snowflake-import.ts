"use client"

import { useState, useCallback, useEffect } from "react"
import { useAuth } from "@/modules/auth"
import { snowflakeAPI } from "@/modules/snowflake/api/snowflake-api"
import { fileManagementAPI, type FileStatusResponse } from "@/modules/files"
import type {
    SnowflakeConnectionStatus,
    SnowflakeImportResponse,
    SnowflakeExportResponse,
    SnowflakeWriteMode,
    SnowflakeMetadataItem,
} from "@/modules/snowflake/types/snowflake.types"
import {
    autoMapColumns,
    validateMapping,
    getSnowflakeTableName,
    type SnowflakeEntity,
} from "./snowflake-mapping-utils"

// ─── Types ────────────────────────────────────────────────────────

export interface SnowflakeFile {
    upload_id: string
    filename: string
    original_filename?: string
    status: string
    rows_clean?: number
    updated_at?: string
    status_timestamp?: string
}

interface UseSnowflakeImportProps {
    mode?: "source" | "destination"
    uploadId?: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useSnowflakeImport({
    mode = "source",
    uploadId,
    onImportComplete,
    onNotification,
}: UseSnowflakeImportProps) {
    const { idToken } = useAuth()

    // Connection state
    const [connectionStatus, setConnectionStatus] =
        useState<SnowflakeConnectionStatus>({ connected: false })
    const [isConnecting, setIsConnecting] = useState(false)
    const [isCheckingStatus, setIsCheckingStatus] = useState(false)

    // Import — metadata state
    const [warehouses, setWarehouses] = useState<SnowflakeMetadataItem[]>([])
    const [databases, setDatabases] = useState<SnowflakeMetadataItem[]>([])
    const [schemas, setSchemas] = useState<SnowflakeMetadataItem[]>([])
    const [tables, setTables] = useState<SnowflakeMetadataItem[]>([])
    const [metadataLoading, setMetadataLoading] = useState(false)

    // Import — selection state (populated from provisioned defaults on connect)
    const [selectedWarehouse, setSelectedWarehouse] = useState("")
    const [selectedDatabase, setSelectedDatabase] = useState("")
    const [selectedSchema, setSelectedSchema] = useState("")
    const [selectedTable, setSelectedTable] = useState("")
    const [importLimit, setImportLimit] = useState(10000)

    // Import state
    const [isImporting, setIsImporting] = useState(false)
    const [importResult, setImportResult] =
        useState<SnowflakeImportResponse | null>(null)

    // Export — file management
    const [files, setFiles] = useState<SnowflakeFile[]>([])
    const [selectedFile, setSelectedFile] = useState<SnowflakeFile | null>(null)

    // Export — entity & mapping
    const [selectedEntity, setSelectedEntity] = useState<SnowflakeEntity>("customers")
    const [availableColumns, setAvailableColumns] = useState<string[]>([])
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
    const [columnsLoading, setColumnsLoading] = useState(false)
    const [columnsError, setColumnsError] = useState<string | null>(null)
    const [columnModalOpen, setColumnModalOpen] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})

    // Export — config
    const [exportWriteMode, setExportWriteMode] = useState<SnowflakeWriteMode>("insert")
    const [isExporting, setIsExporting] = useState(false)
    const [exportResult, setExportResult] =
        useState<SnowflakeExportResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    // ─── Connection ───────────────────────────────────────────────────────

    const checkConnection = useCallback(async () => {
        setIsCheckingStatus(true)
        try {
            const status = await snowflakeAPI.getConnectionStatus()
            setConnectionStatus(status)
            // Seed selectors from provisioned user namespace
            if (status.connected && status.sf_provisioned) {
                if (status.sf_user_database) setSelectedDatabase((prev) => prev || status.sf_user_database!)
                if (status.sf_user_schema) setSelectedSchema((prev) => prev || status.sf_user_schema!)
            }
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
            const result = await snowflakeAPI.openOAuthPopup()
            if (result.success) {
                onNotification?.("Connected to Snowflake!", "success")
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
    }, [checkConnection, onNotification])

    const disconnect = useCallback(async () => {
        try {
            await snowflakeAPI.disconnect()
            setConnectionStatus({ connected: false })
            setWarehouses([])
            setDatabases([])
            setSchemas([])
            setTables([])
            setSelectedWarehouse("")
            setSelectedDatabase("")
            setSelectedSchema("")
            setSelectedTable("")
            setSelectedFile(null)
            onNotification?.("Disconnected from Snowflake", "success")
        } catch (error) {
            onNotification?.(
                (error as Error).message || "Disconnect failed",
                "error"
            )
        }
    }, [onNotification])

    // ─── Metadata loading ─────────────────────────────────────────────────

    const loadMetadata = useCallback(async () => {
        setMetadataLoading(true)
        try {
            // Load warehouses and databases in parallel; tables load via cascading effects
            const [wh, dbs] = await Promise.all([
                snowflakeAPI.listWarehouses(),
                snowflakeAPI.listDatabases(),
            ])
            setWarehouses(wh)
            setDatabases(dbs)
            if (wh.length > 0 && !selectedWarehouse) {
                setSelectedWarehouse(wh[0].name)
            }
            // If we already have a selected database + schema, load tables
            if (selectedDatabase && selectedSchema) {
                const tbl = await snowflakeAPI.listTables(selectedDatabase, selectedSchema)
                    .catch(() => [] as SnowflakeMetadataItem[])
                setTables(tbl)
            }
        } catch (error) {
            console.error("Failed to load metadata:", error)
            onNotification?.(
                "Failed to load Snowflake metadata. Please check your connection.",
                "error"
            )
        } finally {
            setMetadataLoading(false)
        }
    }, [onNotification, selectedWarehouse, selectedDatabase, selectedSchema])

    const loadSchemas = useCallback(async (database: string) => {
        if (!database) return
        setSchemas([])
        setSelectedTable("")
        try {
            const items = await snowflakeAPI.listSchemas(database)
            setSchemas(items)
        } catch (error) {
            console.error("Failed to load schemas:", error)
        }
    }, [])

    const loadTables = useCallback(async (database: string, schema: string) => {
        if (!database || !schema) return
        setTables([])
        setSelectedTable("")
        try {
            const items = await snowflakeAPI.listTables(database, schema)
            setTables(items)
        } catch (error) {
            console.error("Failed to load tables:", error)
        }
    }, [])

    // Import cascading effects
    useEffect(() => {
        if (selectedDatabase) {
            loadSchemas(selectedDatabase)
        }
    }, [selectedDatabase, loadSchemas])

    useEffect(() => {
        if (selectedDatabase && selectedSchema) {
            loadTables(selectedDatabase, selectedSchema)
        }
    }, [selectedDatabase, selectedSchema, loadTables])

    // Load metadata on mount if already connected
    useEffect(() => {
        checkConnection().then((connected) => {
            if (connected) {
                loadMetadata()
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
                const cols = resp.columns || []
                setAvailableColumns(cols)
                setSelectedColumns(new Set(cols))
                setColumnMapping(autoMapColumns(selectedEntity, cols))

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
    }, [files, mode, idToken, selectedEntity])

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

    // Re-map columns when entity changes
    useEffect(() => {
        if (availableColumns.length > 0) {
            setColumnMapping(autoMapColumns(selectedEntity, availableColumns))
        }
    }, [selectedEntity, availableColumns])

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
            const result = await snowflakeAPI.importData({
                table: selectedTable,
                limit: importLimit,
                warehouse: selectedWarehouse || undefined,
                database: selectedDatabase || undefined,
                schema: selectedSchema || undefined,
            })
            setImportResult(result)
            onNotification?.(
                `Imported ${result.records_imported} records from Snowflake`,
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
        selectedTable,
        importLimit,
        selectedWarehouse,
        selectedDatabase,
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

        // For "general" entity, use the filename as table name
        const targetTable = selectedEntity === "general"
            ? (selectedFile?.original_filename || selectedFile?.filename || "EXPORT_DATA")
                .replace(/\.[^/.]+$/, "")          // strip extension
                .replace(/[^a-zA-Z0-9_]/g, "_")    // sanitize
                .toUpperCase()
            : getSnowflakeTableName(selectedEntity)

        if (!targetTable) {
            onNotification?.("Could not determine target table.", "error")
            return
        }

        // Validate mapping for entity-based exports
        if (selectedEntity !== "general") {
            const validation = validateMapping(selectedEntity, columnMapping, availableColumns)
            if (!validation.valid) {
                setError(validation.message)
                onNotification?.(validation.message || "Please complete column mapping", "error")
                setMappingOpen(true)
                return
            }
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
            const result = await snowflakeAPI.exportToSnowflake({
                upload_id: fileId,
                target_table: targetTable,
                warehouse: selectedWarehouse || undefined,
                database: selectedDatabase || undefined,
                schema: selectedSchema || undefined,
                write_mode: exportWriteMode,
                column_mapping: selectedEntity !== "general" ? columnMapping : undefined,
            })
            setExportResult(result)
            onNotification?.(
                result.message || `Exported ${result.records_written ?? 0} records to Snowflake table ${targetTable}`,
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
        selectedFile,
        uploadId,
        selectedEntity,
        columnMapping,
        availableColumns,
        selectedWarehouse,
        databases,
        exportWriteMode,
        onNotification,
    ])

    return {
        // Connection
        connectionStatus,
        isConnecting,
        isCheckingStatus,
        connectOAuth,
        disconnect,
        checkConnection,

        // Metadata (import)
        warehouses,
        databases,
        schemas,
        tables,
        metadataLoading,

        // Import selections
        selectedWarehouse,
        setSelectedWarehouse,
        selectedDatabase,
        setSelectedDatabase,
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

        // Export — entity & columns
        selectedEntity,
        setSelectedEntity,
        availableColumns,
        selectedColumns,
        columnsLoading,
        columnsError,
        columnModalOpen,
        setColumnModalOpen,
        handleToggleColumn,
        handleToggleAllColumns,

        // Export — mapping
        mappingOpen,
        setMappingOpen,
        columnMapping,
        setColumnMapping,

        // Export — config & execution
        exportWriteMode,
        setExportWriteMode,
        isExporting,
        exportResult,
        error,
        setError,
        runExport,
    }
}
