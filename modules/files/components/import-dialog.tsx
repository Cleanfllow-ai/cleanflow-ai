'use client'

/**
 * import-dialog.tsx
 *
 * Unified Import dialog — two tabs:
 *   1. Upload        — drag & drop a local file directly into the pipeline
 *   2. Unified Bridge — pull data from any source via FTP/SFTP, TCP, HTTP, or ERP systems
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FolderUp, Server } from 'lucide-react'
import { useAuth } from '@/modules/auth'
import DirectUploadForm from '@/modules/files/components/direct-upload-form'
import UnifiedBridgeImport from '@/modules/unified-bridge/components/unified-bridge-import'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: (uploadId: string) => void
  onNotification?: (message: string, type: 'success' | 'error') => void
}

export function ImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  onNotification,
}: ImportDialogProps) {
  const { idToken, getValidToken } = useAuth()

  const handleIngestionStart = () => {}

  const handleIngestionComplete = (result: { success: boolean; message: string; uploadId?: string }) => {
    if (result.success) {
      onNotification?.(result.message, 'success')
      if (result.uploadId) {
        onImportComplete?.(result.uploadId)
      }
      // Auto-close dialog on success
      onOpenChange(false)
    } else {
      onNotification?.(result.message, 'error')
    }
  }

  const handleError = (error: string) => {
    onNotification?.(error, 'error')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col overflow-hidden p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-3.5 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2.5 font-sans text-base font-semibold tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <FolderUp className="h-4 w-4 text-primary" />
            </div>
            Import Data
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground ml-[42px]">
            Upload a file or ingest from any source via the Unified Bridge.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="upload" className="flex flex-col">
          <TabsList className="mx-6 mt-4 shrink-0 w-fit">
            <TabsTrigger value="upload" className="gap-1.5">
              <FolderUp className="h-3.5 w-3.5" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="bridge" className="gap-1.5">
              <Server className="h-3.5 w-3.5" />
              Unified Bridge
            </TabsTrigger>
          </TabsList>

          {/* ── Upload tab ── */}
          <TabsContent value="upload" className="mt-0 px-6 pb-6 pt-4">
            <DirectUploadForm
              token={idToken || ''}
              getValidToken={getValidToken}
              onUploadStart={handleIngestionStart}
              onUploadComplete={handleIngestionComplete}
              onError={handleError}
              disabled={!idToken}
            />
          </TabsContent>

          {/* ── Unified Bridge tab ── */}
          <TabsContent value="bridge" className="mt-0 px-6 pb-6 pt-4 max-h-[70vh] overflow-y-auto">
            <UnifiedBridgeImport
              mode="source"
              onImportComplete={(uploadId) => {
                onImportComplete?.(uploadId)
                onOpenChange(false)
              }}
              onNotification={onNotification}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
