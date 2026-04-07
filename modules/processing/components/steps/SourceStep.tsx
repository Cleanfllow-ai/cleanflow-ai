"use client"

import React, { useRef, useState, useEffect } from "react"
import {
    Upload,
    Loader2,
    Network,
    CloudUpload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/shared/lib/utils"
import { ERPImport } from "@/modules/connectors"
import { UnifiedBridgeImport } from "@/modules/unified-bridge"
import { fileManagementAPI } from "@/modules/files"
import { useProcessingWizard } from "../WizardContext"
import { SOURCE_OPTIONS, ERP_OPTIONS } from "@/modules/files/page/constants"
import { useUploadManager } from "@/modules/files/context/upload-manager"

interface SourceStepProps {
    onUploadComplete?: () => void
}

export function SourceStep({ onUploadComplete }: SourceStepProps = {}) {
    const { authToken, initializeWithFile, nextStep } = useProcessingWizard()
    const { activeUploads, startUpload } = useUploadManager()

    const [selectedSource, setSelectedSource] = useState("local")
    const [selectedErp, setSelectedErp] = useState("quickbooks")
    const [dragActive, setDragActive] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [loadingColumns, setLoadingColumns] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    // Read upload state from the persistent upload manager (survives tab switches & dialog close)
    const activeUpload = activeUploads.find(u => u.status === 'uploading')
    const uploading = !!activeUpload
    const uploadProgress = activeUpload?.progress?.percent ?? 0

    const handleUploadSuccess = async (uploadId: string, fileName: string) => {
        if (onUploadComplete) {
            onUploadComplete()
            return
        }
        try {
            setLoadingColumns(true)
            setUploadError(null)
            const colsResp = await fileManagementAPI.getFileColumns(uploadId, authToken)
            initializeWithFile(uploadId, fileName, colsResp.columns || [], authToken)
            nextStep()
        } catch (e: any) {
            setUploadError("Failed to load file columns. Please try again.")
        } finally {
            setLoadingColumns(false)
        }
    }

    const handleImportComplete = async (uploadId: string) => {
        if (onUploadComplete) {
            onUploadComplete()
            return
        }
        try {
            setLoadingColumns(true)
            setUploadError(null)
            const [colsResp, statusResp] = await Promise.allSettled([
                fileManagementAPI.getFileColumns(uploadId, authToken),
                fileManagementAPI.getFileStatus(uploadId, authToken),
            ])
            const cols = colsResp.status === "fulfilled" ? colsResp.value.columns || [] : []
            const fileName =
                statusResp.status === "fulfilled"
                    ? statusResp.value?.original_filename || statusResp.value?.filename || "imported-file"
                    : "imported-file"
            initializeWithFile(uploadId, fileName, cols, authToken)
            nextStep()
        } catch (e: any) {
            setUploadError("Failed to load file data. Please try again.")
        } finally {
            setLoadingColumns(false)
        }
    }

    const handleLocalFile = async (file: File) => {
        const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`
        const validExtensions = [".csv", ".xlsx", ".xls", ".json"]
        if (!validExtensions.includes(extension)) {
            setUploadError("Please upload a CSV, Excel, or JSON file")
            return
        }
        setUploadError(null)
        try {
            // Upload via the persistent manager — survives tab switches and dialog close
            const uploadId = await startUpload(file, authToken)
            // If component unmounted during upload (dialog closed/tab switched), stop here
            if (!mountedRef.current) return
            await handleUploadSuccess(uploadId, file.name)
        } catch (e: any) {
            if (!mountedRef.current) return
            const message = e?.message?.toLowerCase() || ""
            setUploadError(
                message.includes("permission denied")
                    ? "You do not have permission to upload files."
                    : "Upload failed. Please try again.",
            )
        }
    }

    const handleDrag = (event: React.DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.type === "dragenter" || event.type === "dragover") {
            setDragActive(true)
        } else if (event.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setDragActive(false)
        const file = event.dataTransfer.files?.[0]
        if (file) handleLocalFile(file)
    }

    const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) handleLocalFile(file)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    if (loadingColumns) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Processing...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full overflow-auto p-6 space-y-5">
            {/* Source selector — disabled while uploading */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">Source:</span>
                    <Select value={selectedSource} onValueChange={setSelectedSource} disabled={uploading}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                            {SOURCE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedSource === "erp" && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground shrink-0">ERP:</span>
                        <Select value={selectedErp} onValueChange={setSelectedErp}>
                            <SelectTrigger className="w-[200px] h-9">
                                <SelectValue placeholder="Select ERP" />
                            </SelectTrigger>
                            <SelectContent>
                                {ERP_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Error message */}
            {uploadError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {uploadError}
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 min-h-0">
                {selectedSource === "local" ? (
                    <div
                        className={cn(
                            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed min-h-[320px] p-12 transition-all cursor-pointer",
                            dragActive
                                ? "border-primary bg-primary/5 scale-[1.01]"
                                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
                            (uploading) && "pointer-events-none",
                        )}
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => {
                            if (uploading) return
                            fileInputRef.current?.click()
                        }}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center gap-6">
                                <Loader2 className="h-14 w-14 animate-spin text-primary" />
                                <div className="text-center">
                                    <p className="text-base font-medium">
                                        Uploading{activeUpload?.fileName ? ` ${activeUpload.fileName}` : ''}...
                                    </p>
                                    <p className="text-3xl font-bold text-primary mt-1">
                                        {uploadProgress.toFixed(1)}%
                                    </p>
                                </div>
                                <Progress value={uploadProgress} className="w-60 h-2" />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-5 text-center">
                                <div className="rounded-full bg-primary/10 p-6">
                                    <CloudUpload className="h-12 w-12 text-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-lg font-medium">Drop your file here or click to browse</p>
                                    <p className="text-sm text-muted-foreground">
                                        Supports CSV, Excel (.xlsx, .xls), and JSON — up to 50 GB
                                    </p>
                                </div>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls,.json"
                            className="hidden"
                            onChange={handleFileInput}
                        />
                    </div>
                ) : selectedSource === "unified-bridge" ? (
                    <div className="min-h-[320px] rounded-xl border bg-card p-4">
                        <UnifiedBridgeImport
                            mode="source"
                            onImportComplete={handleImportComplete}
                            onPermissionDenied={() => setUploadError("You do not have permission for this action.")}
                            onNotification={() => {}}
                        />
                    </div>
                ) : selectedSource === "erp" && selectedErp === "quickbooks" ? (
                    <div className="min-h-[320px]">
                        <ERPImport
                            provider="quickbooks"
                            mode="source"
                            onImportComplete={handleImportComplete}
                            onPermissionDenied={() => setUploadError("You do not have permission for this action.")}
                            onNotification={() => {}}
                        />
                    </div>
                ) : selectedSource === "erp" && selectedErp === "zoho-books" ? (
                    <div className="min-h-[320px]">
                        <ERPImport
                            provider="zohobooks"
                            mode="source"
                            onImportComplete={handleImportComplete}
                            onPermissionDenied={() => setUploadError("You do not have permission for this action.")}
                            onNotification={() => {}}
                        />
                    </div>
                ) : selectedSource === "erp" ? (
                    <div className="flex flex-col items-center justify-center min-h-[320px] p-12 border-2 border-dashed rounded-xl bg-muted/5">
                        <div className="rounded-full bg-muted p-6 mb-6">
                            <Network className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-medium mb-3 text-center">
                            {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-8 max-w-md text-center">
                            Connect your{" "}
                            {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}{" "}
                            account to import data directly.
                        </p>
                        <Button disabled size="lg" className="px-8">
                            Connect
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-5 text-center min-h-[320px] justify-center">
                        <div className="rounded-full bg-primary/10 p-6">
                            <Upload className="h-12 w-12 text-primary" />
                        </div>
                        <p className="text-lg font-medium">Select a source to get started</p>
                    </div>
                )}
            </div>
        </div>
    )
}
