"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle, Play, RotateCw } from "lucide-react"
import { useProcessingWizard } from "../WizardContext"
import { fileManagementAPI, type FileStatusResponse, FileDetailsDialog } from "@/modules/files"

export function ProcessStep({
  onComplete,
  onStarted,
}: {
  onComplete?: () => void
  onStarted?: () => void
}) {
  const {
    uploadId,
    authToken,
    selectedColumns,
    requiredColumns,
    customRules,
    globalRules,
    columnRules,
    columnCoreTypes,
    columnTypeAliases,
    columnKeyTypes,
    columnNullable,
    crossFieldRules,
    selectedPreset,
    presetOverrides,
    setProcessing,
    setProcessingError,
    prevStep,
  } = useProcessingWizard()

  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [fileData, setFileData] = useState<FileStatusResponse | null>(null)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const MAX_POLL = 5 * 60 * 1000
    const start = Date.now()

    if (status === "processing" && authToken) {
      interval = setInterval(async () => {
        if (Date.now() - start > MAX_POLL) {
          setStatus("error")
          setProcessingError("Processing timeout - took longer than expected")
          if (interval) clearInterval(interval)
          return
        }
        try {
          const resp = await fileManagementAPI.getFileStatus(uploadId, authToken)
          const fileStatus = resp.status
          if (fileStatus === "DQ_FIXED" || fileStatus === "COMPLETED") {
            setStatus("success")
            setProgress(100)
            setStatusMessage("Processing complete!")
            if (interval) clearInterval(interval)
          } else if (fileStatus === "DQ_FAILED" || fileStatus === "FAILED") {
            setStatus("error")
            setProcessingError("Processing failed")
            if (interval) clearInterval(interval)
          } else if (["QUEUED", "DQ_DISPATCHED", "UPLOADING", "NORMALIZING"].includes(fileStatus)) {
            setProgress((prev) => Math.max(prev, 20))
            setStatusMessage("Queued for processing...")
          } else if (["DQ_RUNNING", "VALIDATED"].includes(fileStatus)) {
            setProgress((prev) => Math.min(prev + 5, 92))
            setStatusMessage("Running data quality checks...")
          }
        } catch (err) {
          console.error("Failed to get status", err)
        }
      }, 2000)
    }
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [status, uploadId, authToken, setProcessingError])

  const handleStart = async () => {
    if (!authToken) {
      setStatus("error")
      setProcessingError("Auth token missing")
      return
    }
    setStatus("processing")
    setProcessing(true)
    setProgress(10)
    setStatusMessage("Starting processing...")

    try {
      const globalDisabled = (globalRules || []).filter((r) => !r.selected).map((r) => r.rule_id)
      const perColumnDisabled: Record<string, string[]> = {}
      Object.entries(columnRules || {}).forEach(([col, rules]) => {
        const disabled = rules.filter((r) => !r.selected).map((r) => r.rule_id)
        if (disabled.length > 0) perColumnDisabled[col] = disabled
      })

      const columnTypeOverrides: Record<string, any> = {}
      selectedColumns.forEach((col) => {
        columnTypeOverrides[col] = {
          core_type: columnCoreTypes[col] || "string",
          type_alias: columnTypeAliases[col] || null,
          key_type: columnKeyTypes[col] || "none",
          nullable: columnNullable[col] !== undefined ? columnNullable[col] : true,
        }
      })

      const compactCrossRules = crossFieldRules
        .filter((r) => r.enabled)
        .map((r) => ({
          rule_id: r.rule_id,
          cols: r.cols,
          predicate: r.predicate || r.condition || "",
          relationship: r.relationship || "",
          condition: r.condition || r.predicate || "",
          confidence: r.confidence,
          tolerance: r.tolerance,
          reasoning: r.reasoning || "",
          enabled: true,
        }))

      await fileManagementAPI.startProcessing(uploadId, authToken, {
        selected_columns: selectedColumns,
        required_columns: requiredColumns,
        custom_rules: customRules,
        global_disabled_rules: globalDisabled,
        disable_rules: perColumnDisabled,
        preset_id: selectedPreset?.preset_id,
        preset_overrides: presetOverrides,
        column_type_overrides: columnTypeOverrides,
        cross_field_rules: compactCrossRules,
      })
      setStatusMessage("Processing started, monitoring progress...")
      if (onStarted) onStarted()
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

  const handleComplete = async () => {
    try {
      if (authToken) {
        const fileResponse = await fileManagementAPI.getFileStatus(uploadId, authToken)
        setFileData(fileResponse)
        setShowDetailsDialog(true)
      }
    } catch (err) {
      console.error("Failed to fetch file data", err)
    }
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
    <>
      <div className="flex flex-col items-center justify-center h-[60vh] p-8">
        {status === "idle" && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Play className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Ready to Process</h2>
              <p className="text-muted-foreground mt-2 max-w-md">
                {selectedColumns.length} columns selected with {customRules.length} custom rules. Click below to start.
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
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="lg" onClick={prevStep}>
                Back
              </Button>
              <Button size="lg" onClick={handleStart} className="bg-green-600 hover:bg-green-700" disabled={!authToken}>
                <Play className="w-5 h-5 mr-2" />
                Start Processing
              </Button>
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="text-center space-y-6 w-full max-w-md">
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
            <div>
              <h2 className="text-xl font-semibold">Processing...</h2>
              <p className="text-muted-foreground mt-2">{statusMessage}</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-500">Processing Complete!</h2>
              <p className="text-muted-foreground mt-2">Your file has been processed successfully. Closing in 3 seconds...</p>
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
                Processing failed or timed out. Please retry.
              </p>
            </div>
            <Button size="lg" variant="outline" onClick={handleRetry}>
              <RotateCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}
      </div>

      <FileDetailsDialog
        file={fileData}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
    </>
  )
}
