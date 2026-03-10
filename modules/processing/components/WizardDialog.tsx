"use client"

import React, { useEffect, useState } from "react"
import { Loader2, RotateCcw, PlayCircle, Clock, FileText } from "lucide-react"
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

// Inner component that uses the wizard context
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
    const [columnsCache, setColumnsCache] = useState<string[]>([])

    useEffect(() => {
        const loadColumns = async () => {
            try {
                const resp = await fileManagementAPI.getFileColumns(file.upload_id, authToken)
                const cols = resp.columns || []
                setColumnsCache(cols)

                // Check for saved wizard state
                if (hasSavedState(file.upload_id)) {
                    setShowResume(true)
                    setLoading(false)
                    return
                }

                initializeWithFile(file.upload_id, file.original_filename || "Unknown", cols, authToken)
            } catch (e: any) {
                console.error("Failed to load columns:", e)
                setError(e.message || "Failed to load columns")
            } finally {
                setLoading(false)
            }
        }
        loadColumns()
    }, [file.upload_id, authToken])

    const handleResume = () => {
        restoreSavedState(file.upload_id, authToken)
        setShowResume(false)
    }

    const handleStartFresh = () => {
        initializeWithFile(file.upload_id, file.original_filename || "Unknown", columnsCache, authToken)
        setShowResume(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading columns...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8 text-center text-destructive">
                <p>{error}</p>
            </div>
        )
    }

    if (showResume) {
        return (
            <div className="flex items-center justify-center h-full px-6 relative overflow-hidden">
                {/* Decorative background circles */}
                <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-primary/[0.03] blur-3xl" />
                <div className="absolute bottom-1/4 -right-20 w-64 h-64 rounded-full bg-violet-500/[0.03] blur-3xl" />

                <div className="w-full max-w-lg relative">
                    {/* Main card */}
                    <div className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
                        {/* Top accent bar */}
                        <div className="h-1 bg-gradient-to-r from-primary via-violet-500 to-primary" />

                        <div className="p-8 space-y-7">
                            {/* Icon + heading */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/10 flex items-center justify-center shadow-sm border border-primary/10">
                                        <RotateCcw className="w-7 h-7 text-primary" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                                        <Clock className="w-3 h-3 text-white" />
                                    </div>
                                </div>
                                <div className="text-center space-y-1.5">
                                    <h3 className="text-xl font-semibold tracking-tight">Resume where you left off?</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                                        You have unsaved progress for this file from a previous session.
                                    </p>
                                </div>
                            </div>

                            {/* File info chip */}
                            <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border/50 px-4 py-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{file.original_filename || "Unknown file"}</p>
                                    <p className="text-xs text-muted-foreground">Processing configuration saved</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                                <Button onClick={handleResume} size="lg" className="flex-1 h-12 gap-2 shadow-sm shadow-primary/20">
                                    <RotateCcw className="h-4 w-4" />
                                    Resume
                                </Button>
                                <Button variant="outline" size="lg" onClick={handleStartFresh} className="flex-1 h-12 gap-2">
                                    <PlayCircle className="h-4 w-4" />
                                    Start Fresh
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ProcessingWizard
            onClose={onClose}
            onStarted={onStarted}
            onComplete={() => {
                onClose()
                if (onComplete) onComplete()
            }}
        />
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
            onUploadComplete={() => {
                onClose()
                if (onComplete) onComplete()
            }}
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
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-muted/40">
                    <DialogTitle>
                        {mode === "new" ? "Import File" : `Process: ${file?.original_filename || file?.filename}`}
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
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
