'use client'

import { useState } from 'react'
import { Loader2, CloudUpload, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import quickBooksAPI from '@/modules/quickbooks/api/quickbooks-api'
import type { FileStatusResponse } from '@/modules/files'

interface PushToQuickBooksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileStatusResponse | null
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function PushToQuickBooksModal({
  open,
  onOpenChange,
  file,
  onSuccess,
  onError,
}: PushToQuickBooksModalProps) {
  const [pushing, setPushing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePush = async () => {
    if (!file) return

    setPushing(true)
    setError(null)
    setResult(null)

    try {
      // Check connection first
      const connectionStatus = await quickBooksAPI.getConnectionStatus()
      
      if (!connectionStatus.connected) {
        const msg = 'QuickBooks is not connected. Please connect your QuickBooks account first.'
        setError(msg)
        onError?.(msg)
        return
      }

      const response = await quickBooksAPI.exportToQuickBooks(file.upload_id)
      setResult({
        success: response.success,
        message: response.message || `Successfully exported ${response.records_exported || 0} records to QuickBooks`,
      })
      onSuccess?.()
    } catch (err) {
      console.error('Push to QuickBooks error:', err)
      const msg = (err as Error).message || 'Failed to push to QuickBooks'
      
      // Provide helpful messages for common errors
      let displayMsg = msg
      if (msg.includes('AbortError') || msg.includes('timed out')) {
        displayMsg = 'The export took too long. Please try again. If this persists, check your network connection.'
      } else if (msg.includes('NoSuchKey') || msg.includes('does not exist')) {
        displayMsg = 'Failed to read processed data: The cleaned data file could not be found. Please process the file again and try exporting.'
      } else if (msg.includes('specified key does not exist')) {
        displayMsg = 'The cleaned data file is missing from storage. Please reprocess the file and try again.'
      }
      
      setError(displayMsg)
      onError?.(displayMsg)
    } finally {
      setPushing(false)
    }
  }

  const handleClose = () => {
    setResult(null)
    setError(null)
    onOpenChange(false)
  }

  const filename = file?.original_filename || file?.filename || 'selected file'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-green-600" />
            Push to QuickBooks
          </DialogTitle>
          <DialogDescription>
            Export cleaned data to your connected QuickBooks account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* File Info */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm font-medium">{filename}</p>
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.rows_clean || file.rows_out || 0} clean rows ready to export
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={result.success ? 'text-green-900' : 'text-red-900'}>
                {result.message}
              </AlertDescription>
            </Alert>
          )}

          {!result && !error && (
            <p className="text-sm text-muted-foreground">
              This will upload the cleaned and validated data to your QuickBooks account.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {result?.success ? 'Close' : 'Cancel'}
          </Button>
          {!result?.success && (
            <Button
              onClick={handlePush}
              disabled={pushing || !file}
              className="bg-green-600 hover:bg-green-700"
            >
              {pushing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Push to QuickBooks
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
