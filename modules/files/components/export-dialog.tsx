'use client'

/**
 * export-dialog.tsx
 *
 * Unified Export dialog — two tabs:
 *   1. Download       — select columns/format and save locally (CSV, Excel, JSON)
 *   2. Connectors — push data to any destination via FTP/SFTP, TCP, HTTP, or ERP systems
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileDown, Loader2, Server, Upload } from 'lucide-react'
import { ColumnExportContent } from '@/modules/files/components/column-export-dialog'
import UnifiedBridgeImport from '@/modules/unified-bridge/components/unified-bridge-import'
import type { FileStatusResponse } from '@/modules/files/api/file-management-api'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileStatusResponse | null
  columns: string[]
  isLoadingColumns: boolean
  onDownload: (options: {
    format: 'csv' | 'excel' | 'json'
    dataType: 'raw' | 'all' | 'clean' | 'quarantine'
    columns: string[]
    columnMapping: Record<string, string>
  }) => void
  downloading: boolean
}

export function ExportDialog({
  open,
  onOpenChange,
  file,
  columns,
  isLoadingColumns,
  onDownload,
  downloading,
}: ExportDialogProps) {
  const filename = file?.original_filename || file?.filename || 'file'
  const cleanRows = file?.rows_clean ?? file?.rows_out ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            Export Data
          </DialogTitle>
          <DialogDescription>
            Extract a local copy or deliver to any destination via Connectors.
          </DialogDescription>
          {file && (
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground truncate max-w-[260px]">{filename}</span>
              <span className="shrink-0">{cleanRows.toLocaleString()} clean rows</span>
            </div>
          )}
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="download" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 shrink-0 w-fit">
            <TabsTrigger value="download" className="gap-1.5">
              <FileDown className="h-3.5 w-3.5" />
              Download
            </TabsTrigger>
            <TabsTrigger value="bridge" className="gap-1.5">
              <Server className="h-3.5 w-3.5" />
              Connectors
            </TabsTrigger>
          </TabsList>

          {/* ── Extract tab ── */}
          <TabsContent value="download" className="flex-1 min-h-0 overflow-hidden mt-0 px-6 pb-6">
            {isLoadingColumns ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading columns…
              </div>
            ) : (
              <ColumnExportContent
                fileName={filename}
                columns={columns}
                onExport={onDownload}
                primaryActionLabel="Download"
                exporting={downloading}
                showTitle={false}
                className="h-full"
              />
            )}
          </TabsContent>

          {/* ── Connectors tab ── */}
          <TabsContent value="bridge" className="flex-1 min-h-0 overflow-y-auto mt-0 px-6 pb-6 pt-4">
            <UnifiedBridgeImport
              mode="destination"
              uploadId={file?.upload_id}
              onNotification={() => {}}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
