"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/modules/auth"
import { connectorsAPI } from "@/modules/connectors/api/connectors-api"
import { erpConnectorsAPI } from "@/modules/connectors/api/erp-connectors-api"
import type { ERPConnectionStatus } from "@/modules/connectors/types"
import { fileManagementAPI, type FileStatusResponse, filterDQColumns } from "@/modules/files"
import {
  autoMapColumns,
  validateMapping,
  type MappingField,
} from "./erp-mapping-utils"

// ─── Types ────────────────────────────────────────────────────────

export interface ERPFile {
  upload_id: string
  filename: string
  original_filename?: string
  status: string
  rows_clean?: number
  updated_at?: string
  status_timestamp?: string
}

export interface ERPConfig {
  entity: string
  dateFrom: string
  dateTo: string
  limit: number
  orgId: string
  fetchAll: boolean
}

export interface ERPEntityInfo {
  entity: string
  label: string
  record_count: number
  has_data: boolean
  available: boolean
  reason?: string
}

export interface UseERPImportProps {
  provider: string
  mode?: "source" | "destination"
  uploadId?: string
  onImportComplete?: (uploadId: string) => void
  onNotification?: (message: string, type: "success" | "error") => void
  onPermissionDenied?: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useERPImport({
  provider,
  mode,
  uploadId,
  onImportComplete,
  onNotification,
  onPermissionDenied,
}: UseERPImportProps) {
  const { idToken } = useAuth()
  const [connected, setConnected] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<ERPConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<ERPFile | null>(null)
  const [files, setFiles] = useState<ERPFile[]>([])

  const [config, setConfig] = useState<ERPConfig>({
    entity: "",
    dateFrom: "",
    dateTo: "",
    limit: 1000,
    orgId: "",
    fetchAll: false,
  })

  const [importResult, setImportResult] = useState<{
    success?: boolean
    message: string
    records_imported: number
    filename: string
    upload_id: string
    entity?: string
  } | null>(null)
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

  // Entity discovery state
  const [discoveredEntities, setDiscoveredEntities] = useState<ERPEntityInfo[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(false)

  // Dynamic entity field definitions (from backend)
  const [entityFields, setEntityFields] = useState<MappingField[]>([])

  // AI auto-map
  const [autoMapLoading, setAutoMapLoading] = useState(false)

  // Export polling (for providers with async exports)
  const [exportPolling, setExportPolling] = useState(false)

  // ─── Display name helper ────────────────────────────────────────
  const providerDisplayName = provider.charAt(0).toUpperCase() + provider.slice(1).replace(/books$/i, " Books")

  // ─── Permission helpers ─────────────────────────────────────────
  const isPermissionError = (err: unknown) => {
    const msg = ((err as Error)?.message || "").toLowerCase()
    return msg.includes("permission denied") || msg.includes("forbidden")
  }

  const notifyPermissionDenied = (err: unknown) => {
    if (isPermissionError(err)) {
      onPermissionDenied?.()
      return true
    }
    return false
  }

  // ─── Org ID persistence (Zoho-style) ───────────────────────────
  const loadSavedOrgId = () => {
    if (typeof window === "undefined") return ""
    try {
      return localStorage.getItem(`erp_org_id:${provider}`) || ""
    } catch {
      return ""
    }
  }

  const saveOrgId = (orgId: string) => {
    if (typeof window === "undefined" || !orgId) return
    try {
      localStorage.setItem(`erp_org_id:${provider}`, orgId)
    } catch { /* ignore */ }
  }

  // ─── Data loaders ──────────────────────────────────────────────
  const loadFiles = async () => {
    if (!idToken) return
    try {
      const response = await fileManagementAPI.getUploads(idToken)
      const uploadedFiles = response.items || []
      const mappedFiles = uploadedFiles.map((f: FileStatusResponse) => ({
        upload_id: f.upload_id,
        filename: f.filename || "",
        original_filename: f.original_filename,
        status: f.status,
        rows_clean: f.rows_clean,
        updated_at: f.updated_at,
        status_timestamp: f.status_timestamp,
        root_upload_id: (f as any).root_upload_id || f.upload_id,
      }))

      const byRoot = new Map<string, (typeof mappedFiles)[0]>()
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
    } catch (err) {
      if (!notifyPermissionDenied(err)) {
        console.warn("Failed to load files.")
      }
      setFiles([])
    }
  }

  // ─── Entity discovery ──────────────────────────────────────────
  const loadEntities = async () => {
    setEntitiesLoading(true)
    try {
      const resp = await erpConnectorsAPI.discoverEntities(provider, config.orgId || undefined)
      setDiscoveredEntities((resp.entities || []) as ERPEntityInfo[])
      // Auto-select first available entity if none selected
      if (!config.entity && resp.entities?.length) {
        const first = resp.entities.find((e) => e.available)
        if (first?.entity) {
          setConfig((prev) => ({ ...prev, entity: first.entity! }))
        }
      }
    } catch {
      setDiscoveredEntities([])
    } finally {
      setEntitiesLoading(false)
    }
  }

  // ─── Dynamic entity fields ────────────────────────────────────
  const loadEntityFields = async (entity: string) => {
    try {
      const resp = await erpConnectorsAPI.getEntityFields(provider, entity)
      const fields: MappingField[] = (resp.fields || []).map((f: any) => ({
        key: f.key || f.name,
        label: f.label || f.key || f.name,
        required: f.required || false,
        help: f.description || "",
      }))
      setEntityFields(fields)
    } catch {
      setEntityFields([])
    }
  }

  // ─── AI auto-map ──────────────────────────────────────────────
  const aiAutoMap = async () => {
    if (availableColumns.length === 0) return
    setAutoMapLoading(true)
    try {
      // Local mapping first
      const localMapping = autoMapColumns(availableColumns, entityFields)

      // If all fields mapped locally, done
      const unmapped = entityFields.filter((f) => !localMapping[f.key])
      if (unmapped.length === 0 || entityFields.length === 0) {
        setColumnMapping(localMapping)
        setAutoMapLoading(false)
        return
      }

      // Call backend AI auto-map
      const fileId = selectedFile?.upload_id || uploadId
      const resp = await erpConnectorsAPI.aiAutoMap(provider, availableColumns, config.entity, fileId)

      if (resp.mapping && Object.keys(resp.mapping).length > 0) {
        const validMapping: Record<string, string> = {}
        const colLookup = new Map(availableColumns.map((c) => [c.toLowerCase(), c]))
        for (const [field, col] of Object.entries(resp.mapping)) {
          const actualCol = colLookup.get(col.toLowerCase())
          if (actualCol) validMapping[field] = actualCol
        }
        setColumnMapping({ ...localMapping, ...validMapping })
      } else {
        setColumnMapping(localMapping)
      }
    } catch {
      setColumnMapping(autoMapColumns(availableColumns, entityFields))
    } finally {
      setAutoMapLoading(false)
    }
  }

  // ─── Connection handlers ──────────────────────────────────────
  const checkConnection = async () => {
    try {
      setLoading(true)
      const status = await connectorsAPI.getConnectionStatus(provider) as ERPConnectionStatus
      setConnected(status.connected)
      setConnectionInfo(status)
      if (status.connected) {
        // Pick up org_id from connection if available
        if (status.org_id && !config.orgId) {
          setConfig((prev) => ({ ...prev, orgId: status.org_id! }))
          saveOrgId(status.org_id)
        }
        loadEntities()
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const connectProvider = async () => {
    try {
      setError(null)
      const result = await connectorsAPI.openOAuthPopupForProvider(provider)
      if (result.success) {
        onNotification?.(`${providerDisplayName} connected successfully!`, "success")
        checkConnection()
      } else if (result.error) {
        setError(result.error)
        onNotification?.(`Connection failed: ${result.error}`, "error")
      }
    } catch (err) {
      const message = (err as Error).message || `Failed to connect to ${providerDisplayName}`
      setError(message)
      if (!notifyPermissionDenied(err)) {
        onNotification?.(`Failed to connect to ${providerDisplayName}`, "error")
      }
    }
  }

  const disconnectProvider = async () => {
    if (!confirm(`Are you sure you want to disconnect ${providerDisplayName}?`)) return
    try {
      await connectorsAPI.disconnect(provider)
      setConnected(false)
      setConnectionInfo(null)
      onNotification?.(`Disconnected from ${providerDisplayName}`, "success")
    } catch (err) {
      const message = (err as Error).message
      setError(message)
      if (!notifyPermissionDenied(err)) {
        onNotification?.(`Failed to disconnect from ${providerDisplayName}`, "error")
      }
    }
  }

  // ─── Column & file handlers ───────────────────────────────────
  const handleFileSelect = async (fileUploadId: string) => {
    const file = files.find((f) => f.upload_id === fileUploadId)
    if (!file) return
    setSelectedFile(file)

    if (mode === "destination" && idToken) {
      setColumnModalOpen(true)
      setColumnsLoading(true)
      setColumnsError(null)
      try {
        const resp = await fileManagementAPI.getFileColumns(fileUploadId, idToken)
        const rawCols = resp.columns || []
        const cols = filterDQColumns(rawCols)
        setAvailableColumns(cols)
        setSelectedColumns(new Set(cols))
        setColumnMapping(autoMapColumns(cols, entityFields))
        if (cols.length === 0) {
          setColumnsError("No columns detected for this file. You can still proceed.")
        }
      } catch (err) {
        if (!notifyPermissionDenied(err)) {
          console.error("Failed to fetch columns:", err)
        }
        setAvailableColumns([])
        setSelectedColumns(new Set())
        setColumnsError("Unable to fetch columns. You can proceed without column selection.")
      } finally {
        setColumnsLoading(false)
      }
    }
  }

  const handleToggleColumn = (col: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      checked ? next.add(col) : next.delete(col)
      return next
    })
  }

  const handleToggleAllColumns = (checked: boolean) => {
    setSelectedColumns(checked ? new Set(availableColumns) : new Set())
  }

  // ─── Import ────────────────────────────────────────────────────
  const importFromProvider = async () => {
    if (!connected) { setError(`Please connect to ${providerDisplayName} first`); return }
    if (!config.entity) { setError("Please select an entity to import"); return }

    try {
      setIsImporting(true)
      setError(null)
      setImportResult(null)

      const filters: Record<string, unknown> = { limit: config.limit }
      if (config.dateFrom) filters.date_from = config.dateFrom
      if (config.dateTo) filters.date_to = config.dateTo
      if (config.fetchAll) { filters.all = true; filters.max_pages = 50 }

      const result = await erpConnectorsAPI.importData(
        provider, config.entity, filters, config.orgId || undefined,
      )

      setImportResult({
        success: true,
        message: result.message || "Import successful",
        records_imported: result.records_imported || 0,
        filename: result.filename || "",
        upload_id: result.upload_id || "",
        entity: config.entity,
      })
      onNotification?.(`Successfully imported ${result.records_imported || 0} records!`, "success")
      if (result.upload_id) onImportComplete?.(result.upload_id)
    } catch (err) {
      const message = (err as Error).message || "Failed to import data"
      setError(message)
      if (!notifyPermissionDenied(err)) {
        onNotification?.("Import failed: " + message, "error")
      }
    } finally {
      setIsImporting(false)
    }
  }

  // ─── Export ────────────────────────────────────────────────────
  const exportToProvider = async () => {
    if (!connected) { setError(`Please connect to ${providerDisplayName} first`); return }
    if (!selectedFile && !uploadId) { setError("Please select a file to export"); return }
    if (!config.entity) { setError("Please select an entity to export"); return }

    if (mode === "destination") {
      const validation = validateMapping(columnMapping, availableColumns, entityFields)
      if (!validation.valid) {
        setError(validation.message)
        onNotification?.(validation.message || "Please complete column mapping", "error")
        setMappingOpen(true)
        return
      }
    }

    try {
      setIsExporting(true)
      setError(null)
      setImportResult(null)

      const fileId = selectedFile?.upload_id || uploadId
      if (!fileId) { setError("Please select a file to export"); return }

      const result = await erpConnectorsAPI.exportData(
        provider, fileId, config.entity, columnMapping, config.orgId || undefined,
      )

      // If async export (processing), poll for status
      if (result.status === "processing") {
        setExportPolling(true)
        pollExportStatus(fileId)
        return
      }

      const created = (result as any).records_created || 0
      const updated = (result as any).records_updated || 0
      const failed = (result as any).records_failed || 0
      const total = created + updated
      setImportResult({
        success: true,
        message: `Export complete: ${total} succeeded${failed ? `, ${failed} failed` : ""}`,
        records_imported: total,
        filename: "",
        upload_id: fileId,
        entity: config.entity,
      })
      setColumnModalOpen(false)
      onNotification?.(`Export to ${providerDisplayName} complete: ${total} succeeded${failed ? `, ${failed} failed` : ""}`, "success")
    } catch (err) {
      const errorMsg = (err as Error).message || "Failed to export data"
      let userMessage = "Export failed: " + errorMsg
      if (errorMsg.includes("NoSuchKey") || errorMsg.includes("does not exist")) {
        userMessage = "The processed data for this file is not available. Please ensure the file has been processed successfully before exporting."
      } else if (errorMsg.includes("Connection")) {
        userMessage = `Connection to ${providerDisplayName} failed. Please reconnect and try again.`
      }
      setError(userMessage)
      if (!notifyPermissionDenied(err)) {
        onNotification?.(userMessage, "error")
      }
    } finally {
      if (!exportPolling) setIsExporting(false)
    }
  }

  // ─── Export polling (async exports) ───────────────────────────
  const pollExportStatus = async (fileId: string) => {
    const delays = [2000, 3000, 5000, 5000, 5000, 10000]
    let attempt = 0
    const poll = async () => {
      try {
        const status = await erpConnectorsAPI.getExportStatus(provider, fileId)
        if (status.status === "completed" || status.status === "pushed") {
          setExportPolling(false)
          setIsExporting(false)
          const created = (status as any).created || 0
          const updated = (status as any).updated || 0
          const skipped = (status as any).skipped || 0
          const succeeded = status.success_count || 0
          const failed = status.failed_count || 0
          const errors = (status as any).errors || []

          // Build detailed breakdown
          const parts: string[] = [`Export complete: ${succeeded} succeeded, ${failed} failed`]
          const details: string[] = []
          if (created > 0) details.push(`${created} created`)
          if (updated > 0) details.push(`${updated} updated`)
          if (skipped > 0) details.push(`${skipped} skipped`)
          if (details.length > 0) parts.push(details.join(", "))
          if (errors.length > 0) {
            parts.push(...errors.slice(0, 5).map((e: any) => `Row ${e.row}: ${e.error}`))
            if (errors.length > 5) parts.push(`...and ${errors.length - 5} more errors`)
          }

          setImportResult({
            success: true,
            message: parts.join("\n"),
            records_imported: succeeded,
            filename: "",
            upload_id: fileId,
            entity: config.entity,
          })
          onNotification?.(`Export to ${providerDisplayName} complete: ${succeeded} succeeded, ${failed} failed`, "success")
          return
        }
        if (status.status === "failed") {
          setExportPolling(false)
          setIsExporting(false)
          setError(status.error || "Export failed")
          onNotification?.(status.error || "Export failed", "error")
          return
        }
        // Still processing — schedule next poll
        const delay = delays[Math.min(attempt, delays.length - 1)]
        attempt++
        if (attempt < 30) {
          setTimeout(poll, delay)
        } else {
          setExportPolling(false)
          setIsExporting(false)
          setError("Export timed out. Check the status later.")
        }
      } catch {
        setExportPolling(false)
        setIsExporting(false)
      }
    }
    setTimeout(poll, delays[0])
  }

  // ─── Effects ──────────────────────────────────────────────────
  useEffect(() => {
    // Load saved org ID on mount
    const savedOrgId = loadSavedOrgId()
    if (savedOrgId) {
      setConfig((prev) => ({ ...prev, orgId: savedOrgId }))
    }
  }, [provider])

  useEffect(() => {
    if (mode === "destination" && idToken) loadFiles()
  }, [mode, idToken])

  useEffect(() => {
    if (connected && config.entity) loadEntityFields(config.entity)
  }, [connected, config.entity])

  useEffect(() => {
    if (entityFields.length > 0 && availableColumns.length > 0) {
      setColumnMapping(autoMapColumns(availableColumns, entityFields))
    }
  }, [entityFields])

  useEffect(() => {
    checkConnection()

    const messageHandler = (event: MessageEvent) => {
      if (
        event.data.type === `${provider}-auth-success` ||
        event.data.type === `${provider}-connection-updated`
      ) {
        setTimeout(() => checkConnection(), 500)
      }
    }

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") checkConnection()
    }

    window.addEventListener("message", messageHandler)
    document.addEventListener("visibilitychange", visibilityHandler)
    return () => {
      window.removeEventListener("message", messageHandler)
      document.removeEventListener("visibilitychange", visibilityHandler)
    }
  }, [provider])

  return {
    provider,
    providerDisplayName,
    connected,
    connectionInfo,
    loading,
    connectProvider,
    disconnectProvider,
    config,
    setConfig,
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
    mappingOpen,
    setMappingOpen,
    columnMapping,
    setColumnMapping,
    discoveredEntities,
    entitiesLoading,
    entityFields,
    aiAutoMap,
    autoMapLoading,
    isImporting,
    isExporting,
    exportPolling,
    importResult,
    error,
    setError,
    importFromProvider,
    exportToProvider,
  }
}
