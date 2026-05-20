"use client"

/**
 * UnstructuredImportWizard — top-level container for the four-step form.
 *
 * Owns the entire JobSpec draft and dispatches POST /unstructured/jobs on
 * submit. On success, navigates to the job-detail page so the live SSE log
 * mounts immediately.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { History, Loader2, PlayCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { unstructuredApi } from "../api/unstructured-api"
import type {
  UnstructuredJobSource,
  UnstructuredJobFilter,
  UnstructuredJobSpec,
  UnstructuredSchemaId,
} from "../types/unstructured.types"
import AugmentationRuleEditor from "./AugmentationRuleEditor"
import SchemaSelector from "./SchemaSelector"
import ScopeFilter from "./ScopeFilter"
import SourcePicker from "./SourcePicker"

const DEFAULT_SOURCE: UnstructuredJobSource = {
  connector: "google_drive",
  connection_id: "",
  folder_id: null,
}

const DEFAULT_FILTER: UnstructuredJobFilter = {
  mode: "manual",
  glob: "*.pdf,*.docx,*.xlsx",
  modified_after: null,
  modified_before: null,
  agentic_prompt: null,
}

function validateSpec(
  spec: UnstructuredJobSpec,
  localFile: File | null,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!spec.schema_id) reasons.push("Pick a schema (Step 3).")
  if (!spec.source.connector) reasons.push("Pick a source (Step 1).")
  if (spec.source.connector === "google_drive") {
    if (!spec.source.connection_id) {
      reasons.push("Google Drive is not connected. Click Reconnect.")
    }
    if (!spec.source.folder_id) {
      reasons.push("Enter a Google Drive folder ID.")
    }
  }
  if (spec.source.connector === "local_upload" && !localFile) {
    reasons.push("Drop a ZIP file or choose one to upload.")
  }
  if (spec.filter.mode === "manual" && !spec.filter.glob.trim()) {
    reasons.push("Enter a file pattern (e.g. *.pdf,*.docx).")
  }
  if (spec.filter.mode === "agentic" && !spec.filter.agentic_prompt?.trim()) {
    reasons.push("Tell the AI what to find.")
  }
  if (
    spec.filter.modified_after &&
    spec.filter.modified_before &&
    spec.filter.modified_after > spec.filter.modified_before
  ) {
    reasons.push("'Modified after' must be before 'Modified before'.")
  }
  return { valid: reasons.length === 0, reasons }
}

export function UnstructuredImportWizard() {
  const router = useRouter()
  const [source, setSource] = useState<UnstructuredJobSource>(DEFAULT_SOURCE)
  const [filter, setFilter] = useState<UnstructuredJobFilter>(DEFAULT_FILTER)
  const [schemaId, setSchemaId] = useState<UnstructuredSchemaId>("invoice_standard")
  const [augRule, setAugRule] = useState<string | null>(null)
  const [localFile, setLocalFile] = useState<File | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const spec: UnstructuredJobSpec = useMemo(
    () => ({
      source,
      filter,
      schema_id: schemaId,
      augmentation_rule: augRule && augRule.trim().length > 0 ? augRule : null,
    }),
    [source, filter, schemaId, augRule],
  )

  const validation = useMemo(() => validateSpec(spec, localFile), [spec, localFile])

  const handleSubmit = async () => {
    if (!validation.valid || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const resp = await unstructuredApi.createJob(spec)
      router.push(
        `/admin/unified-bridge/unstructured/jobs/${encodeURIComponent(resp.job_id)}`,
      )
    } catch (err) {
      setSubmitError((err as Error)?.message || "Failed to start job")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Unstructured Import</h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Pull PDFs, DOCX, and spreadsheets from Google Drive or a local ZIP,
            run the AI extraction pipeline, and merge into your catalog. Step
            through the four sections and click Run Import.
          </p>
        </div>
        <Link href="/admin/unified-bridge/unstructured/history">
          <Button variant="outline" size="sm">
            <History className="h-3.5 w-3.5 mr-1.5" />
            Job history
          </Button>
        </Link>
      </div>

      <Card className="p-5 space-y-6">
        <SourcePicker
          value={source}
          onChange={setSource}
          localFile={localFile}
          onLocalFileSelected={setLocalFile}
        />
        <Separator />
        <ScopeFilter value={filter} onChange={setFilter} />
        <Separator />
        <SchemaSelector value={schemaId} onChange={setSchemaId} />
        <Separator />
        <AugmentationRuleEditor value={augRule} onChange={setAugRule} />

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {!validation.valid && (
          <div
            data-testid="unstructured-validation-summary"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          >
            <div className="font-medium mb-1">A few things to fix:</div>
            <ul className="list-disc pl-5 space-y-0.5">
              {validation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            size="lg"
            disabled={!validation.valid || submitting}
            onClick={handleSubmit}
            data-testid="unstructured-run-import"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting job…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Run Import
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default UnstructuredImportWizard
