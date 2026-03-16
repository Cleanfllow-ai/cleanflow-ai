'use client'

/**
 * direct-upload-form.tsx
 *
 * Large-file upload form using S3 Multipart Upload via the persistent UploadManager.
 * Upload state survives tab switches and dialog close because it lives in context.
 */

import { useState, useCallback } from 'react'
import { FileUp, Loader2, Upload, X, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn, formatBytes } from '@/shared/lib/utils'
import { useUploadManager } from '@/modules/files/context/upload-manager'

const ACCEPTED = '.csv,.xlsx,.xls,.json,.txt'

interface DirectUploadFormProps {
  token: string
  getValidToken?: () => Promise<string>
  onUploadStart?: () => void
  onUploadComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
  onError: (error: string) => void
  disabled?: boolean
}

export default function DirectUploadForm({
  token,
  getValidToken,
  onUploadStart,
  onUploadComplete,
  onError,
  disabled,
}: DirectUploadFormProps) {
  const { activeUploads, startUpload, cancelUpload } = useUploadManager()
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Read upload state from the persistent manager (survives tab switches)
  const activeUpload = activeUploads.find(u => u.status === 'uploading')
  const isUploading = !!activeUpload
  const progress = activeUpload?.progress ?? null

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isUploading) setIsDragging(true)
  }, [disabled, isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || isUploading) return
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [disabled, isUploading])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleRemove = () => {
    setFile(null)
  }

  const handleUpload = async () => {
    if (!file || !token) return

    onUploadStart?.()

    try {
      // Get a guaranteed-valid token (refreshes if near expiry)
      const freshToken = getValidToken ? await getValidToken() : token
      const uploadId = await startUpload(file, freshToken, getValidToken)
      onUploadComplete({
        success: true,
        message: `${file.name} uploaded successfully (${formatBytes(file.size)})`,
        uploadId,
      })
      setFile(null)
    } catch (err: any) {
      onError(err?.message || 'Upload failed')
    }
  }

  const displayFile = file || (activeUpload ? { name: activeUpload.fileName, size: activeUpload.fileSize } : null)

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-all text-center',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <input
          type="file"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          accept={ACCEPTED}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={cn('p-3 rounded-full', isDragging ? 'bg-primary/10' : 'bg-muted')}>
            <FileUp className={cn('h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragging ? 'Drop file here' : 'Drag & drop or click to select'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV, Excel, JSON, or TXT — up to 50 GB
            </p>
          </div>
        </div>
      </div>

      {/* Selected file info */}
      {displayFile && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <div className="flex items-center gap-3 min-w-0">
            <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{displayFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(displayFile.size)}
              </p>
            </div>
          </div>
          {!isUploading && (
            <Button variant="ghost" size="icon" onClick={handleRemove} className="h-8 w-8 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Upload progress */}
      {isUploading && progress && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </div>
      )}
      {isUploading && !progress && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Initialising upload…
        </div>
      )}

      {/* Upload / Cancel buttons */}
      {isUploading ? (
        <Button
          variant="destructive"
          onClick={() => {
            if (activeUpload) cancelUpload(activeUpload.fileName)
          }}
          className="w-full gap-2"
        >
          <X className="h-4 w-4" />
          Cancel Upload
        </Button>
      ) : (
        <Button
          onClick={handleUpload}
          disabled={disabled || !file || !token}
          className="w-full gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload to Pipeline
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Direct upload to S3 — up to 50 GB
      </p>
    </div>
  )
}
