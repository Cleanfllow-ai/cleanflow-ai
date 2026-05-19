"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  Cloud,
  Database,
  Download,
  FileJson,
  GitBranch,
  ImageDown,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/shared/hooks/use-toast"
import { formatToIST } from "@/shared/lib/utils"
import { cn } from "@/shared/lib/utils"
import type { FileStatusResponse, FileVersionSummary } from "@/modules/files"
import { triggerBlobDownload } from "@/modules/files/utils/trigger-download"

// ─── Stage / status taxonomy ──────────────────────────────────────────
type StageKind = "source" | "validate" | "dq" | "output" | "export"
type NodeStatus = "ok" | "fail" | "running" | "partial" | "pending"

interface LineageNode {
  id: string
  stage: StageKind
  title: string
  subtitle?: string
  status: NodeStatus
  statusLabel?: string
  /** Detail rows shown only on hover */
  details: { label: string; value: string }[]
  /** When set, clicking the node loads this version. */
  uploadId?: string
  selected?: boolean
}

// Stage palette — matches oklch brand tokens (deep blue + teal + cyan family).
// Tailwind tokens are kept utility-first so dark mode works out of the box.
const STAGE_STYLE: Record<StageKind, {
  fill: string
  stroke: string
  iconColor: string
  ring: string
  Icon: typeof Cloud
  badgeTone: string
  label: string
}> = {
  source: {
    fill: "rgba(148, 163, 184, 0.18)",
    stroke: "rgba(100, 116, 139, 0.70)",
    iconColor: "rgb(71, 85, 105)",
    ring: "ring-slate-300 dark:ring-slate-600",
    Icon: Cloud,
    badgeTone: "bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30",
    label: "Source",
  },
  validate: {
    fill: "rgba(56, 189, 248, 0.18)",
    stroke: "rgba(14, 165, 233, 0.70)",
    iconColor: "rgb(2, 132, 199)",
    ring: "ring-sky-300 dark:ring-sky-500/40",
    Icon: ShieldCheck,
    badgeTone: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30",
    label: "Validate",
  },
  dq: {
    fill: "rgba(168, 85, 247, 0.18)",
    stroke: "rgba(147, 51, 234, 0.70)",
    iconColor: "rgb(126, 34, 206)",
    ring: "ring-violet-300 dark:ring-violet-500/40",
    Icon: Sparkles,
    badgeTone: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30",
    label: "Data Quality",
  },
  output: {
    fill: "rgba(16, 185, 129, 0.18)",
    stroke: "rgba(5, 150, 105, 0.70)",
    iconColor: "rgb(4, 120, 87)",
    ring: "ring-emerald-300 dark:ring-emerald-500/40",
    Icon: Database,
    badgeTone: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
    label: "Output",
  },
  export: {
    fill: "rgba(245, 158, 11, 0.18)",
    stroke: "rgba(217, 119, 6, 0.70)",
    iconColor: "rgb(180, 83, 9)",
    ring: "ring-amber-300 dark:ring-amber-500/40",
    Icon: Send,
    badgeTone: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
    label: "Export",
  },
}

const STATUS_BADGE: Record<NodeStatus, { label: string; chip: string; Icon: typeof Check }> = {
  ok: {
    label: "Done",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
    Icon: Check,
  },
  fail: {
    label: "Failed",
    chip: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
    Icon: X,
  },
  running: {
    label: "Running",
    chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
    Icon: Loader2,
  },
  partial: {
    label: "Partial",
    chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
    Icon: AlertTriangle,
  },
  pending: {
    label: "—",
    chip: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-muted dark:text-muted-foreground dark:border-border",
    Icon: Minus,
  },
}

function statusOf(status?: string | null, partial?: boolean | null): NodeStatus {
  const s = (status || "").toUpperCase()
  if (s.includes("FAIL") || s.includes("REJECT")) return "fail"
  if (
    s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED") ||
    s.includes("DISPATCH") || s.includes("UPLOADING") || s.includes("SHARDING")
  ) {
    return "running"
  }
  if (partial) return "partial"
  if (
    s.includes("FIXED") || s.includes("COMPLETE") || s.includes("PROCESSED") ||
    s.includes("UPLOADED") || s.includes("VALIDATED")
  ) {
    return "ok"
  }
  return "pending"
}

function fmt(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—"
  return n.toLocaleString("en-US")
}

// ─── Node builder ────────────────────────────────────────────────────
function buildNodes(
  file: FileStatusResponse,
  versions: FileVersionSummary[],
  selectedUploadId: string | null,
): LineageNode[] {
  const nodes: LineageNode[] = []
  const erpMeta = (file as any).erp_metadata
  const sourceType = file.source_type

  // ── 1. Source ────────────────────────────────────────────────
  if (sourceType && sourceType !== "user_upload") {
    const subtitle = file.detected_erp || erpMeta?.erp_type || sourceType
    const details: LineageNode["details"] = [
      { label: "Source type", value: String(sourceType) },
    ]
    if (file.detected_erp) details.push({ label: "ERP", value: String(file.detected_erp) })
    if (erpMeta?.original_mime_type) details.push({ label: "MIME", value: String(erpMeta.original_mime_type) })
    if (erpMeta?.file_id) details.push({ label: "Source ID", value: String(erpMeta.file_id) })
    nodes.push({
      id: "stage-source",
      stage: "source",
      title: "Source",
      subtitle: String(subtitle),
      status: "ok",
      statusLabel: "Connected",
      details,
    })
  } else {
    const details: LineageNode["details"] = [
      { label: "Filename", value: file.original_filename || file.filename || "—" },
    ]
    if (file.uploaded_at) details.push({ label: "Uploaded", value: formatToIST(file.uploaded_at) })
    nodes.push({
      id: "stage-source",
      stage: "source",
      title: "Source",
      subtitle: "User upload",
      status: "ok",
      statusLabel: "Received",
      details,
    })
  }

  // ── 2. Validate ──────────────────────────────────────────────
  const status = (file.status || "").toUpperCase()
  const reachedValidate = status !== "UPLOADING" && status !== "QUEUED"
  const validateStatus: NodeStatus = !reachedValidate
    ? "pending"
    : status === "REJECTED" || status === "UPLOAD_FAILED"
      ? "fail"
      : "ok"
  nodes.push({
    id: "stage-validate",
    stage: "validate",
    title: "Validate",
    subtitle: validateStatus === "fail" ? "Validation failed" : validateStatus === "pending" ? "Waiting" : "Schema OK",
    status: validateStatus,
    statusLabel: validateStatus === "ok" ? "Passed" : validateStatus === "fail" ? "Rejected" : "Pending",
    details: [
      { label: "Content type", value: file.content_type || "—" },
      { label: "Rows detected", value: fmt(file.rows_in) },
    ],
  })

  // ── 3. DQ — one node per version (ordered) ──────────────────
  const ordered = [...versions].sort(
    (a, b) => (a.version_number || 0) - (b.version_number || 0),
  )

  if (ordered.length === 0) {
    const vStatus = statusOf(file.status, file.partial_completion)
    const reachedDq =
      status.includes("DQ") || status.includes("FIXED") || status.includes("PROCESSED") ||
      status.includes("RUNNING") || status.includes("FAIL") || status.includes("REJECT") ||
      status.includes("SHARD")
    nodes.push({
      id: file.upload_id,
      stage: "dq",
      title: `v${file.version_number || 1}`,
      subtitle: reachedDq ? (file.status || "—") : "Not yet run",
      status: reachedDq ? vStatus : "pending",
      statusLabel: reachedDq
        ? STATUS_BADGE[vStatus].label
        : "Pending",
      details: [
        { label: "DQ score", value: file.dq_score != null ? `${file.dq_score.toFixed(1)}%` : "—" },
        { label: "Rows in", value: fmt(file.rows_in) },
        { label: "Quarantined", value: fmt(file.rows_quarantined) },
        { label: "Updated", value: file.updated_at ? formatToIST(file.updated_at) : "—" },
        ...(file.processing_time_seconds != null
          ? [{ label: "Duration", value: `${file.processing_time_seconds.toFixed(1)}s` }]
          : []),
      ],
      uploadId: file.upload_id,
      selected: file.upload_id === selectedUploadId,
    })
  } else {
    for (const v of ordered) {
      const vPartial = (v as any).partial_completion === true
      const vStatus = statusOf(v.status, vPartial)
      const details: LineageNode["details"] = [
        { label: "DQ score", value: v.dq_score != null ? `${(v.dq_score as number).toFixed(1)}%` : "—" },
        { label: "Rows in", value: fmt(v.rows_in) },
        { label: "Clean", value: fmt(v.rows_clean) },
        { label: "Quarantined", value: fmt(v.rows_quarantined) },
        { label: "Uploaded", value: v.uploaded_at ? formatToIST(v.uploaded_at) : "—" },
      ]
      if (v.processing_time_seconds != null) {
        details.push({ label: "Duration", value: `${v.processing_time_seconds.toFixed(1)}s` })
      }
      if (v.remediation_mode) {
        details.push({ label: "Remediation", value: v.remediation_mode })
      }
      if (v.patch_notes) {
        details.push({ label: "Notes", value: v.patch_notes })
      }
      nodes.push({
        id: v.upload_id,
        stage: "dq",
        title: `v${v.version_number || 1}${v.is_latest ? " · latest" : ""}`,
        subtitle: v.status || "—",
        status: vStatus,
        statusLabel: STATUS_BADGE[vStatus].label,
        details,
        uploadId: v.upload_id,
        selected: v.upload_id === selectedUploadId,
      })
    }
  }

  // ── 4. Output (cleaned dataset) ─────────────────────────────
  const outputReady =
    status.includes("DQ_FIXED") || status.includes("COMPLETE") || status.includes("PROCESSED")
  nodes.push({
    id: "stage-output",
    stage: "output",
    title: "Output",
    subtitle: outputReady
      ? (file.partial_completion ? "Cleaned (partial)" : "Cleaned dataset")
      : "Awaiting DQ",
    status: outputReady ? (file.partial_completion ? "partial" : "ok") : "pending",
    statusLabel: outputReady ? (file.partial_completion ? "Partial" : "Ready") : "Pending",
    details: [
      { label: "Rows clean", value: fmt(file.rows_clean) },
      { label: "Rows fixed", value: fmt(file.rows_fixed) },
      { label: "Rows quarantined", value: fmt(file.rows_quarantined) },
      ...(file.s3_result_key ? [{ label: "Result key", value: String(file.s3_result_key) }] : []),
    ],
  })

  // ── 5. Export ───────────────────────────────────────────────
  const exportProvider = (file as any).export_provider
  const exportEntity = (file as any).export_entity
  const exportStatus = (file as any).export_status
  const exportTs = (file as any).export_timestamp
  const exportDetails = (file as any).export_details
  if (exportProvider) {
    const eStatus: NodeStatus =
      exportStatus === "pushed" ? "ok"
        : exportStatus === "failed" ? "fail"
          : exportStatus === "exporting" ? "running"
            : "pending"
    const details: LineageNode["details"] = [
      { label: "Provider", value: String(exportProvider) },
    ]
    if (exportEntity) details.push({ label: "Entity", value: String(exportEntity) })
    if (exportTs) details.push({ label: "Timestamp", value: formatToIST(exportTs) })
    if (exportDetails && typeof exportDetails === "object") {
      const d = exportDetails as Record<string, any>
      if (typeof d.created === "number") details.push({ label: "Created", value: fmt(d.created) })
      if (typeof d.updated === "number") details.push({ label: "Updated", value: fmt(d.updated) })
      if (typeof d.errors === "number" && d.errors > 0) details.push({ label: "Errors", value: fmt(d.errors) })
    }
    nodes.push({
      id: "stage-export",
      stage: "export",
      title: "Export",
      subtitle: `${exportProvider}${exportEntity ? ` · ${exportEntity}` : ""}`,
      status: eStatus,
      statusLabel: exportStatus || STATUS_BADGE[eStatus].label,
      details,
    })
  }

  return nodes
}

// ─── Layout (left-to-right horizontal flow) ──────────────────────────
const NODE_W = 200
const NODE_H = 116
const NODE_GAP = 56
const HORIZ_PAD = 24
const VERT_PAD = 24

interface PositionedNode {
  node: LineageNode
  x: number
  y: number
}

function layout(nodes: LineageNode[]): { positions: PositionedNode[]; total_w: number; total_h: number } {
  const positions: PositionedNode[] = nodes.map((node, i) => ({
    node,
    x: HORIZ_PAD + i * (NODE_W + NODE_GAP),
    y: VERT_PAD,
  }))
  const total_w = HORIZ_PAD * 2 + nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP
  const total_h = VERT_PAD * 2 + NODE_H + 28 /* stage label header */
  return { positions, total_w: Math.max(total_w, NODE_W + HORIZ_PAD * 2), total_h }
}

interface FileLineageTabProps {
  file: FileStatusResponse
  versions: FileVersionSummary[]
  versionsLoading: boolean
  selectedUploadId: string | null
  onSelectVersion: (uploadId: string) => void
}

export function FileLineageTab({
  file,
  versions,
  versionsLoading,
  selectedUploadId,
  onSelectVersion,
}: FileLineageTabProps) {
  const [zoom, setZoom] = useState(1)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const { toast } = useToast()

  // ESC exits fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen])

  const nodes = useMemo(
    () => buildNodes(file, versions, selectedUploadId),
    [file, versions, selectedUploadId],
  )
  const { positions, total_w, total_h } = useMemo(() => layout(nodes), [nodes])

  const filenameBase = (file.original_filename || file.filename || file.upload_id).replace(/\.[^.]+$/, "")

  const downloadJson = () => {
    const payload = {
      root_upload_id: file.root_upload_id || file.upload_id,
      original_filename: file.original_filename || file.filename,
      stages: nodes.map((n) => ({
        stage: n.stage,
        title: n.title,
        subtitle: n.subtitle,
        status: n.status,
        upload_id: n.uploadId,
        details: n.details,
      })),
      versions: versions.map((v) => ({
        upload_id: v.upload_id,
        version_number: v.version_number,
        parent_upload_id: v.parent_upload_id,
        source_upload_id: v.source_upload_id,
        is_latest: v.is_latest,
        status: v.status,
        dq_score: v.dq_score,
        rows_in: v.rows_in,
        rows_clean: v.rows_clean,
        rows_fixed: v.rows_fixed,
        rows_quarantined: v.rows_quarantined,
        remediation_mode: v.remediation_mode,
        patch_notes: v.patch_notes,
        uploaded_at: v.uploaded_at,
      })),
      export: (file as any).export_provider
        ? {
            provider: (file as any).export_provider,
            entity: (file as any).export_entity,
            status: (file as any).export_status,
            timestamp: (file as any).export_timestamp,
            details: (file as any).export_details,
          }
        : null,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    triggerBlobDownload(url, `lineage_${filenameBase}.json`)
    URL.revokeObjectURL(url)
    toast({ title: "Downloaded", description: "Lineage JSON saved" })
  }

  const downloadSvg = () => {
    if (!svgRef.current) return
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    triggerBlobDownload(url, `lineage_${filenameBase}.svg`)
    URL.revokeObjectURL(url)
    toast({ title: "Downloaded", description: "Lineage SVG saved" })
  }

  if (versionsLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading lineage…
      </div>
    )
  }

  // Empty state — nothing to show
  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
          <Upload className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <div className="font-medium text-foreground">No lineage yet</div>
        <p className="max-w-sm text-xs">
          Once this file moves through validation, DQ, and export, the pipeline graph will appear here.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          fullscreen && "fixed inset-0 z-50 bg-background",
        )}
      >
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/60 px-6 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{nodes.length}</span>
            <span className="text-muted-foreground">stage{nodes.length === 1 ? "" : "s"}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="font-medium">{versions.length || 1}</span>
            <span className="text-muted-foreground">version{versions.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="w-12 rounded text-center font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Reset zoom to 100%"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setFullscreen((f) => !f)}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            >
              {fullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="ml-2 gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadJson}>
                  <FileJson className="mr-2 h-4 w-4" /> JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadSvg}>
                  <ImageDown className="mr-2 h-4 w-4" /> SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Canvas — vertical scroll for legend / zoomed-in graph; horizontal scroll wraps SVG only */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-6 py-6">
            {/* Pipeline graph — horizontal overflow wrapper */}
            <div className="relative -mx-6 overflow-x-auto overflow-y-hidden px-6">
              <svg
                ref={svgRef}
                width={total_w * zoom}
                height={total_h * zoom}
                viewBox={`0 0 ${total_w} ${total_h}`}
                className="block"
                style={{ minHeight: total_h * zoom, maxWidth: "none" }}
              >
                  <defs>
                    <marker
                      id="lineage-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(99, 102, 241, 0.55)" />
                    </marker>
                    <marker
                      id="lineage-arrow-running"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(245, 158, 11, 0.75)" />
                    </marker>
                  </defs>

                  {/* Edges (drawn first so they sit behind nodes) */}
                  {positions.map((p, i) => {
                    if (i === positions.length - 1) return null
                    const next = positions[i + 1]
                    const x1 = p.x + NODE_W
                    const y1 = p.y + NODE_H / 2
                    const x2 = next.x
                    const y2 = next.y + NODE_H / 2
                    const midX = (x1 + x2) / 2
                    const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
                    // Edge is "in-progress" if downstream node is pending or running
                    const downstreamRunning =
                      next.node.status === "running" || next.node.status === "pending"
                    return (
                      <path
                        key={`edge-${i}`}
                        d={path}
                        fill="none"
                        stroke={downstreamRunning ? "rgba(245, 158, 11, 0.55)" : "rgba(99, 102, 241, 0.45)"}
                        strokeWidth={1.5}
                        strokeDasharray={downstreamRunning ? "5 4" : undefined}
                        markerEnd={downstreamRunning ? "url(#lineage-arrow-running)" : "url(#lineage-arrow)"}
                      >
                        {downstreamRunning ? (
                          <animate
                            attributeName="stroke-dashoffset"
                            from="0"
                            to="-18"
                            dur="1.2s"
                            repeatCount="indefinite"
                          />
                        ) : null}
                      </path>
                    )
                  })}

                  {/* Nodes */}
                  {positions.map(({ node, x, y }) => {
                    const stage = STAGE_STYLE[node.stage]
                    const StageIcon = stage.Icon
                    const StatusIcon = STATUS_BADGE[node.status].Icon
                    const interactive = node.stage === "dq" && Boolean(node.uploadId)
                    const isHovered = hoveredId === node.id
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${x}, ${y})`}
                        style={{ cursor: interactive ? "pointer" : "default" }}
                        onClick={() => {
                          if (interactive && node.uploadId) onSelectVersion(node.uploadId)
                        }}
                        onMouseEnter={() => setHoveredId(node.id)}
                        onMouseLeave={() => setHoveredId((prev) => (prev === node.id ? null : prev))}
                      >
                        {/* Stage label above node */}
                        <text
                          x={NODE_W / 2}
                          y={-8}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={600}
                          letterSpacing={0.6}
                          fill="rgb(100, 116, 139)"
                          style={{ textTransform: "uppercase" }}
                        >
                          {stage.label}
                        </text>
                        {/* Card */}
                        <rect
                          width={NODE_W}
                          height={NODE_H}
                          rx={12}
                          fill={stage.fill}
                          stroke={node.selected ? "rgb(59, 130, 246)" : stage.stroke}
                          strokeWidth={node.selected ? 2 : 1.25}
                          style={{
                            transition: "stroke-width 150ms ease",
                            filter: isHovered ? "drop-shadow(0 4px 8px rgba(0,0,0,0.08))" : undefined,
                          }}
                        />
                        <foreignObject x={0} y={0} width={NODE_W} height={NODE_H}>
                          <div
                            className="flex h-full flex-col gap-1.5 px-3 py-2.5 text-xs"
                            style={{ color: "var(--foreground)" }}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <StageIcon
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: stage.iconColor }}
                                />
                                <span className="truncate font-semibold">{node.title}</span>
                              </div>
                              {/* Status icon (no text — pill below carries the label) */}
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  STATUS_BADGE[node.status].chip,
                                )}
                                aria-label={STATUS_BADGE[node.status].label}
                              >
                                <StatusIcon
                                  className={cn(
                                    "h-2.5 w-2.5",
                                    node.status === "running" ? "animate-spin" : "",
                                  )}
                                />
                              </span>
                            </div>
                            {/* Subtitle */}
                            {node.subtitle ? (
                              <div className="truncate text-[11px] text-muted-foreground" title={node.subtitle}>
                                {node.subtitle}
                              </div>
                            ) : null}
                            {/* Status pill (always shown, semantic colour) */}
                            <div className="mt-auto flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                                  STATUS_BADGE[node.status].chip,
                                )}
                              >
                                {node.statusLabel || STATUS_BADGE[node.status].label}
                              </span>
                              {interactive ? (
                                <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
                                  click to load
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </foreignObject>

                        {/* Hover hit-area for tooltip */}
                        {node.details.length > 0 ? (
                          <foreignObject x={0} y={-20} width={NODE_W} height={NODE_H + 20}>
                            <div className="h-full w-full">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-full w-full" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="bottom"
                                  align="center"
                                  className="max-w-xs space-y-1.5 p-3"
                                >
                                  <div className="flex items-center gap-1.5 border-b border-border/40 pb-1">
                                    <StageIcon className="h-3 w-3" style={{ color: stage.iconColor }} />
                                    <span className="text-xs font-semibold">{node.title}</span>
                                    <span
                                      className={cn(
                                        "ml-auto rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                                        STATUS_BADGE[node.status].chip,
                                      )}
                                    >
                                      {node.statusLabel || STATUS_BADGE[node.status].label}
                                    </span>
                                  </div>
                                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
                                    {node.details.map((d, idx) => (
                                      <div key={idx} className="contents">
                                        <dt className="font-medium text-primary-foreground/70">{d.label}</dt>
                                        <dd className="break-all font-mono text-primary-foreground">{d.value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                  {node.uploadId ? (
                                    <div className="mt-1 truncate font-mono text-[10px] text-primary-foreground/60">
                                      {node.uploadId}
                                    </div>
                                  ) : null}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </foreignObject>
                        ) : null}
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Stage legend */}
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/40 pt-4 text-[11px]">
                <span className="font-medium uppercase tracking-wider text-muted-foreground">Stages:</span>
                {(Object.keys(STAGE_STYLE) as StageKind[]).map((stage) => {
                  const s = STAGE_STYLE[stage]
                  const Icon = s.Icon
                  return (
                    <span key={stage} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5", s.badgeTone)}>
                      <Icon className="h-3 w-3" />
                      {s.label}
                    </span>
                  )
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
                <span className="font-medium uppercase tracking-wider text-muted-foreground">Status:</span>
                {(["ok", "partial", "running", "fail", "pending"] as NodeStatus[]).map((s) => {
                  const cfg = STATUS_BADGE[s]
                  const Icon = cfg.Icon
                  return (
                    <Badge key={s} variant="outline" className={cn("gap-1 font-medium", cfg.chip)}>
                      <Icon className={cn("h-2.5 w-2.5", s === "running" ? "animate-spin" : "")} />
                      {cfg.label}
                    </Badge>
                  )
                })}
                <span className="ml-auto text-muted-foreground">Hover a stage for details · click a version node to load it.</span>
              </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
