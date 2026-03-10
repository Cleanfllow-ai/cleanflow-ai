"use client"

import { useState, useCallback } from "react"
import { Upload, Loader2, FileUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn, formatBytes } from "@/shared/lib/utils"
import { fileManagementAPI } from "@/modules/files"

interface BinaryUploadFormProps {
    token: string
    onIngestionStart: () => void
    onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
    onError: (error: string) => void
    disabled?: boolean
}

export default function BinaryUploadForm({
    token,
    onIngestionStart,
    onIngestionComplete,
    onError,
    disabled,
}: BinaryUploadFormProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (!disabled && !isUploading) {
            setIsDragging(true)
        }
    }, [disabled, isUploading])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        if (disabled || isUploading) return

        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            setFile(droppedFile)
        }
    }, [disabled, isUploading])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleRemoveFile = () => {
        setFile(null)
        setProgress(0)
    }

    const handleUpload = async () => {
        if (!file) {
            onError("Please select a file")
            return
        }

        // Check file size (50MB max for Lambda payload)
        if (file.size > 50 * 1024 * 1024) {
            onError("File too large. Maximum size is 50MB for binary upload.")
            return
        }

        setIsUploading(true)
        setProgress(0)
        onIngestionStart()

        try {
            const result = await fileManagementAPI.uploadBinary(file, token, (p) => setProgress(p))

            onIngestionComplete({
                success: true,
                message: `Successfully uploaded ${result.filename} (${formatBytes(result.size_bytes)})`,
                uploadId: result.upload_id,
            })

            setFile(null)
            setProgress(0)
        } catch (err: any) {
            onError(err.message || "Binary upload failed")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "relative border-2 border-dashed rounded-lg p-8 transition-all text-center",
                    isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    disabled || isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                )}
            >
                <input
                    type="file"
                    onChange={handleFileChange}
                    disabled={disabled || isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    accept=".csv,.xlsx,.xls,.json,.txt"
                />

                <div className="flex flex-col items-center gap-3">
                    <div className={cn(
                        "p-3 rounded-full",
                        isDragging ? "bg-primary/10" : "bg-muted"
                    )}>
                        <FileUp className={cn(
                            "h-8 w-8",
                            isDragging ? "text-primary" : "text-muted-foreground"
                        )} />
                    </div>
                    <div>
                        <p className="text-sm font-medium">
                            {isDragging ? "Drop file here" : "Drag & drop or click to select"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            CSV, Excel, JSON, or TXT (max 50MB)
                        </p>
                    </div>
                </div>
            </div>

            {/* Selected File */}
            {file && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-3 min-w-0">
                        <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                        </div>
                    </div>
                    {!isUploading && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRemoveFile}
                            className="h-8 w-8 shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}

            {/* Progress */}
            {isUploading && (
                <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                        Uploading... {progress}%
                    </p>
                </div>
            )}

            {/* Upload Button */}
            <Button
                onClick={handleUpload}
                disabled={disabled || isUploading || !file}
                className="w-full gap-2"
            >
                {isUploading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <Upload className="h-4 w-4" />
                        Upload to Pipeline
                    </>
                )}
            </Button>

            {/* Info */}
            <p className="text-xs text-muted-foreground text-center">
                Files are uploaded directly via the API and processed by the DQ pipeline
            </p>
        </div>
    )
}
