"use client"

import { useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  User,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

// ─── Status / DQ pill helpers (kept consistent with file-details-dialog) ──
function statusPillClass(status: string | undefined | null): string {
  const s = String(status || "").toUpperCase()
  if (s.includes("FIXED") || s.includes("COMPLETED") || s.includes("PROCESSED") || s.includes("UPLOADED") || s.includes("VALIDATED")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
  }
  if (s.includes("FAIL") || s.includes("REJECT")) {
    return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30"
  }
  if (s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED") || s.includes("DISPATCH") || s.includes("UPLOADING") || s.includes("SHARDING")) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
  }
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30"
}

function dqScorePillClass(score: number | null | undefined): string {
  if (typeof score !== "number") return "bg-muted text-muted-foreground border-border"
  if (score >= 95) return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
  if (score >= 80) return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30"
  if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
  return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30"
}

const PII_TYPE_KEYWORDS = [
  "email", "phone", "address", "ssn", "tax", "pan",
  "aadhaar", "passport", "credit", "iban", "name",
]

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

function formatNumber(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—"
  return n.toLocaleString("en-US")
}

function formatPossibleDate(value: unknown): string {
  if (value == null || value === "") return "—"
  if (typeof value !== "string") return String(value)
  return formatToIST(value)
}

function emDashIfEmpty(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "string") return value.trim().length === 0 ? "—" : value
  if (typeof value === "number") return Number.isFinite(value) ? formatNumber(value) : "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) {
    if (value.length === 0) return "—"
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return value.map((v) => String(v)).join(", ")
    }
    return JSON.stringify(value)
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (Object.keys(obj).length === 0) return "—"
    return JSON.stringify(obj)
  }
  return String(value)
}

// ─── Field model ──────────────────────────────────────────────────────────
type GroupId = "identity" | "quality" | "processing" | "technical"

interface MetaField {
  key: string
  label: string
  /** displayValue is what we render. */
  displayValue: string
  /** copyValue is what we copy. Defaults to displayValue. */
  copyValue?: string
  /** mono renders the value in monospace. */
  mono?: boolean
  /** node, when present, renders instead of displayValue. */
  node?: React.ReactNode
  /** highlight rows with semantic value (errors, warnings, etc) */
  tone?: "default" | "warning" | "danger"
  hint?: string
}

interface MetaGroup {
  id: GroupId
  label: string
  description: string
  Icon: typeof Server
  accent: string
  fields: MetaField[]
}

function buildGroups(
  file: FileStatusResponse,
  versions: FileVersionSummary[],
): MetaGroup[] {
  // ── Identity ─────────────────────────────────────────────────
  const identity: MetaField[] = []
  identity.push({
    key: "filename",
    label: "Filename",
    displayValue: file.original_filename || file.filename || "—",
    copyValue: file.original_filename || file.filename,
  })
  identity.push({
    key: "status",
    label: "Status",
    displayValue: file.status || "—",
    node: (
      <Badge
        variant="outline"
        className={cn("font-medium text-[10px]", statusPillClass(file.status))}
      >
        {file.status || "Unknown"}
      </Badge>
    ),
  })
  identity.push({
    key: "dq_score",
    label: "DQ Score",
    displayValue: typeof file.dq_score === "number" ? `${file.dq_score.toFixed(2)}%` : "—",
    node: typeof file.dq_score === "number" ? (
      <Badge
        variant="outline"
        className={cn("font-mono text-[11px] font-semibold", dqScorePillClass(file.dq_score))}
      >
        {file.dq_score.toFixed(1)}%
      </Badge>
    ) : undefined,
  })
  identity.push({
    key: "file_size",
    label: "Size",
    displayValue: file.input_size_bytes != null || file.file_size != null
      ? formatBytes(file.input_size_bytes || file.file_size || 0)
      : "—",
    mono: true,
  })
  identity.push({
    key: "uploaded_at",
    label: "Uploaded",
    displayValue: formatPossibleDate(file.uploaded_at || file.created_at),
    mono: true,
  })
  identity.push({
    key: "owner",
    label: "Owner",
    displayValue: file.user_id || "—",
    copyValue: file.user_id,
    mono: true,
    hint: "Cognito user ID of the uploader",
  })
  if (file.version_number != null) {
    const total = versions.length || 1
    identity.push({
      key: "version",
      label: "Version",
      displayValue: `v${file.version_number}${total > 1 ? ` of ${total}` : ""}${file.is_latest ? " · latest" : ""}`,
    })
  }
  if (file.source_type && file.source_type !== "user_upload") {
    identity.push({
      key: "source",
      label: "Source",
      displayValue: String(file.source_type),
    })
  } else {
    identity.push({
      key: "source",
      label: "Source",
      displayValue: "User upload",
    })
  }
  if (file.detected_erp) {
    identity.push({
      key: "detected_erp",
      label: "Detected ERP",
      displayValue: String(file.detected_erp),
    })
  }
  if (file.detected_entity) {
    identity.push({
      key: "detected_entity",
      label: "Detected Entity",
      displayValue: String(file.detected_entity),
    })
  }

  // ── Quality ─────────────────────────────────────────────────
  const quality: MetaField[] = []
  quality.push({
    key: "rows_in",
    label: "Total rows",
    displayValue: formatNumber(file.rows_in),
    mono: true,
  })
  quality.push({
    key: "rows_clean",
    label: "Clean rows",
    displayValue: formatNumber(file.rows_clean),
    mono: true,
  })
  quality.push({
    key: "rows_fixed",
    label: "Fixed rows",
    displayValue: formatNumber(file.rows_fixed),
    mono: true,
  })
  quality.push({
    key: "rows_quarantined",
    label: "Quarantined",
    displayValue: formatNumber(file.rows_quarantined),
    mono: true,
    tone: (file.rows_quarantined || 0) > 0 ? "warning" : "default",
  })
  if (file.partial_completion === true) {
    const failed = Array.isArray(file.failed_shards) ? file.failed_shards.length : 0
    quality.push({
      key: "partial_completion",
      label: "Partial completion",
      displayValue: failed > 0
        ? `Yes — ${failed} shard${failed === 1 ? "" : "s"} failed`
        : "Yes — some shards failed",
      tone: "warning",
    })
  }
  const piiCols = piiColumnsFromTypeMap(file)
  if (piiCols.length) {
    quality.push({
      key: "pii_columns",
      label: "PII-flagged columns",
      displayValue: piiCols.join(", "),
      hint: "Columns whose detected type matches a known PII pattern",
      tone: "warning",
    })
  }

  // ── Processing ──────────────────────────────────────────────
  const processing: MetaField[] = []
  processing.push({
    key: "updated_at",
    label: "Last updated",
    displayValue: formatPossibleDate(file.updated_at),
    mono: true,
  })
  const procTime = formatProcessingTime(file)
  if (procTime) {
    processing.push({
      key: "processing_time",
      label: "Processing time",
      displayValue: procTime,
      mono: true,
    })
  }
  const exportProvider = (file as any).export_provider
  const exportStatus = (file as any).export_status
  const exportEntity = (file as any).export_entity
  const exportTs = (file as any).export_timestamp
  if (exportProvider) {
    processing.push({
      key: "export",
      label: "Export",
      displayValue: `${exportProvider}${exportEntity ? ` · ${exportEntity}` : ""}`,
      node: (
        <div className="flex items-center gap-2">
          <span className="text-xs">{exportProvider}{exportEntity ? ` · ${exportEntity}` : ""}</span>
          {exportStatus ? (
            <Badge
              variant="outline"
              className={cn("text-[10px]", statusPillClass(exportStatus))}
            >
              {exportStatus}
            </Badge>
          ) : null}
        </div>
      ),
    })
    if (exportTs) {
      processing.push({
        key: "export_timestamp",
        label: "Exported",
        displayValue: formatPossibleDate(exportTs),
        mono: true,
      })
    }
  }
  if (file.remediation_state || file.remediation_mode) {
    processing.push({
      key: "remediation",
      label: "Remediation",
      displayValue: [file.remediation_state, file.remediation_mode].filter(Boolean).join(" · "),
    })
  }
  const lastError = (file as any).last_error
  if (lastError) {
    processing.push({
      key: "last_error",
      label: "Last error",
      displayValue: String(lastError),
      tone: "danger",
    })
  }

  // ── Technical (collapsed by default) ────────────────────────
  const technical: MetaField[] = []
  technical.push({
    key: "upload_id",
    label: "Upload ID",
    displayValue: file.upload_id,
    copyValue: file.upload_id,
    mono: true,
  })
  if (file.root_upload_id) {
    technical.push({
      key: "root_upload_id",
      label: "Root upload ID",
      displayValue: String(file.root_upload_id),
      copyValue: String(file.root_upload_id),
      mono: true,
    })
  }
  if (file.parent_upload_id) {
    technical.push({
      key: "parent_upload_id",
      label: "Parent upload ID",
      displayValue: String(file.parent_upload_id),
      copyValue: String(file.parent_upload_id),
      mono: true,
    })
  }
  if (file.source_upload_id) {
    technical.push({
      key: "source_upload_id",
      label: "Source upload ID",
      displayValue: String(file.source_upload_id),
      copyValue: String(file.source_upload_id),
      mono: true,
    })
  }
  if ((file as any).org_id) {
    technical.push({
      key: "org_id",
      label: "Organization ID",
      displayValue: String((file as any).org_id),
      copyValue: String((file as any).org_id),
      mono: true,
    })
  }
  if (file.dispatch_id) {
    technical.push({
      key: "dispatch_id",
      label: "Dispatch ID",
      displayValue: String(file.dispatch_id),
      copyValue: String(file.dispatch_id),
      mono: true,
    })
  }
  technical.push({
    key: "engine",
    label: "Engine",
    displayValue: file.engine || "CleanAI 1.0",
  })
  if (file.dq_rules_version) {
    technical.push({
      key: "dq_rules_version",
      label: "DQ rules version",
      displayValue: String(file.dq_rules_version),
      mono: true,
    })
  }
  if (file.content_type) {
    technical.push({
      key: "content_type",
      label: "Content type",
      displayValue: String(file.content_type),
      mono: true,
    })
  }
  if (typeof (file as any).shard_count === "number") {
    technical.push({
      key: "shard_count",
      label: "Shard count",
      displayValue: formatNumber((file as any).shard_count),
      mono: true,
    })
  }
  if (typeof (file as any).reprocess_count === "number" && (file as any).reprocess_count > 0) {
    technical.push({
      key: "reprocess_count",
      label: "Reprocess count",
      displayValue: String((file as any).reprocess_count),
      mono: true,
    })
  }
  if (file.s3_raw_key) {
    technical.push({
      key: "s3_raw_key",
      label: "S3 raw key",
      displayValue: String(file.s3_raw_key),
      copyValue: String(file.s3_raw_key),
      mono: true,
    })
  }
  if (file.s3_result_key) {
    technical.push({
      key: "s3_result_key",
      label: "S3 result key",
      displayValue: String(file.s3_result_key),
      copyValue: String(file.s3_result_key),
      mono: true,
    })
  }
  if (file.dq_report_s3) {
    technical.push({
      key: "dq_report_s3",
      label: "DQ report key",
      displayValue: String(file.dq_report_s3),
      copyValue: String(file.dq_report_s3),
      mono: true,
    })
  }
  if (Array.isArray((file as any).file_columns) && (file as any).file_columns.length > 0) {
    technical.push({
      key: "file_columns",
      label: "Columns",
      displayValue: (file as any).file_columns.join(", "),
      hint: `${(file as any).file_columns.length} column${(file as any).file_columns.length === 1 ? "" : "s"} detected`,
    })
  }
  if (Array.isArray((file as any).primary_key_columns) && (file as any).primary_key_columns.length > 0) {
    technical.push({
      key: "primary_key_columns",
      label: "Primary keys",
      displayValue: (file as any).primary_key_columns.join(", "),
    })
  }
  const detectedTypes =
    (file as any)?.dq_config_snapshot?._detected_type_map
    ?? (file as any)?.dq_rules_config?._detected_type_map
    ?? null
  if (detectedTypes && typeof detectedTypes === "object" && Object.keys(detectedTypes).length > 0) {
    technical.push({
      key: "detected_type_map",
      label: "Detected column types",
      displayValue: emDashIfEmpty(detectedTypes),
      hint: "Type inferred per column by the DQ engine",
    })
  }
  if ((file as any).reprocess_overlay_manifest_key) {
    technical.push({
      key: "overlay_manifest",
      label: "Overlay manifest",
      displayValue: String((file as any).reprocess_overlay_manifest_key),
      copyValue: String((file as any).reprocess_overlay_manifest_key),
      mono: true,
    })
  }
  if ((file as any).processing_started_at) {
    technical.push({
      key: "processing_started_at",
      label: "Processing started",
      displayValue: formatPossibleDate((file as any).processing_started_at),
      mono: true,
    })
  }
  if (typeof (file as any).bytes_transferred === "number") {
    technical.push({
      key: "bytes_transferred",
      label: "Bytes transferred",
      displayValue: formatBytes((file as any).bytes_transferred),
      mono: true,
    })
  }

  return [
    {
      id: "identity",
      label: "Identity",
      description: "What this file is, who owns it, and what state it's in.",
      Icon: User,
      accent: "text-sky-600 dark:text-sky-400",
      fields: identity,
    },
    {
      id: "quality",
      label: "Data Quality",
      description: "Row-level health, partial-completion signals, sensitive data.",
      Icon: Activity,
      accent: "text-emerald-600 dark:text-emerald-400",
      fields: quality,
    },
    {
      id: "processing",
      label: "Processing",
      description: "Recent activity, exports and operational signals.",
      Icon: Sparkles,
      accent: "text-violet-600 dark:text-violet-400",
      fields: processing,
    },
    {
      id: "technical",
      label: "Technical details",
      description: "Identifiers, S3 keys, schemas — for engineering review.",
      Icon: Server,
      accent: "text-muted-foreground",
      fields: technical,
    },
  ]
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
  const groups = useMemo(() => buildGroups(file, versions), [file, versions])
  const [search, setSearch] = useState("")
  const [techOpen, setTechOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { toast } = useToast()

  const lower = search.trim().toLowerCase()
  const visibleGroups = useMemo(() => {
    if (!lower) return groups
    return groups
      .map((g) => ({
        ...g,
        fields: g.fields.filter((f) =>
          `${f.label} ${f.key} ${f.displayValue}`.toLowerCase().includes(lower),
        ),
      }))
      .filter((g) => g.fields.length > 0)
  }, [groups, lower])

  const totalVisible = visibleGroups.reduce((sum, g) => sum + g.fields.length, 0)

  const filenameBase = (file.original_filename || file.filename || file.upload_id).replace(/\.[^.]+$/, "")

  const downloadJson = () => {
    const payload: Record<string, Record<string, unknown>> = {}
    for (const g of groups) {
      payload[g.id] = {}
      for (const f of g.fields) {
        payload[g.id][f.key] = f.copyValue ?? f.displayValue
      }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    triggerBlobDownload(url, `metadata_${filenameBase}.json`)
    URL.revokeObjectURL(url)
    toast({ title: "Downloaded", description: "Metadata JSON saved" })
  }

  const downloadCsv = () => {
    const lines: string[] = ["group,key,label,value"]
    for (const g of groups) {
      for (const f of g.fields) {
        const value = f.copyValue ?? f.displayValue
        lines.push([g.id, f.key, f.label, value].map((v) => csvEscape(String(v))).join(","))
      }
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    triggerBlobDownload(url, `metadata_${filenameBase}.csv`)
    URL.revokeObjectURL(url)
    toast({ title: "Downloaded", description: "Metadata CSV saved" })
  }

  const copyValue = async (key: string, value: string | undefined) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1200)
      toast({ title: "Copied", description: value.length > 60 ? `${value.slice(0, 60)}…` : value })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Toolbar */}
        <div className="shrink-0 border-b bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-6 py-2.5">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fields…"
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
                {totalVisible} field{totalVisible === 1 ? "" : "s"}
              </span>
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
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-6 px-6 py-5">
              {totalVisible === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground">
                  <Database className="mb-2 h-6 w-6 opacity-50" />
                  <p>No fields match "{search}".</p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                visibleGroups.map((group) => {
                  const isTech = group.id === "technical"
                  // When searching, force-open technical so matches are visible
                  const open = isTech ? (lower ? true : techOpen) : true
                  return (
                    <section key={group.id} className="space-y-3">
                      {isTech ? (
                        <button
                          type="button"
                          onClick={() => setTechOpen((v) => !v)}
                          className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                        >
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <group.Icon className={cn("h-3.5 w-3.5", group.accent)} />
                          <span className="text-sm font-semibold">{group.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {group.fields.length} field{group.fields.length === 1 ? "" : "s"}
                          </span>
                          <span className="ml-auto text-[11px] text-muted-foreground/70">
                            {open ? "Hide" : "Show"}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 border-b border-border/40 pb-1.5">
                          <group.Icon className={cn("h-4 w-4", group.accent)} />
                          <h4 className="text-sm font-semibold">{group.label}</h4>
                          <span className="ml-2 text-xs text-muted-foreground">{group.description}</span>
                        </div>
                      )}

                      {open ? (
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
                          {group.fields.map((f) => {
                            const isCopyable = Boolean(f.copyValue && f.copyValue !== "—")
                            const copyId = `${group.id}-${f.key}`
                            const toneCls =
                              f.tone === "danger"
                                ? "text-red-700 dark:text-red-400"
                                : f.tone === "warning"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : ""
                            return (
                              <div
                                key={copyId}
                                className="group flex items-baseline justify-between gap-3 border-b border-border/30 py-1.5 last:border-b-0"
                              >
                                <dt className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                                  {f.label}
                                  {f.hint ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertCircle className="h-3 w-3 cursor-help text-muted-foreground/60" />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs text-xs">
                                        {f.hint}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                </dt>
                                <dd className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                  {f.node ? (
                                    f.node
                                  ) : (
                                    <span
                                      className={cn(
                                        "min-w-0 truncate text-right text-xs",
                                        f.mono ? "font-mono" : "",
                                        toneCls,
                                        f.displayValue === "—" ? "text-muted-foreground/50" : "",
                                      )}
                                      title={f.displayValue}
                                    >
                                      {f.displayValue}
                                    </span>
                                  )}
                                  {isCopyable ? (
                                    <button
                                      type="button"
                                      onClick={() => copyValue(copyId, f.copyValue)}
                                      className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                                      aria-label={`Copy ${f.label}`}
                                    >
                                      {copiedKey === copyId ? (
                                        <Check className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  ) : null}
                                </dd>
                              </div>
                            )
                          })}
                        </dl>
                      ) : null}

                      {/* Tone banner: surface failure/PII signals */}
                      {group.id === "quality" && piiColumnsFromTypeMap(file).length > 0 ? (
                        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            This file contains columns flagged as PII. Apply masking or access controls before sharing.
                          </span>
                        </div>
                      ) : null}
                    </section>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  )
}
