"use client"

import { useState } from "react"
import {
  Loader2,
  Server,
  Globe,
  Network,
  CheckCircle2,
  AlertCircle,
  FolderDown,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/modules/auth"
import FtpSourceForm from "./ftp-source-form"
import TcpSourceForm from "./tcp-source-form"
import HttpSourceForm from "./http-source-form"
import ErpSourceForm from "./erp-source-form"

interface UnifiedBridgeImportProps {
  mode?: "source" | "destination"
  onImportComplete?: (uploadId: string) => void
  onNotification?: (message: string, type: "success" | "error") => void
  onPermissionDenied?: () => void
}

type IngestionSource = "ftp" | "tcp" | "http" | "other"

export default function UnifiedBridgeImport({
  mode = "source",
  onImportComplete,
  onNotification,
  onPermissionDenied,
}: UnifiedBridgeImportProps) {
  const [activeSource, setActiveSource] = useState<IngestionSource>("ftp")
  const [isIngesting, setIsIngesting] = useState(false)
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; uploadId?: string } | null>(null)

  const { idToken } = useAuth()

  const isPermissionDeniedMessage = (message: string) => {
    const lower = (message || "").toLowerCase()
    return lower.includes("permission denied") || lower.includes("forbidden")
  }

  const handleIngestionStart = () => {
    setIsIngesting(true)
    setLastResult(null)
  }

  const handleIngestionComplete = (result: { success: boolean; message: string; uploadId?: string }) => {
    setIsIngesting(false)
    setLastResult(result)

    if (result.success) {
      onNotification?.(result.message, "success")
      if (result.uploadId) {
        onImportComplete?.(result.uploadId)
      }
    } else {
      const denied = isPermissionDeniedMessage(result.message)
      if (denied) {
        onPermissionDenied?.()
      } else {
        onNotification?.(result.message, "error")
      }
    }
  }

  const handleIngestionError = (error: string) => {
    setIsIngesting(false)
    setLastResult({ success: false, message: error })
    const denied = isPermissionDeniedMessage(error)
    if (denied) {
      onPermissionDenied?.()
    } else {
      onNotification?.(error, "error")
    }
  }

  const sourceIcons = {
    ftp: FolderDown,
    tcp: Network,
    http: Globe,
    other: Server,
  }

  const sourceLabels = {
    ftp: "FTP/SFTP",
    tcp: "TCP",
    http: "HTTP",
    other: "Others",
  }

  const sourceDescriptions = {
    ftp: mode === "source"
      ? "Pull files from FTP or SFTP servers"
      : "Ingest data to FTP or SFTP servers",
    tcp: mode === "source"
      ? "Stream data from TCP endpoints"
      : "Ingest data to TCP endpoints",
    http: mode === "source"
      ? "Fetch data from HTTP APIs and endpoints"
      : "Push data to HTTP APIs and endpoints",
    other: mode === "source"
      ? "Connect to systems like QuickBooks to import data"
      : "Connect to systems like QuickBooks to export data",
  }

  return (
    <div className="flex flex-col h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Unified Bridge</h3>
            <p className="text-xs text-muted-foreground">
              {mode === "source"
                ? "Ingest data from multiple sources"
                : "Export data to multiple destinations"}
            </p>
          </div>
        </div>
        {isIngesting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{mode === "source" ? "Ingesting..." : "Exporting..."}</span>
          </div>
        )}
      </div>

      {/* Source Tabs */}
      <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as IngestionSource)} className="flex-1 flex flex-col pt-4">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          {(["ftp", "tcp", "http", "other"] as IngestionSource[]).map((source) => {
            const Icon = sourceIcons[source]
            return (
              <TabsTrigger
                key={source}
                value={source}
                className="flex items-center gap-2 text-xs sm:text-sm"
                disabled={isIngesting}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{sourceLabels[source]}</span>
                <span className="sm:hidden">{source.toUpperCase()}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Source Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {sourceDescriptions[activeSource]}
        </p>

        {/* Result Alert */}
        {lastResult && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg mb-4 text-sm",
              lastResult.success
                ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
            )}
          >
            {lastResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{lastResult.message}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="ftp" className="mt-0 h-full">
            <FtpSourceForm
              mode={mode}
              token={idToken || ""}
              onIngestionStart={handleIngestionStart}
              onIngestionComplete={handleIngestionComplete}
              onError={handleIngestionError}
              disabled={isIngesting || !idToken}
            />
          </TabsContent>

          <TabsContent value="tcp" className="mt-0 h-full">
            <TcpSourceForm
              mode={mode}
              token={idToken || ""}
              onIngestionStart={handleIngestionStart}
              onIngestionComplete={handleIngestionComplete}
              onError={handleIngestionError}
              disabled={isIngesting || !idToken}
            />
          </TabsContent>

          <TabsContent value="http" className="mt-0 h-full">
            <HttpSourceForm
              mode={mode}
              token={idToken || ""}
              onIngestionStart={handleIngestionStart}
              onIngestionComplete={handleIngestionComplete}
              onError={handleIngestionError}
              disabled={isIngesting || !idToken}
            />
          </TabsContent>

          <TabsContent value="other" className="mt-0 h-full">
            <ErpSourceForm
              mode={mode}
              token={idToken || ""}
              onIngestionStart={handleIngestionStart}
              onIngestionComplete={handleIngestionComplete}
              onError={handleIngestionError}
              disabled={isIngesting || !idToken}
            />
          </TabsContent>

        </div>
      </Tabs>

      {/* Auth Warning */}
      {!idToken && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 mt-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Please log in to use Unified Bridge {mode === "source" ? "ingestion" : "export"}</span>
        </div>
      )}
    </div>
  )
}
