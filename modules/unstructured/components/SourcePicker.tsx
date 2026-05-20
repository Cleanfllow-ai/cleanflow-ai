"use client"

/**
 * SourcePicker — Step 1 of the Unstructured Import wizard.
 *
 * Lets the user choose between Google Drive and local-upload (ZIP), then
 * picks a folder (for Drive) or drops a ZIP file (for local). Connection
 * lookup is delegated to the existing /connectors/connections endpoint;
 * we filter for `provider == "google_drive"`.
 *
 * The component is intentionally controlled — parent owns the source state
 * so it can be validated together with the rest of the wizard.
 */

import { useEffect, useMemo, useState } from "react"
import { CloudUpload, FolderTree, HardDriveUpload, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/shared/lib/utils"
import { connectorsAPI } from "@/modules/connectors/api"
import type {
  UnstructuredConnector,
  UnstructuredJobSource,
} from "../types/unstructured.types"

interface SourcePickerProps {
  value: UnstructuredJobSource
  onChange: (next: UnstructuredJobSource) => void
  onLocalFileSelected?: (file: File | null) => void
  localFile?: File | null
  onReconnect?: () => void
}

const MAX_LOCAL_BYTES = 500 * 1024 * 1024 // 500 MB

interface GoogleDriveConnection {
  connection_id: string
  email?: string | null
  provider?: string
}

function pickDriveConnection(
  rows: Record<string, unknown>[],
): GoogleDriveConnection | null {
  for (const row of rows) {
    const provider = String(row.provider || "").toLowerCase()
    if (provider === "google_drive" || provider === "googledrive") {
      return {
        connection_id: String(row.connection_id || row.id || ""),
        email:
          (row.email as string | null) ||
          (row.account_email as string | null) ||
          (row.account_identifier as string | null) ||
          null,
        provider,
      }
    }
  }
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function SourcePicker({
  value,
  onChange,
  onLocalFileSelected,
  localFile,
  onReconnect,
}: SourcePickerProps) {
  const [loading, setLoading] = useState(false)
  const [driveConnection, setDriveConnection] =
    useState<GoogleDriveConnection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const fetchConnections = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await connectorsAPI.listConnections()
      const conn = pickDriveConnection(resp.connections || [])
      setDriveConnection(conn)
      if (conn && value.connector === "google_drive") {
        onChange({ ...value, connection_id: conn.connection_id })
      }
    } catch (err) {
      const message = (err as Error)?.message || "Failed to load connections"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setConnector = (next: UnstructuredConnector) => {
    if (next === "google_drive") {
      onChange({
        connector: "google_drive",
        connection_id: driveConnection?.connection_id || "",
        folder_id: value.folder_id || null,
      })
    } else {
      onChange({
        connector: "local_upload",
        connection_id: "local",
        folder_id: null,
      })
    }
  }

  const handleFolderId = (raw: string) => {
    const trimmed = raw.trim()
    onChange({ ...value, folder_id: trimmed.length === 0 ? null : trimmed })
  }

  const handleFileDrop = (file: File | null) => {
    if (!file) {
      onLocalFileSelected?.(null)
      return
    }
    if (file.size > MAX_LOCAL_BYTES) {
      setError(`File too large (${formatBytes(file.size)}). Max 500 MB.`)
      return
    }
    setError(null)
    onLocalFileSelected?.(file)
  }

  const driveStatusLine = useMemo(() => {
    if (loading) return "Checking Google Drive connection…"
    if (!driveConnection) return "Not connected"
    return driveConnection.email
      ? `Connected: ${driveConnection.email}`
      : "Connected"
  }, [loading, driveConnection])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Step 1: Pick source</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Where should we pull the unstructured documents from?
        </p>
      </div>

      <RadioGroup
        value={value.connector}
        onValueChange={(v) => setConnector(v as UnstructuredConnector)}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <Label
          htmlFor="src-google-drive"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
            value.connector === "google_drive"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <RadioGroupItem value="google_drive" id="src-google-drive" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Google Drive</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>{driveStatusLine}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (onReconnect) {
                    onReconnect()
                  } else {
                    void fetchConnections()
                  }
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {driveConnection ? "Reconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </Label>

        <Label
          htmlFor="src-local-upload"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
            value.connector === "local_upload"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <RadioGroupItem value="local_upload" id="src-local-upload" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <HardDriveUpload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Local Upload</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag-drop a ZIP up to 500 MB.
            </p>
          </div>
        </Label>
      </RadioGroup>

      {value.connector === "google_drive" && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <Label htmlFor="drive-folder" className="text-xs font-medium flex items-center gap-1.5">
            <FolderTree className="h-3.5 w-3.5" />
            Drive folder ID
          </Label>
          <Input
            id="drive-folder"
            data-testid="unstructured-folder-id"
            placeholder="e.g. 1Abc23xyz_-folder-id"
            value={value.folder_id || ""}
            onChange={(e) => handleFolderId(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Paste the folder ID from the Drive URL. We will scan recursively.
          </p>
        </div>
      )}

      {value.connector === "local_upload" && (
        <div
          data-testid="unstructured-local-dropzone"
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0] || null
            handleFileDrop(file)
          }}
          className={cn(
            "rounded-md border-2 border-dashed p-6 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <HardDriveUpload className="h-6 w-6 mx-auto text-muted-foreground" />
          {localFile ? (
            <div className="mt-2 text-sm">
              <div className="font-medium">{localFile.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatBytes(localFile.size)}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2 h-7 text-[11px]"
                onClick={() => handleFileDrop(null)}
              >
                Remove
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm">Drop ZIP here</p>
              <p className="text-xs text-muted-foreground">or</p>
              <div className="mt-2">
                <label className="inline-flex">
                  <input
                    data-testid="unstructured-local-file-input"
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    className="hidden"
                    onChange={(e) =>
                      handleFileDrop(e.target.files?.[0] || null)
                    }
                  />
                  <Button type="button" size="sm" variant="outline" asChild>
                    <span>Choose File</span>
                  </Button>
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default SourcePicker
