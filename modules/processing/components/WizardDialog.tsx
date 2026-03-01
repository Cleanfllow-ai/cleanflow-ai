"use client"

import React, { useEffect, useState } from "react"
import { Loader2, RotateCcw, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ProcessingWizard } from "./ProcessingWizard"
import { ProcessingWizardProvider, useProcessingWizard } from "./WizardContext"
import { fileManagementAPI } from "@/modules/files"
import type { FileStatusResponse } from "@/modules/files"

interface WizardDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    file: FileStatusResponse | null
    authToken: string
    onComplete?: () => void
    onStarted?: () => void
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
            <div className="flex flex-col items-center justify-center h-64 gap-4 px-8 text-center">
                <RotateCcw className="w-10 h-10 text-primary/60" />
                <div>
                    <h3 className="text-base font-medium mb-1">Resume where you left off?</h3>
                    <p className="text-sm text-muted-foreground">
                        You have unsaved progress for this file from a previous session.
                    </p>
                </div>
                <div className="flex gap-3 mt-2">
                    <Button onClick={handleResume}>
                        <RotateCcw className="h-4 w-4 mr-1.5" />
                        Resume
                    </Button>
                    <Button variant="outline" onClick={handleStartFresh}>
                        <PlayCircle className="h-4 w-4 mr-1.5" />
                        Start Fresh
                    </Button>
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

export function WizardDialog({
    open,
    onOpenChange,
    file,
    authToken,
    onComplete,
    onStarted,
}: WizardDialogProps) {
    if (!file) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-muted/40">
                    <DialogTitle>Process: {file.original_filename}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ProcessingWizardProvider>
                        <WizardInitializer
                            file={file}
                            authToken={authToken}
                            onComplete={onComplete}
                            onStarted={onStarted}
                            onClose={() => onOpenChange(false)}
                        />
                    </ProcessingWizardProvider>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default WizardDialog
