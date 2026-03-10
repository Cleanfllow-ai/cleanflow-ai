"use client"

import React, { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle, XCircle, Play, RotateCw } from "lucide-react"
import { useProcessingWizard } from "./WizardContext"
import { fileManagementAPI } from "@/modules/files"

interface ProcessStepProps {
    onComplete?: () => void
}

export function ProcessStep({ onComplete }: ProcessStepProps) {
    const {
        uploadId,
        authToken,
        selectedColumns,
        requiredColumns,
        customRules,
        disabledRules,
        isProcessing,
        processingError,
        startProcessing,
        setProcessingError,
    } = useProcessingWizard()

    const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState("")

    // Poll for status updates
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null
        const MAX_POLL_DURATION = 5 * 60 * 1000 // 5 minutes
        const startTime = Date.now()

        if (status === "processing" && authToken) {
            interval = setInterval(async () => {
                // Check for timeout
                if (Date.now() - startTime > MAX_POLL_DURATION) {
                    setStatus("error")
                    setProcessingError("Processing timeout - operation took longer than expected")
                    if (interval) clearInterval(interval)
                    return
                }

                try {
                    const response = await fileManagementAPI.getFileStatus(uploadId, authToken)
                    const fileStatus = response.status

                    if (fileStatus === "DQ_FIXED") {
                        setStatus("success")
                        setProgress(100)
                        setStatusMessage("Processing complete!")
                        if (interval) clearInterval(interval)
                    } else if (fileStatus === "DQ_FAILED") {
                        setStatus("error")
                        setProcessingError("Processing failed")
                        if (interval) clearInterval(interval)
                    } else if (fileStatus === "DQ_RUNNING") {
                        setProgress((prev) => Math.min(prev + 5, 90))
                        setStatusMessage("Processing data quality rules...")
                    } else if (fileStatus === "QUEUED") {
                        setStatusMessage("Queued for processing...")
                    }
                } catch (err) {
                    console.error("Failed to get status:", err)
                }
            }, 2000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [status, uploadId, authToken])

    const handleStartProcessing = async () => {
        if (!authToken) {
            setStatus("error")
            setProcessingError("Authentication token not available")
            return
        }

        setStatus("processing")
        setProgress(10)
        setStatusMessage("Starting processing...")
        startProcessing()

        try {
            await fileManagementAPI.startProcessing(uploadId, authToken, {
                selected_columns: selectedColumns,
                required_columns: requiredColumns,
                custom_rules: customRules,
                global_disabled_rules: disabledRules,
            })
            setProgress(20)
            setStatusMessage("Processing started, monitoring progress...")
        } catch (err: any) {
            setStatus("error")
            setProcessingError(err.message || "Failed to start processing")
        }
    }

    const handleRetry = () => {
        setStatus("idle")
        setProgress(0)
        setProcessingError(null)
    }

    const handleComplete = () => {
        if (onComplete) onComplete()
    }

    // Auto-close after 3 seconds on success
    useEffect(() => {
        if (status === "success") {
            const timer = setTimeout(() => {
                handleComplete()
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [status])

    return (
        <div className="flex flex-col items-center justify-center h-[60vh] p-8">
            {status === "idle" && (
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Play className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Ready to Process</h2>
                        <p className="text-muted-foreground mt-2 max-w-md">
                            {selectedColumns.length} columns selected with {customRules.length} custom rules.
                            Click the button below to start processing.
                        </p>
                    </div>
                    <div className="text-sm text-muted-foreground border border-muted rounded-lg p-4 max-w-md">
                        <div className="grid grid-cols-2 gap-y-2 text-left">
                            <span>Columns:</span>
                            <span className="font-medium">{selectedColumns.length}</span>
                            <span>Required:</span>
                            <span className="font-medium">{requiredColumns.length}</span>
                            <span>Custom Rules:</span>
                            <span className="font-medium">{customRules.length}</span>
                        </div>
                    </div>
                    <Button
                        size="lg"
                        onClick={handleStartProcessing}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={!authToken}
                    >
                        <Play className="w-5 h-5 mr-2" />
                        Start Processing
                    </Button>
                </div>
            )}

            {status === "processing" && (
                <div className="text-center space-y-6 w-full max-w-md">
                    <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
                    <div>
                        <h2 className="text-xl font-semibold">Processing...</h2>
                        <p className="text-muted-foreground mt-2">{statusMessage}</p>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground">{progress}% complete</p>
                </div>
            )}

            {status === "success" && (
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-green-500">Processing Complete!</h2>
                        <p className="text-muted-foreground mt-2">
                            Your file has been processed successfully. Closing in 3 seconds...
                        </p>
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                        <XCircle className="w-12 h-12 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-red-500">Processing Failed</h2>
                        <p className="text-muted-foreground mt-2 max-w-md">
                            {processingError || "An error occurred during processing."}
                        </p>
                    </div>
                    <Button size="lg" variant="outline" onClick={handleRetry}>
                        <RotateCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </div>
            )}
        </div>
    )
}
