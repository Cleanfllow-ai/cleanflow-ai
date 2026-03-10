'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import fileManagementAPI, { type FileStatusResponse } from '@/modules/files/api/file-management-api'
import { DownloadFormatModal } from '@/modules/files/components/download-format-modal'
import { useAuth } from '@/modules/auth'
import { useToast } from '@/shared/hooks/use-toast'

interface CustomDestinationExportProps {
  selectedFormat: string | null
  onFormatChange: (format: string) => void
  onPermissionDenied?: () => void
}

export default function CustomDestinationExport({
  selectedFormat,
  onFormatChange,
  onPermissionDenied,
}: CustomDestinationExportProps) {
  const [files, setFiles] = useState<FileStatusResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileStatusResponse | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadFilename, setDownloadFilename] = useState('')

  // Column picker state
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [columnsLoading, setColumnsLoading] = useState(false)
  const [columnsError, setColumnsError] = useState<string | null>(null)

  const { idToken } = useAuth()
  const { toast } = useToast()
  const isPermissionError = (error: unknown) =>
    ((error as Error)?.message || "").toLowerCase().includes("permission denied") ||
    ((error as Error)?.message || "").toLowerCase().includes("forbidden")

  const notifyPermissionDenied = () => {
    onPermissionDenied?.()
  }

  const loadFiles = useCallback(async () => {
    if (!idToken) return
    setLoading(true)
    try {
      const response = await fileManagementAPI.getUploads(idToken)
      setFiles(response.items || [])
    } catch (error: any) {
      const message = (error?.message || "").toLowerCase()
      const denied = message.includes("permission denied") || message.includes("forbidden")
      if (denied) {
        notifyPermissionDenied()
      } else {
        console.warn("Failed to load files.")
        toast({
          title: 'Error',
          description: 'Failed to load files',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [idToken, toast])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleToggleColumn = (col: string, checked: boolean) => {
    const newSet = new Set(selectedColumns)
    if (checked) {
      newSet.add(col)
    } else {
      newSet.delete(col)
    }
    setSelectedColumns(newSet)
  }

  const handleToggleAllColumns = (checked: boolean) => {
    if (checked) {
      setSelectedColumns(new Set(availableColumns))
    } else {
      setSelectedColumns(new Set())
    }
  }

  // When file is selected, show column picker
  const handleFileSelect = async (uploadId: string) => {
    const file = files.find(f => f.upload_id === uploadId)
    if (!file) return

    setSelectedFile(file)

    // Set default download filename
    const baseName = file.original_filename?.replace(/\.[^/.]+$/, '') || 'export'
    setDownloadFilename(`${baseName}_processed`)

    // Always show column picker for column selection before export
    if (!idToken) return

    setColumnModalOpen(true)
    setColumnsLoading(true)
    setColumnsError(null)

    try {
      const resp = await fileManagementAPI.getFileColumns(file.upload_id, idToken)
      const cols = resp.columns || []
      setAvailableColumns(cols)
      setSelectedColumns(new Set(cols)) // Select all columns by default
      if (cols.length === 0) {
        setColumnsError('No columns detected for this file. You can still proceed with export.')
      }
    } catch (error) {
      if (isPermissionError(error)) {
        notifyPermissionDenied()
      } else {
        console.error('Failed to fetch columns:', error)
      }
      setAvailableColumns([])
      setSelectedColumns(new Set())
      setColumnsError('Unable to fetch columns. You can proceed without column selection.')
    } finally {
      setColumnsLoading(false)
    }
  }

  // Handle column selection confirmation
  const handleColumnConfirm = async () => {
    if (!selectedFile || !idToken) return

    setColumnModalOpen(false)

    // If file is already processed, go directly to download
    if (selectedFile.status === 'DQ_FIXED' || selectedFile.status === 'COMPLETED') {
      setShowDownloadModal(true)
      return
    }

    // For unprocessed files, start processing with selected columns
    setProcessing(true)

    try {
      console.log('Processing file with selected columns:', Array.from(selectedColumns))

      // Trigger DQ processing
      await fileManagementAPI.startProcessing(
        selectedFile.upload_id,
        idToken,
        {
          selected_columns: Array.from(selectedColumns),
        }
      )

      // Poll for status updates
      let attempts = 0
      const maxAttempts = 60 // 60 seconds timeout

      const pollInterval = setInterval(async () => {
        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval)
          setProcessing(false)
          toast({
            title: 'Processing Timeout',
            description: 'Processing is taking longer than expected. Please check the file status in Explorer.',
            variant: 'destructive',
          })
          return
        }

        try {
          const updatedFiles = await fileManagementAPI.getUploads(idToken!)
          const updatedFile = updatedFiles.items?.find(f => f.upload_id === selectedFile.upload_id)

          if (updatedFile && (updatedFile.status === 'DQ_FIXED' || updatedFile.status === 'COMPLETED')) {
            clearInterval(pollInterval)
            setProcessing(false)
            setSelectedFile(updatedFile)

            toast({
              title: 'Processing Complete',
              description: `File processed successfully with a DQ score of ${updatedFile.dq_score}%`,
            })

            // Show download modal automatically
            setShowDownloadModal(true)

            // Refresh files list
            loadFiles()
          } else if (updatedFile && (updatedFile.status === 'FAILED' || updatedFile.status === 'DQ_FAILED')) {
            clearInterval(pollInterval)
            setProcessing(false)
            toast({
              title: 'Processing Error',
              description: 'Failed to process the file',
              variant: 'destructive',
            })
          }
        } catch (err) {
          if (isPermissionError(err)) {
            notifyPermissionDenied()
          } else {
            console.error('Error polling status:', err)
          }
        }
      }, 1000) // Poll every second
    } catch (error) {
      const denied = isPermissionError(error)
      if (denied) {
        notifyPermissionDenied()
      } else {
        console.error('Error processing file:', error)
        toast({
          title: 'Processing Error',
          description: (error as Error).message || 'Failed to process file',
          variant: 'destructive',
        })
      }
      setProcessing(false)
    }
  }

  const handleDownload = async (format: 'csv' | 'excel' | 'json', dataType: 'original' | 'clean') => {
    if (!selectedFile || !idToken) return

    setDownloading(true)
    try {
      let blob: Blob

      if (dataType === 'clean') {
        blob = await fileManagementAPI.downloadFile(
          selectedFile.upload_id,
          format,
          'clean',
          idToken
        )
      } else {
        blob = await fileManagementAPI.downloadFile(
          selectedFile.upload_id,
          format,
          'original',
          idToken
        )
      }

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const extension = format === 'excel' ? 'xlsx' : format
      const filename = downloadFilename || 'export'
      link.download = `${filename}.${extension}`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Download Complete',
        description: `Successfully downloaded ${dataType} data as ${format.toUpperCase()}`,
      })

      setShowDownloadModal(false)
    } catch (error) {
      if (isPermissionError(error)) {
        notifyPermissionDenied()
      } else {
        console.error('Download error:', error)
        toast({
          title: 'Download Error',
          description: (error as Error).message || 'Failed to download file',
          variant: 'destructive',
        })
      }
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-6 sm:p-12 lg:p-20 border-2 border-dashed rounded-xl bg-muted/5 space-y-6">
        <div className="rounded-full bg-primary/10 p-4 sm:p-6 lg:p-8 mb-2">
          <Download className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-primary" />
        </div>

        <h3 className="text-lg sm:text-xl lg:text-2xl font-medium text-center">
          Custom Destination
        </h3>

        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-lg text-center px-4">
          Select a file and export format to download your data
        </p>

        {/* File Selection */}
        <div className="w-full max-w-md space-y-2">
          <Label htmlFor="file-select">Select File</Label>
          <Select
            value={selectedFile?.upload_id || ''}
            onValueChange={handleFileSelect}
            disabled={loading || processing}
          >
            <SelectTrigger id="file-select">
              <SelectValue placeholder={loading ? 'Loading files...' : 'Choose a file to export'} />
            </SelectTrigger>
            <SelectContent>
              {[...files]
                .sort((a, b) => {
                  const dateA = new Date(a.updated_at || a.status_timestamp || 0).getTime();
                  const dateB = new Date(b.updated_at || b.status_timestamp || 0).getTime();
                  return dateB - dateA; // Descending order (newest first)
                })
                .map((file) => (
                  <SelectItem key={file.upload_id} value={file.upload_id}>
                    <div className="flex items-center gap-2">
                      <span>{file.original_filename || file.filename}</span>
                      {(file.status === 'DQ_FIXED' || file.status === 'COMPLETED') && (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Download Filename Customization */}
        {selectedFile && (
          <div className="w-full max-w-md space-y-2">
            <Label htmlFor="download-filename">Download Filename</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="download-filename"
                  value={downloadFilename}
                  onChange={(e) => setDownloadFilename(e.target.value)}
                  placeholder="export_file"
                  disabled={processing}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              File will be saved to your browser's default download folder
            </p>
          </div>
        )}

        {/* Processing Status */}
        {processing && (
          <Alert className="max-w-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="ml-2">
              Processing file... This may take a few moments.
            </AlertDescription>
          </Alert>
        )}

        {/* Format Selection */}
        {selectedFile && !processing && (
          <div className="w-full max-w-md space-y-4">
            {/*<div className="space-y-2">
              <Label>Export Format</Label>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant={selectedFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => onFormatChange('csv')}
                  size="lg"
                >
                  CSV
                </Button>
                <Button
                  variant={selectedFormat === 'excel' ? 'default' : 'outline'}
                  onClick={() => onFormatChange('excel')}
                  size="lg">
                  Excel
                </Button>
                <Button
                  variant={selectedFormat === 'json' ? 'default' : 'outline'}
                  onClick={() => onFormatChange('json')}
                  size="lg"
                >
                  JSON
                </Button>
                <Button
                  variant={selectedFormat === 'sql' ? 'default' : 'outline'}
                  onClick={() => onFormatChange('sql')}
                  size="lg"
                >
                  SQL
                </Button>
              </div>
            </div>*/}

            {(selectedFile.status === 'DQ_FIXED' || selectedFile.status === 'COMPLETED') && (
              <Button
                onClick={() => setShowDownloadModal(true)}
                className="w-full gap-2"
                size="lg"
              >
                <Download className="h-4 w-4" />
                Download File
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Column Picker Modal */}
      <AlertDialog open={columnModalOpen} onOpenChange={setColumnModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Columns to Export</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which columns from {selectedFile?.original_filename || selectedFile?.filename} should be included in the export. All columns are selected by default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {columnsLoading ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading columns...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-2 py-2 border-b">
                  <Checkbox
                    id="select-all-columns"
                    checked={
                      availableColumns.length > 0 &&
                      selectedColumns.size === availableColumns.length
                    }
                    onCheckedChange={(checked) => handleToggleAllColumns(Boolean(checked))}
                  />
                  <Label htmlFor="select-all-columns" className="text-sm font-medium cursor-pointer">
                    Select all
                  </Label>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {availableColumns.map((col) => (
                    <div key={col} className="flex items-center space-x-2">
                      <Checkbox
                        id={`col-${col}`}
                        checked={selectedColumns.has(col)}
                        onCheckedChange={(checked) => handleToggleColumn(col, Boolean(checked))}
                      />
                      <Label htmlFor={`col-${col}`} className="text-sm cursor-pointer flex-1 truncate">
                        {col}
                      </Label>
                    </div>
                  ))}
                  {availableColumns.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">
                      No columns detected. You can proceed without column selection.
                    </p>
                  )}
                </div>
                {columnsError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-xs">{columnsError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setColumnModalOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleColumnConfirm}
              disabled={columnsLoading || selectedColumns.size === 0}
              className="gap-2"
            >
              {selectedFile?.status === 'DQ_FIXED' || selectedFile?.status === 'COMPLETED'
                ? 'Download File'
                : 'Process & Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Modal */}
      <DownloadFormatModal
        open={showDownloadModal}
        onOpenChange={setShowDownloadModal}
        file={selectedFile}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </>
  )
}

