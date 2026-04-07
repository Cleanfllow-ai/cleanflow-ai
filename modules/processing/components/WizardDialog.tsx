"use client"

import React, { useEffect, useState } from "react"
import { Loader2, RotateCcw, PlayCircle, Clock, FileText, Zap, Settings2, CheckCircle, XCircle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ProcessingWizard } from "./ProcessingWizard"
import { SourceStep } from "./steps/SourceStep"
import { ProcessingWizardProvider, useProcessingWizard } from "./WizardContext"
import { fileManagementAPI } from "@/modules/files"
import type { FileStatusResponse } from "@/modules/files"

interface WizardDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    file?: FileStatusResponse | null
    authToken: string
    onComplete?: () => void
    onStarted?: () => void
    mode?: "new" | "existing"
}

/* ═══════════════════════════════════════════════════════════════════════════
   Quick Process View — calls startProcessing with defaults, polls for status
   Shows the same processing/success/error UI as the wizard's ProcessStep
   ═══════════════════════════════════════════════════════════════════════════ */

function QuickProcessView({
    file,
    authToken,
    onComplete,
    onClose,
    onFallbackToAdvanced,
}: {
    file: FileStatusResponse
    authToken: string
    onComplete?: () => void
    onClose: () => void
    onFallbackToAdvanced?: () => void
}) {
    const [status, setStatus] = useState<"starting" | "processing" | "success" | "error">("starting")
    const [statusMessage, setStatusMessage] = useState("Starting processing...")
    const [errorMsg, setErrorMsg] = useState("")

    // Start processing immediately on mount
    useEffect(() => {
        const start = async () => {
            try {
                await fileManagementAPI.startProcessing(file.upload_id, authToken)
                setStatus("processing")
                setStatusMessage("Processing started, running quality checks...")
            } catch (e: any) {
                setStatus("error")
                setErrorMsg(e.message || "Failed to start processing")
            }
        }
        start()
    }, [file.upload_id, authToken])

    // Poll for status while processing
    useEffect(() => {
        if (status !== "processing") return
        const MAX_POLL = 5 * 60 * 1000
        const start = Date.now()

        const interval = setInterval(async () => {
            if (Date.now() - start > MAX_POLL) {
                setStatus("error")
                setErrorMsg("Processing timed out — check the file status in Data Catalog")
                clearInterval(interval)
                return
            }
            try {
                const resp = await fileManagementAPI.getFileStatus(file.upload_id, authToken)
                const fileStatus = resp.status
                if (fileStatus === "DQ_FIXED" || fileStatus === "COMPLETED") {
                    setStatus("success")
                    setStatusMessage("Complete!")
                    clearInterval(interval)
                } else if (fileStatus === "DQ_FAILED" || fileStatus === "FAILED") {
                    setStatus("error")
                    const detail = (resp as any).error_message || (resp as any).failure_reason || ""
                    setErrorMsg(detail
                        ? `Processing failed: ${detail}`
                        : "Processing encountered errors. Try Advanced Configuration for more control, or check the file in Data Catalog."
                    )
                    clearInterval(interval)
                } else if (["QUEUED", "DQ_DISPATCHED"].includes(fileStatus)) {
                    setStatusMessage("Queued for processing...")
                } else if (["DQ_RUNNING", "NORMALIZING"].includes(fileStatus)) {
                    setStatusMessage("Running data quality checks...")
                }
            } catch (err) {
                console.error("Polling error:", err)
            }
        }, 2500)

        return () => clearInterval(interval)
    }, [status, file.upload_id, authToken])

    // Auto-close after success
    useEffect(() => {
        if (status === "success") {
            const timer = setTimeout(() => {
                onClose()
                if (onComplete) onComplete()
            }, 2500)
            return () => clearTimeout(timer)
        }
    }, [status, onClose, onComplete])

    const filename = file.original_filename || file.filename || "File"

    return (
        <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-full max-w-sm text-center space-y-5">

                {(status === "starting" || status === "processing") && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                            <Loader2 className="w-7 h-7 text-primary animate-spin" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-foreground">
                                {status === "starting" ? "Starting..." : "Processing"}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">{filename}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{statusMessage}</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                            <CheckCircle className="w-7 h-7 text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-emerald-600">Processing Complete</h3>
                            <p className="text-sm text-muted-foreground mt-1">{filename}</p>
                            <p className="text-xs text-muted-foreground mt-2">Closing automatically...</p>
                        </div>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
                            <XCircle className="w-7 h-7 text-destructive" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-destructive">Processing Failed</h3>
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{errorMsg}</p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                            {onFallbackToAdvanced && (
                                <Button size="sm" onClick={onFallbackToAdvanced} className="gap-1.5">
                                    <Settings2 className="w-3.5 h-3.5" />
                                    Try Advanced
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Landing page: Process Now vs Advanced Configuration
   ═══════════════════════════════════════════════════════════════════════════ */

function WizardInitializer({
    file,
    authToken,
    onComplete,
    onStarted,
    onClose,
}: {
    file: FileStatusResponse
    authToken: string
    onComplete?: () => void
    onStarted?: () => void
    onClose: () => void
}) {
    const { initializeWithFile, hasSavedState, restoreSavedState } = useProcessingWizard()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showResume, setShowResume] = useState(false)
    const [mode, setMode] = useState<"landing" | "quick" | "wizard">("landing")
    const [columnsCache, setColumnsCache] = useState<string[]>([])

    useEffect(() => {
        const loadColumns = async () => {
            try {
                const resp = await fileManagementAPI.getFileColumns(file.upload_id, authToken)
                setColumnsCache(resp.columns || [])

                if (hasSavedState(file.upload_id)) {
                    setMode("landing")
                    setShowResume(true)
                }
            } catch (e: any) {
                console.error("Failed to load columns:", e)
                setError(e.message || "Failed to load columns")
            } finally {
                setLoading(false)
            }
        }
        loadColumns()
    }, [file.upload_id, authToken])

    const handleAdvanced = () => {
        initializeWithFile(file.upload_id, file.original_filename || "Unknown", columnsCache, authToken)
        setMode("wizard")
    }

    const handleResume = () => {
        restoreSavedState(file.upload_id, authToken)
        setShowResume(false)
        setMode("wizard")
    }

    const handleStartFresh = () => {
        initializeWithFile(file.upload_id, file.original_filename || "Unknown", columnsCache, authToken)
        setShowResume(false)
        setMode("wizard")
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading file info...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
        )
    }

    // Quick Process — show processing UI
    if (mode === "quick") {
        return (
            <QuickProcessView
                file={file}
                authToken={authToken}
                onComplete={onComplete}
                onClose={onClose}
                onFallbackToAdvanced={handleAdvanced}
            />
        )
    }

    // Full wizard
    if (mode === "wizard") {
        return (
            <ProcessingWizard
                onClose={onClose}
                onStarted={onStarted}
                onComplete={() => { onClose(); if (onComplete) onComplete() }}
            />
        )
    }

    // Resume prompt
    if (showResume) {
        return (
            <div className="flex items-center justify-center h-full px-6">
                <div className="w-full max-w-sm space-y-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                        <RotateCcw className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold">Resume previous session?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            You have unsaved progress for this file.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleResume} className="flex-1 h-9 gap-2">
                            <RotateCcw className="h-3.5 w-3.5" /> Resume
                        </Button>
                        <Button variant="outline" onClick={handleStartFresh} className="flex-1 h-9 gap-2">
                            <PlayCircle className="h-3.5 w-3.5" /> Start Fresh
                        </Button>
                    </div>
                    <button
                        onClick={() => { setShowResume(false); setMode("landing") }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        Back to options
                    </button>
                </div>
            </div>
        )
    }

    // Landing page — Process Now vs Advanced
    const filename = file.original_filename || file.filename || "Untitled"
    const fileSize = file.input_size_bytes || file.file_size || 0
    const sizeLabel = fileSize > 1024 * 1024
        ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
        : fileSize > 0
        ? `${(fileSize / 1024).toFixed(0)} KB`
        : null

    return (
        <div className="flex items-center justify-center h-full px-6">
            <div className="w-full max-w-sm space-y-6 text-center">
                {/* File info */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 text-left">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{filename}</p>
                        {sizeLabel && <p className="text-xs text-muted-foreground">{sizeLabel}</p>}
                    </div>
                </div>

                {/* Process Now */}
                <div className="space-y-2">
                    <Button
                        size="lg"
                        className="w-full h-11 text-sm font-semibold gap-2"
                        onClick={() => setMode("quick")}
                    >
                        <Zap className="w-4 h-4" />
                        Process Now
                    </Button>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Auto-detects column types, applies all default AI rules, and starts processing immediately.
                    </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-muted-foreground">or</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Advanced */}
                <div className="space-y-2">
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full h-10 text-sm gap-2"
                        onClick={handleAdvanced}
                    >
                        <Settings2 className="w-4 h-4" />
                        Advanced Configuration
                    </Button>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Select columns, review profiling, configure rules, and customize settings.
                    </p>
                </div>
            </div>
        </div>
    )
}

function ImportOnlyInitializer({
    authToken,
    onComplete,
    onClose,
}: {
    authToken: string
    onComplete?: () => void
    onClose: () => void
}) {
    const { initializeNew } = useProcessingWizard()
    const [initialized, setInitialized] = React.useState(false)

    React.useEffect(() => {
        initializeNew(authToken)
        setInitialized(true)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    if (!initialized) return null

    return (
        <SourceStep
            onUploadComplete={() => { onClose(); if (onComplete) onComplete() }}
        />
    )
}

export function WizardDialog({
    open,
    onOpenChange,
    file,
    authToken,
    onComplete,
    onStarted,
    mode = "existing",
}: WizardDialogProps) {
    if (mode === "existing" && !file) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={mode === "new"
                ? "max-w-xl flex flex-col p-0 gap-0 overflow-hidden"
                : "max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
            }>
                <DialogHeader className="px-6 py-3 border-b shrink-0">
                    <DialogTitle className="text-base font-semibold tracking-tight">
                        {mode === "new" ? "Import File" : `Process: ${file?.original_filename || file?.filename}`}
                    </DialogTitle>
                </DialogHeader>
                <div className={mode === "new" ? "overflow-hidden" : "flex-1 overflow-hidden"}>
                    <ProcessingWizardProvider>
                        {mode === "new" ? (
                            <ImportOnlyInitializer
                                authToken={authToken}
                                onComplete={onComplete}
                                onClose={() => onOpenChange(false)}
                            />
                        ) : (
                            <WizardInitializer
                                file={file!}
                                authToken={authToken}
                                onComplete={onComplete}
                                onStarted={onStarted}
                                onClose={() => onOpenChange(false)}
                            />
                        )}
                    </ProcessingWizardProvider>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default WizardDialog
