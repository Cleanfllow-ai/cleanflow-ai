"use client"

import React, { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle, Play, RotateCw } from "lucide-react"
import { useProcessingWizard } from "../WizardContext"
import { fileManagementAPI, type FileStatusResponse, FileDetailsDialog } from "@/modules/files"
import { isApiError } from "@/modules/shared/api-error"

/** Map an /files/{id}/process or /files/{id}/status error to a user-friendly message. */
function formatProcessError(err: unknown): string {
  if (isApiError(err)) {
    if (err.status === 401) return "Your sign-in session has expired. Please refresh and retry."
    if (err.status === 403) return "You do not have permission to process this file."
    if (err.status === 404) return "File no longer exists — refresh the catalog."
    if (err.status === 409) return err.message || "File is already being processed."
    if (err.status === 413) return "Process payload is too large. Reduce custom rules and retry."
    if (err.status >= 500) return "Server error while starting processing. Try again in a moment."
    return err.message || "Failed to start processing"
  }
  return (err as { message?: string })?.message || "Failed to start processing"
}

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
    columnCurrencyCodes,
    crossFieldRules,
    selectedPreset,
    presetOverrides,
    augmentations,
    processingError,
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
    // 10 minutes — covers large files; the dialog auto-closes after 3 s from
    // a successful start so the user can keep working while we poll in the
    // background.
    const MAX_POLL = 10 * 60 * 1000
    const start = Date.now()
    let consecutiveErrors = 0

    if (status === "processing" && authToken) {
      interval = setInterval(async () => {
        if (Date.now() - start > MAX_POLL) {
          setStatus("error")
          setProcessingError("Processing is taking longer than expected — check the file in Data Catalog.")
          if (interval) clearInterval(interval)
          return
        }
        try {
          const resp = await fileManagementAPI.getFileStatus(uploadId, authToken)
          consecutiveErrors = 0
          const fileStatus = resp.status
          if (fileStatus === "DQ_FIXED" || fileStatus === "COMPLETED") {
            setStatus("success")
            setProgress(100)
            setStatusMessage("Processing complete!")
            if (interval) clearInterval(interval)
          } else if (fileStatus === "DQ_FAILED" || fileStatus === "FAILED") {
            setStatus("error")
            const detail = (resp as any).aug_error
              || (resp as any).aug_fail_reason
              || (resp as any).error_message
              || (resp as any).failure_reason
              || (resp as any).last_error
              || ""
            setProcessingError(detail ? `Processing failed: ${detail}` : "Processing failed")
            if (interval) clearInterval(interval)
          } else if (fileStatus === "REJECTED") {
            // BE rejected the file (empty / malformed / encoding) — surface the
            // specific reason from the validator instead of "Processing failed".
            const reason = (resp as { failure_reason?: string }).failure_reason || ""
            setStatus("error")
            setProcessingError(reason ? `File rejected: ${reason}` : "File was rejected by validation.")
            if (interval) clearInterval(interval)
          } else if (["QUEUED", "DQ_DISPATCHED", "UPLOADING", "NORMALIZING"].includes(fileStatus)) {
            setProgress((prev) => Math.max(prev, 20))
            setStatusMessage("Queued for processing...")
          } else if (["DQ_RUNNING", "VALIDATED"].includes(fileStatus)) {
            setProgress((prev) => Math.min(prev + 5, 92))
            setStatusMessage("Running data quality checks...")
          } else if (fileStatus === "AUG_RUNNING") {
            setProgress((prev) => Math.min(prev + 3, 88))
            setStatusMessage("Running augmentations...")
          } else if (fileStatus === "AUG_FAILED") {
            setStatus("error")
            const detail = (resp as any).aug_error
              || (resp as any).aug_fail_reason
              || (resp as any).error_message
              || (resp as any).failure_reason
              || ""
            setProcessingError(detail ? `Augmentation failed: ${detail}` : "Augmentation step failed")
            if (interval) clearInterval(interval)
          }
        } catch (err) {
          // 401/403 are terminal — stop polling so we don't spin forever on
          // an expired session. Otherwise, allow up to 3 consecutive transient
          // errors before failing the UI.
          if (isApiError(err) && (err.status === 401 || err.status === 403)) {
            setStatus("error")
            setProcessingError(formatProcessError(err))
            if (interval) clearInterval(interval)
            return
          }
          consecutiveErrors += 1
          if (consecutiveErrors >= 3) {
            setStatus("error")
            setProcessingError("Lost contact with server while polling status. Check Data Catalog.")
            if (interval) clearInterval(interval)
            return
          }
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
        const override: Record<string, any> = {
          core_type: columnCoreTypes[col] || "string",
          type_alias: columnTypeAliases[col] || null,
          key_type: columnKeyTypes[col] || "none",
          nullable: columnNullable[col] !== undefined ? columnNullable[col] : true,
        }
        // Only include currency_code when set — backend defaults R11 to
        // global decimal_max_places when the field is absent.
        const ccy = columnCurrencyCodes?.[col]
        if (ccy) override.currency_code = ccy
        columnTypeOverrides[col] = override
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

      // Extract reference_data from preset overrides to pass as top-level field
      const referenceData = presetOverrides?.reference_data || (selectedPreset as any)?.config?.reference_data || undefined

      // Only include augmentations that have a non-empty prompt and at least one source column
      // B2 (2026-05-16): count and toast on filtered-out rows so the user doesn't
      // silently lose work.  We do NOT block submit — the rest of the pipeline
      // still proceeds; the toast just makes the drop visible.
      const augmentationsWithPrompt = (augmentations ?? []).filter(
        (a) => a.prompt_text.trim().length > 0,
      )
      const augmentationsPayload = augmentationsWithPrompt
        .filter((a) => a.source_columns.length > 0)
        .map((a) => ({
          mode: a.mode,
          prompt_text: a.prompt_text,
          preset_id: a.preset_id,
          source_columns: a.source_columns,
          destination_columns: a.destination_columns,
        }))
      const droppedAugCount =
        augmentationsWithPrompt.length - augmentationsPayload.length
      if (droppedAugCount > 0) {
        toast.error(
          droppedAugCount === 1
            ? "1 augmentation skipped because no source columns were selected. Aug rows must have at least one source column to run."
            : `${droppedAugCount} augmentations skipped because no source columns were selected. Aug rows must have at least one source column to run.`,
          { duration: 6000 },
        )
      }

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
        reference_data: referenceData,
        ...(augmentationsPayload.length > 0 ? { augmentations: augmentationsPayload } : {}),
      })
      setStatusMessage("Processing started, monitoring progress...")
      // Notify parent so it refreshes the file list — without this the
      // catalog row remains stuck on UPLOADED until the next manual refresh.
      if (onStarted) onStarted()
      // Do NOT close here — let the polling loop decide when to close based
      // on terminal status (DQ_FIXED → auto-close after 3s; DQ_FAILED/FAILED
      // → show error block and wait for explicit user Close).
    } catch (err: unknown) {
      // Backend rejects a second start while the prior run is still pending —
      // that's not a failure, the pipeline is already working. Notify parent
      // to refresh and close after a brief "already running" message.
      const msg = (err as { message?: string })?.message?.toLowerCase() || ""
      if (msg.includes("already being processed")) {
        setStatusMessage("Processing is already running in the background.")
        if (onStarted) onStarted()
        setTimeout(() => { if (onComplete) onComplete() }, 2500)
        return
      }
      setStatus("error")
      setProcessingError(formatProcessError(err))
    }
  }

  const handleRetry = () => {
    setStatus("idle")
    setProgress(0)
    setProcessingError(null)
  }

  const handleComplete = useCallback(async () => {
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
  }, [authToken, uploadId, onComplete])

  // Auto-close after 3 seconds on success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        handleComplete()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status, handleComplete])

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
                <span>Business rules:</span>
                <span className="font-medium">{crossFieldRules.filter(r => r.enabled).length}</span>
                <span>Augmentations:</span>
                <span className="font-medium">{augmentations.filter(a => a.prompt_text.trim().length > 0).length}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="lg" onClick={prevStep}>
                Back
              </Button>
              <Button variant="default" size="lg" onClick={handleStart} className="font-semibold gap-2" disabled={!authToken}>
                <Play className="w-5 h-5" />
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
              <p className="text-sm text-muted-foreground mt-1">This dialog will close automatically. Processing continues in the background.</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-1000/10 flex items-center justify-center mx-auto">
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
            <div className="w-20 h-20 rounded-full bg-red-1000/10 flex items-center justify-center mx-auto">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-red-500">Processing Failed</h2>
              <p className="text-muted-foreground mt-2 max-w-md">
                {processingError || "Processing failed or timed out. Please retry."}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button size="lg" variant="outline" onClick={handleRetry}>
                <RotateCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button size="lg" variant="ghost" onClick={() => { if (onComplete) onComplete() }}>
                Close
              </Button>
            </div>
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
