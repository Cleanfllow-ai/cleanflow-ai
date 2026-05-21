"use client"

/**
 * UnstructuredImportWizard — top-level container for the four-step form.
 *
 * Owns the entire JobSpec draft and dispatches POST /unstructured/jobs on
 * submit. On success, navigates to the job-detail page so the live SSE log
 * mounts immediately.
 *
 * Presets (Wave-2 power-user):
 *   - "Save as preset" — capture the current Source+Filter+Schema+Augmentation
 *     into localStorage so the same daily run is one click next time.
 *   - "Load preset" dropdown above Step 1 — pick to repopulate every field;
 *     trash icon per row to remove.
 *   - Storage is purely FE (`cleanflowai.unstructured.presets`, capped at 20).
 *     A future PR will move this to DDB; out of scope here.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bookmark, BookmarkPlus, History, Loader2, PlayCircle, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { unstructuredApi } from "../api/unstructured-api"
import {
  deletePreset,
  listPresets,
  savePreset,
  type UnstructuredImportPreset,
} from "../lib/import-presets"
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

  // ── Preset state ────────────────────────────────────────────────────
  const [presets, setPresets] = useState<UnstructuredImportPreset[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [presetNameDraft, setPresetNameDraft] = useState("")
  const [saveToast, setSaveToast] = useState<string | null>(null)

  // Hydrate the dropdown once on mount + after every save/delete.
  const refreshPresets = useCallback(() => {
    setPresets(listPresets())
  }, [])

  useEffect(() => {
    refreshPresets()
  }, [refreshPresets])

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

  const handleLoadPreset = useCallback((preset: UnstructuredImportPreset) => {
    setSource(preset.source)
    setFilter(preset.filter)
    setSchemaId(preset.schemaId)
    setAugRule(preset.augmentationRule)
    setSaveToast(`Loaded preset "${preset.name}"`)
    // Brief flash — the dropdown is the visual confirmation.
    window.setTimeout(() => setSaveToast(null), 2500)
  }, [])

  const handleDeletePreset = useCallback(
    (id: string, name: string, event: React.MouseEvent) => {
      // The trash icon lives inside a DropdownMenuItem — stop the parent
      // click from also firing "Load preset".
      event.preventDefault()
      event.stopPropagation()
      deletePreset(id)
      refreshPresets()
      setSaveToast(`Deleted preset "${name}"`)
      window.setTimeout(() => setSaveToast(null), 2500)
    },
    [refreshPresets],
  )

  const handleOpenSaveDialog = useCallback(() => {
    // Suggest a sensible default name — folder id + schema + date.
    const folderHint =
      source.folder_id?.slice(0, 8) ||
      (source.connector === "local_upload" ? "local-upload" : source.connector)
    const today = new Date().toISOString().slice(0, 10)
    setPresetNameDraft(`${folderHint} · ${schemaId} · ${today}`)
    setSaveDialogOpen(true)
  }, [source, schemaId])

  const handleConfirmSave = useCallback(() => {
    const trimmed = presetNameDraft.trim()
    if (!trimmed) return
    const saved = savePreset({
      name: trimmed,
      source,
      filter,
      schemaId,
      augmentationRule: augRule,
    })
    refreshPresets()
    setSaveDialogOpen(false)
    setPresetNameDraft("")
    setSaveToast(`Saved preset "${saved.name}"`)
    window.setTimeout(() => setSaveToast(null), 2500)
  }, [presetNameDraft, source, filter, schemaId, augRule, refreshPresets])

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

      {/* Preset bar — above Step 1 per spec. */}
      <Card className="p-4 flex flex-wrap items-center gap-3 bg-muted/40">
        <div className="flex flex-col">
          <span className="text-xs font-medium">Presets</span>
          <span className="text-[11px] text-muted-foreground">
            Reuse a saved Source + Filter + Schema + Augmentation combo
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="unstructured-load-preset"
                disabled={presets.length === 0}
                title={
                  presets.length === 0
                    ? "No presets saved yet — click 'Save as preset' to create your first one"
                    : "Load a saved preset"
                }
              >
                <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                {presets.length === 0
                  ? "Load preset"
                  : `Load preset (${presets.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[320px]">
              <DropdownMenuLabel className="text-xs">
                Saved presets
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presets.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No presets yet.
                </div>
              ) : (
                presets.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onSelect={() => handleLoadPreset(p)}
                    data-testid={`unstructured-preset-row-${p.id}`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.schemaId} · {new Date(p.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete preset ${p.name}`}
                      onClick={(e) => handleDeletePreset(p.id, p.name, e)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                      data-testid={`unstructured-preset-delete-${p.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenSaveDialog}
            data-testid="unstructured-save-preset"
          >
            <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
            Save as preset
          </Button>
        </div>
        {saveToast && (
          <div
            className="w-full text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
            role="status"
            data-testid="unstructured-preset-toast"
          >
            {saveToast}
          </div>
        )}
      </Card>

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
          {/* Secondary "Save as preset" — adjacent to the primary action,
              per spec. The top-of-page button is for power-users; this one
              is for the user who's just finished the wizard. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleOpenSaveDialog}
            data-testid="unstructured-save-preset-review"
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save as preset
          </Button>
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

      {/* Save dialog — name + Save. */}
      <Dialog
        open={saveDialogOpen}
        onOpenChange={(open) => {
          setSaveDialogOpen(open)
          if (!open) setPresetNameDraft("")
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Save current setup as preset</DialogTitle>
            <DialogDescription>
              Captures the current Source, Filter, Schema, and Augmentation
              rule. Stored in your browser only — clear-history clears
              presets too.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <Label htmlFor="unstructured-preset-name" className="text-xs">
              Preset name
            </Label>
            <Input
              id="unstructured-preset-name"
              value={presetNameDraft}
              onChange={(e) => setPresetNameDraft(e.target.value)}
              placeholder="e.g. Daily AP invoices"
              data-testid="unstructured-preset-name-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && presetNameDraft.trim()) {
                  e.preventDefault()
                  handleConfirmSave()
                }
              }}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSaveDialogOpen(false)
                setPresetNameDraft("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={!presetNameDraft.trim()}
              data-testid="unstructured-preset-save-confirm"
            >
              <BookmarkPlus className="h-4 w-4 mr-1.5" />
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UnstructuredImportWizard
