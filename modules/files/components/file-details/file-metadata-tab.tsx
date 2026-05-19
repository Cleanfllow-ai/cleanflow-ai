"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  Check,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  GitBranch,
  Search,
  Server,
  Shield,
  Tag,
  Wrench,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/shared/hooks/use-toast"
import { formatBytes, formatToIST } from "@/shared/lib/utils"
import { cn } from "@/shared/lib/utils"
import type { FileStatusResponse, FileVersionSummary } from "@/modules/files"
import { triggerBlobDownload } from "@/modules/files/utils/trigger-download"

type CategoryId =
  | "technical"
  | "business"
  | "data_quality"
  | "lineage"
  | "governance"
  | "operational"

interface MetadataItem {
  key: string
  label: string
  value: unknown
  category: CategoryId
  hint?: string
}

interface CategoryDef {
  id: CategoryId
  label: string
  Icon: typeof Server
  accent: string
}

const CATEGORIES: CategoryDef[] = [
  { id: "technical", label: "Technical", Icon: Server, accent: "text-sky-600 dark:text-sky-400" },
  { id: "business", label: "Business", Icon: Tag, accent: "text-violet-600 dark:text-violet-400" },
  { id: "data_quality", label: "Data Quality", Icon: Activity, accent: "text-emerald-600 dark:text-emerald-400" },
  { id: "lineage", label: "Lineage", Icon: GitBranch, accent: "text-indigo-600 dark:text-indigo-400" },
  { id: "governance", label: "Governance", Icon: Shield, accent: "text-amber-600 dark:text-amber-400" },
  { id: "operational", label: "Operational", Icon: Wrench, accent: "text-rose-600 dark:text-rose-400" },
]

const PII_TYPE_KEYWORDS = [
  "email",
  "phone",
  "address",
  "ssn",
  "tax",
  "pan",
  "aadhaar",
  "passport",
  "credit",
  "iban",
  "name",
]

function formatProcessingTime(file: FileStatusResponse): string | null {
  const seconds =
    file.processing_time_seconds ??
    (typeof file.processing_time === "string" ? parseFloat(file.processing_time) : null)
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    if (typeof file.processing_time === "string" && file.processing_time.trim()) {
      return file.processing_time
    }
    return null
  }
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`
  if (seconds < 60) return `${seconds.toFixed(2)} s`
  const minutes = Math.floor(seconds / 60)
  const remSec = Math.floor(seconds % 60)
  if (minutes < 60) return `${minutes}m ${remSec}s`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return `${hours}h ${remMin}m`
}

function piiColumnsFromTypeMap(file: FileStatusResponse): string[] {
  const raw = (file as any)?.dq_config_snapshot?._detected_type_map
    ?? (file as any)?.dq_rules_config?._detected_type_map
    ?? (file as any)?._detected_type_map
  if (!raw || typeof raw !== "object") return []
  const out: string[] = []
  for (const [col, type] of Object.entries(raw)) {
    const t = String(type || "").toLowerCase()
    if (PII_TYPE_KEYWORDS.some((kw) => t.includes(kw))) out.push(col)
  }
  return out
}

const NUMERIC_KEYS_NO_FORMAT = new Set([
  "version_number",
  "reprocess_count",
  "shard_count",
  "failed_shards_count",
  "version_total",
])

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return ""
  return n.toLocaleString("en-US")
}

function presentPrimitive(value: unknown, keyHint?: string): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return ""
    if (keyHint && NUMERIC_KEYS_NO_FORMAT.has(keyHint)) return String(value)
    return formatNumber(value)
  }
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    if (value.length === 0) return ""
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return value.map((v) => String(v)).join(", ")
    }
    return JSON.stringify(value)
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (Object.keys(obj).length === 0) return ""
    return JSON.stringify(obj)
  }
  return String(value)
}

function emptyOrEmDash(str: string): string {
  return str.trim().length === 0 ? "—" : str
}

function buildMetadata(
  file: FileStatusResponse,
  versions: FileVersionSummary[],
): MetadataItem[] {
  const items: MetadataItem[] = []

  // ── Technical ─────────────────────────────────────────────────
  items.push({ key: "upload_id", label: "Upload ID", value: file.upload_id, category: "technical" })
  items.push({ key: "filename", label: "Filename", value: file.original_filename || file.filename, category: "technical" })
  items.push({ key: "content_type", label: "Content Type", value: file.content_type, category: "technical" })
  items.push({
    key: "file_size",
    label: "File Size",
    value: file.input_size_bytes != null || file.file_size != null
      ? formatBytes(file.input_size_bytes || file.file_size || 0)
      : null,
    category: "technical",
  })
  items.push({ key: "row_count", label: "Row Count", value: file.rows_in, category: "technical" })
  items.push({ key: "shard_count", label: "Shard Count", value: (file as any).shard_count, category: "technical" })
  items.push({ key: "engine", label: "Engine", value: file.engine || "CleanAI 1.0", category: "technical" })
  items.push({ key: "s3_raw_key", label: "S3 Raw Key", value: file.s3_raw_key, category: "technical" })
  items.push({ key: "s3_result_key", label: "S3 Result Key", value: file.s3_result_key, category: "technical" })
  items.push({ key: "dq_report_s3", label: "DQ Report Key", value: file.dq_report_s3, category: "technical" })
  items.push({ key: "dispatch_id", label: "Dispatch ID", value: file.dispatch_id, category: "technical" })
  items.push({
    key: "file_columns",
    label: "Columns",
    value: (file as any).file_columns,
    category: "technical",
    hint: "All columns detected in the source file",
  })
  items.push({
    key: "selected_columns",
    label: "Selected Columns",
    value: (file as any).selected_columns,
    category: "technical",
  })
  const detectedTypes =
    (file as any)?.dq_config_snapshot?._detected_type_map
    ?? (file as any)?.dq_rules_config?._detected_type_map
    ?? null
  items.push({
    key: "detected_type_map",
    label: "Detected Column Types",
    value: detectedTypes,
    category: "technical",
    hint: "Type inferred per column by the DQ engine",
  })

  // ── Business ──────────────────────────────────────────────────
  items.push({ key: "original_filename", label: "Original Filename", value: file.original_filename, category: "business" })
  items.push({ key: "source_type", label: "Source Type", value: file.source_type, category: "business" })
  items.push({ key: "detected_erp", label: "Detected ERP", value: file.detected_erp, category: "business" })
  items.push({ key: "detected_entity", label: "Detected Entity", value: file.detected_entity, category: "business" })
  items.push({ key: "erp_metadata", label: "ERP Metadata", value: (file as any).erp_metadata, category: "business" })
  items.push({ key: "export_provider", label: "Export Provider", value: (file as any).export_provider, category: "business" })
  items.push({ key: "export_entity", label: "Export Entity", value: (file as any).export_entity, category: "business" })
  items.push({ key: "export_status", label: "Export Status", value: (file as any).export_status, category: "business" })
  items.push({ key: "primary_key_columns", label: "Primary Keys", value: (file as any).primary_key_columns, category: "business" })
  items.push({ key: "required_columns", label: "Required Columns", value: (file as any).required_columns, category: "business" })

  // ── Data Quality ──────────────────────────────────────────────
  items.push({
    key: "dq_score",
    label: "DQ Score",
    value: typeof file.dq_score === "number" ? `${file.dq_score.toFixed(2)}%` : null,
    category: "data_quality",
  })
  items.push({ key: "rows_in", label: "Total Rows", value: file.rows_in, category: "data_quality" })
  items.push({ key: "rows_clean", label: "Clean Rows", value: file.rows_clean, category: "data_quality" })
  items.push({ key: "rows_fixed", label: "Fixed Rows", value: file.rows_fixed, category: "data_quality" })
  items.push({ key: "rows_quarantined", label: "Quarantined Rows", value: file.rows_quarantined, category: "data_quality" })
  items.push({
    key: "partial_completion",
    label: "Partial Completion",
    value: file.partial_completion === true ? "Yes — some shards failed" : (file.partial_completion === false ? "No" : null),
    category: "data_quality",
  })
  items.push({
    key: "failed_shards_count",
    label: "Failed Shards",
    value: Array.isArray(file.failed_shards) ? file.failed_shards.length : null,
    category: "data_quality",
  })
  items.push({ key: "cross_field_rules", label: "Cross-field Rules", value: (file as any).cross_field_rules, category: "data_quality" })
  items.push({ key: "custom_rules", label: "Custom Rules", value: (file as any).custom_rules, category: "data_quality" })
  items.push({ key: "global_disabled_rules", label: "Globally Disabled Rules", value: (file as any).global_disabled_rules, category: "data_quality" })
  items.push({ key: "dq_rules_version", label: "DQ Rules Version", value: file.dq_rules_version, category: "data_quality" })

  // ── Lineage ───────────────────────────────────────────────────
  items.push({ key: "version_number", label: "Version Number", value: file.version_number, category: "lineage" })
  items.push({ key: "is_latest", label: "Is Latest", value: file.is_latest, category: "lineage" })
  items.push({ key: "parent_upload_id", label: "Parent Upload ID", value: file.parent_upload_id, category: "lineage" })
  items.push({ key: "root_upload_id", label: "Root Upload ID", value: file.root_upload_id, category: "lineage" })
  items.push({ key: "source_upload_id", label: "Source Upload ID", value: file.source_upload_id, category: "lineage" })
  items.push({ key: "reprocess_count", label: "Reprocess Count", value: file.reprocess_count, category: "lineage" })
  items.push({
    key: "version_total",
    label: "Total Versions",
    value: versions.length || null,
    category: "lineage",
  })
  items.push({
    key: "remediation_state",
    label: "Remediation State",
    value: file.remediation_state,
    category: "lineage",
  })
  items.push({
    key: "remediation_mode",
    label: "Remediation Mode",
    value: file.remediation_mode,
    category: "lineage",
  })
  items.push({
    key: "reprocess_overlay_manifest",
    label: "Overlay Manifest",
    value: (file as any).reprocess_overlay_manifest_key,
    category: "lineage",
  })

  // ── Governance / Security ─────────────────────────────────────
  items.push({ key: "org_id", label: "Organization ID", value: (file as any).org_id, category: "governance" })
  items.push({ key: "user_id", label: "Owner User ID", value: file.user_id, category: "governance" })
  const piiCols = piiColumnsFromTypeMap(file)
  items.push({
    key: "pii_columns",
    label: "PII-flagged Columns",
    value: piiCols.length ? piiCols : null,
    category: "governance",
    hint: "Columns whose detected type matches a known PII pattern",
  })
  items.push({
    key: "disable_rules",
    label: "Per-column Disabled Rules",
    value: (file as any).disable_rules,
    category: "governance",
  })

  // ── Operational ───────────────────────────────────────────────
  items.push({
    key: "status",
    label: "Status",
    value: file.status,
    category: "operational",
  })
  items.push({
    key: "uploaded_at",
    label: "Uploaded At",
    value: file.uploaded_at ? formatToIST(file.uploaded_at) : null,
    category: "operational",
  })
  items.push({
    key: "updated_at",
    label: "Last Updated",
    value: file.updated_at ? formatToIST(file.updated_at) : null,
    category: "operational",
  })
  items.push({
    key: "processing_started_at",
    label: "Processing Started",
    value: (file as any).processing_started_at ? formatToIST((file as any).processing_started_at) : null,
    category: "operational",
  })
  items.push({
    key: "status_timestamp",
    label: "Status Timestamp",
    value: file.status_timestamp ? formatToIST(file.status_timestamp) : null,
    category: "operational",
  })
  items.push({
    key: "processing_time",
    label: "Processing Time",
    value: formatProcessingTime(file),
    category: "operational",
  })
  items.push({
    key: "bytes_transferred",
    label: "Bytes Transferred",
    value: typeof (file as any).bytes_transferred === "number" ? formatBytes((file as any).bytes_transferred) : null,
    category: "operational",
  })
  items.push({
    key: "last_error",
    label: "Last Error",
    value: (file as any).last_error,
    category: "operational",
  })
  items.push({
    key: "export_timestamp",
    label: "Export Timestamp",
    value: (file as any).export_timestamp ? formatToIST((file as any).export_timestamp) : null,
    category: "operational",
  })

  return items
}

function isEmpty(item: MetadataItem): boolean {
  return presentPrimitive(item.value, item.key).trim().length === 0
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

interface FileMetadataTabProps {
  file: FileStatusResponse
  versions: FileVersionSummary[]
}

export function FileMetadataTab({ file, versions }: FileMetadataTabProps) {
  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(
    new Set(CATEGORIES.map((c) => c.id)),
  )
  const [showEmpty, setShowEmpty] = useState(false)
  const [search, setSearch] = useState("")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { toast } = useToast()

  const allItems = useMemo(() => buildMetadata(file, versions), [file, versions])

  const itemsByCategory = useMemo(() => {
    const lower = search.trim().toLowerCase()
    const map: Record<CategoryId, MetadataItem[]> = {
      technical: [],
      business: [],
      data_quality: [],
      lineage: [],
      governance: [],
      operational: [],
    }
    for (const item of allItems) {
      if (!activeCategories.has(item.category)) continue
      const empty = isEmpty(item)
      if (empty && !showEmpty) continue
      if (lower) {
        const haystack = `${item.label} ${item.key} ${presentPrimitive(item.value, item.key)}`.toLowerCase()
        if (!haystack.includes(lower)) continue
      }
      map[item.category].push(item)
    }
    return map
  }, [allItems, activeCategories, showEmpty, search])

  const allCategoriesActive = activeCategories.size === CATEGORIES.length
  const filtersActive = !allCategoriesActive || showEmpty || search.trim().length > 0

  const resetFilters = () => {
    setActiveCategories(new Set(CATEGORIES.map((c) => c.id)))
    setShowEmpty(false)
    setSearch("")
  }

  const visibleCount = Object.values(itemsByCategory).reduce((sum, arr) => sum + arr.length, 0)

  const filenameBase = (file.original_filename || file.filename || file.upload_id).replace(/\.[^.]+$/, "")

  const downloadJson = () => {
    const grouped: Record<string, Record<string, unknown>> = {}
    for (const cat of CATEGORIES) {
      grouped[cat.id] = {}
      for (const item of allItems.filter((i) => i.category === cat.id)) {
        if (isEmpty(item)) continue
        grouped[cat.id][item.key] = item.value
      }
    }
    const blob = new Blob([JSON.stringify(grouped, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    triggerBlobDownload(url, `metadata_${filenameBase}.json`)
    URL.revokeObjectURL(url)
    toast({ title: "Downloaded", description: "Metadata JSON saved" })
  }

  const downloadCsv = () => {
    const lines: string[] = ["category,key,label,value"]
    for (const item of allItems) {
      if (isEmpty(item)) continue
      const value = presentPrimitive(item.value)
      lines.push(
        [item.category, item.key, item.label, value]
          .map((v) => csvEscape(String(v)))
          .join(","),
      )
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    triggerBlobDownload(url, `metadata_${filenameBase}.csv`)
    URL.revokeObjectURL(url)
    toast({ title: "Downloaded", description: "Metadata CSV saved" })
  }

  const copyValue = async (key: string, value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1200)
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const toggleCategory = (id: CategoryId) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next.size === 0 ? new Set(CATEGORIES.map((c) => c.id)) : next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-6 pt-3 pb-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys, labels, values…"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              {visibleCount} field{visibleCount === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => setShowEmpty((s) => !s)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                showEmpty
                  ? "border-neutral-400 bg-neutral-100 text-neutral-900"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
              )}
            >
              {showEmpty ? "Hiding empty off" : "Show empty"}
            </button>
            {filtersActive ? (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Reset
              </button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadJson}>
                  <FileJson className="mr-2 h-4 w-4" /> JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadCsv}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto px-6 pb-3 pt-1 scrollbar-thin">
          {CATEGORIES.map((cat) => {
            const active = activeCategories.has(cat.id)
            const count = allItems.filter((i) => i.category === cat.id && (showEmpty || !isEmpty(i))).length
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-neutral-400 bg-neutral-100 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
                )}
              >
                <cat.Icon className={cn("h-3.5 w-3.5", active ? cat.accent : "")} />
                {cat.label}
                <span className="ml-0.5 rounded-full bg-background/80 dark:bg-background/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-5 px-6 py-4">
            {visibleCount === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground">
                <p>No metadata matches the current filters.</p>
                <p className="mt-1 text-xs">Try clearing the search or enabling more categories.</p>
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            ) : (
              CATEGORIES.map((cat) => {
                const items = itemsByCategory[cat.id]
                if (items.length === 0) return null
                return (
                  <section key={cat.id} className="space-y-2">
                    <div className="sticky top-0 z-10 -mx-6 flex items-center gap-2 border-b border-border/40 bg-background/95 px-6 py-1.5 backdrop-blur">
                      <cat.Icon className={cn("h-3.5 w-3.5", cat.accent)} />
                      <h4 className="text-xs font-semibold uppercase tracking-wider">{cat.label}</h4>
                      <Badge variant="outline" className="h-4 text-[9px] font-mono">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {items.map((item) => {
                        const presented = presentPrimitive(item.value, item.key)
                        const display = emptyOrEmDash(presented)
                        const isMissing = display === "—"
                        const isLong = !isMissing && display.length > 80
                        const copyable = !isMissing
                        const copyId = `${cat.id}-${item.key}`
                        return (
                          <div
                            key={copyId}
                            className="group relative rounded-md border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {item.label}
                              </div>
                              {copyable ? (
                                <button
                                  type="button"
                                  onClick={() => copyValue(copyId, presented)}
                                  className="text-muted-foreground/40 opacity-100 transition-colors hover:text-foreground"
                                  aria-label={`Copy ${item.label}`}
                                >
                                  {copiedKey === copyId ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                            <div
                              className={cn(
                                "mt-0.5 break-all text-xs leading-snug",
                                isMissing ? "text-muted-foreground/50" : "font-mono",
                                isLong ? "max-h-20 overflow-auto" : "",
                              )}
                              title={isMissing ? "" : presented}
                            >
                              {display}
                            </div>
                            {item.hint ? (
                              <div className="mt-1 text-[10px] italic leading-tight text-muted-foreground/80">
                                {item.hint}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
