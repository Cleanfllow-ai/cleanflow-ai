"use client"

import { useMemo, useRef, useState } from "react"
import {
  Cloud,
  Database,
  Download,
  FileJson,
  GitBranch,
  ImageDown,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Send,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/shared/hooks/use-toast"
import { formatToIST } from "@/shared/lib/utils"
import { cn } from "@/shared/lib/utils"
import type { FileStatusResponse, FileVersionSummary } from "@/modules/files"
import { triggerBlobDownload } from "@/modules/files/utils/trigger-download"

type NodeStatus = "ok" | "fail" | "running" | "partial" | "neutral"

interface LineageNode {
  id: string
  kind: "source" | "version" | "export"
  title: string
  subtitle?: string
  meta?: string[]
  status: NodeStatus
  uploadId?: string
  selected?: boolean
}

interface FileLineageTabProps {
  file: FileStatusResponse
  versions: FileVersionSummary[]
  versionsLoading: boolean
  selectedUploadId: string | null
  onSelectVersion: (uploadId: string) => void
}

const STATUS_COLORS: Record<NodeStatus, { fill: string; stroke: string; text: string; chip: string }> = {
  ok: {
    fill: "rgba(16, 185, 129, 0.10)",
    stroke: "rgba(16, 185, 129, 0.65)",
    text: "rgb(4, 120, 87)",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  fail: {
    fill: "rgba(239, 68, 68, 0.10)",
    stroke: "rgba(239, 68, 68, 0.65)",
    text: "rgb(185, 28, 28)",
    chip: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  },
  running: {
    fill: "rgba(245, 158, 11, 0.10)",
    stroke: "rgba(245, 158, 11, 0.65)",
    text: "rgb(180, 83, 9)",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  partial: {
    fill: "rgba(245, 158, 11, 0.10)",
    stroke: "rgba(245, 158, 11, 0.65)",
    text: "rgb(180, 83, 9)",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  neutral: {
    fill: "rgba(99, 102, 241, 0.08)",
    stroke: "rgba(99, 102, 241, 0.55)",
    text: "rgb(67, 56, 202)",
    chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  },
}

function statusOf(status?: string | null, partial?: boolean | null): NodeStatus {
  const s = (status || "").toUpperCase()
  if (s.includes("FAIL") || s.includes("REJECT")) return "fail"
  if (s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED") || s.includes("DISPATCH") || s.includes("UPLOADING") || s.includes("SHARDING")) {
    return "running"
  }
  if (partial) return "partial"
  if (s.includes("FIXED") || s.includes("COMPLETE") || s.includes("PROCESSED") || s.includes("UPLOADED") || s.includes("VALIDATED")) {
    return "ok"
  }
  return "neutral"
}

function buildNodes(
  file: FileStatusResponse,
  versions: FileVersionSummary[],
  selectedUploadId: string | null,
): LineageNode[] {
  const nodes: LineageNode[] = []

  const sourceType = file.source_type
  const erpMeta = (file as any).erp_metadata
  if (sourceType && sourceType !== "user_upload") {
    const subtitle = file.detected_erp || erpMeta?.erp_type || sourceType
    const meta: string[] = []
    if (erpMeta?.original_mime_type) meta.push(`type: ${erpMeta.original_mime_type}`)
    if (erpMeta?.file_id) meta.push(`source id: ${erpMeta.file_id}`)
    nodes.push({
      id: "source",
      kind: "source",
      title: "Source Connector",
      subtitle: String(subtitle),
      meta,
      status: "neutral",
    })
  } else {
    nodes.push({
      id: "source",
      kind: "source",
      title: "User Upload",
      subtitle: file.original_filename || file.filename || "—",
      status: "neutral",
    })
  }

  const ordered = [...versions].sort(
    (a, b) => (a.version_number || 0) - (b.version_number || 0),
  )

  const fmt = (n: number) => n.toLocaleString("en-US")

  if (ordered.length === 0) {
    // Single-node fallback (legacy / no version chain)
    nodes.push({
      id: file.upload_id,
      kind: "version",
      title: `v${file.version_number || 1}`,
      subtitle: file.status,
      meta: [
        file.dq_score != null ? `${file.dq_score.toFixed(1)}% DQ` : "",
        file.rows_in != null ? `${fmt(file.rows_in)} rows` : "",
        file.uploaded_at ? formatToIST(file.uploaded_at) : "",
      ].filter(Boolean),
      status: statusOf(file.status, file.partial_completion),
      uploadId: file.upload_id,
      selected: file.upload_id === selectedUploadId,
    })
  } else {
    for (const v of ordered) {
      const isPartial = (v as any).partial_completion === true
      nodes.push({
        id: v.upload_id,
        kind: "version",
        title: `v${v.version_number || 1}${v.is_latest ? " · latest" : ""}`,
        subtitle: v.status || "—",
        meta: [
          v.dq_score != null ? `${(v.dq_score as number).toFixed(1)}% DQ` : "",
          v.rows_in != null ? `${fmt(v.rows_in)} rows` : "",
          v.rows_quarantined ? `${fmt(v.rows_quarantined)} quarantined` : "",
          v.uploaded_at ? formatToIST(v.uploaded_at) : "",
          v.remediation_mode ? `mode: ${v.remediation_mode}` : "",
        ].filter(Boolean),
        status: statusOf(v.status, isPartial),
        uploadId: v.upload_id,
        selected: v.upload_id === selectedUploadId,
      })
    }
  }

  const exportProvider = (file as any).export_provider
  const exportEntity = (file as any).export_entity
  const exportStatus = (file as any).export_status
  if (exportProvider) {
    const ts = (file as any).export_timestamp
    nodes.push({
      id: "export",
      kind: "export",
      title: "ERP Export",
      subtitle: `${exportProvider}${exportEntity ? ` · ${exportEntity}` : ""}`,
      meta: [
        exportStatus ? `status: ${exportStatus}` : "",
        ts ? formatToIST(ts) : "",
      ].filter(Boolean),
      status: exportStatus === "pushed" ? "ok" : exportStatus === "failed" ? "fail" : "running",
    })
  }

  return nodes
}

const NODE_W = 280
const NODE_MIN_H = 84
const NODE_GAP = 32
const HORIZ_PAD = 32
const TOP_PAD = 24

function nodeHeight(node: LineageNode): number {
  const base = NODE_MIN_H
  if (!node.meta) return base
  const extras = Math.max(0, node.meta.length - 2) * 14
  return base + extras
}

interface LayoutResult {
  total_h: number
  total_w: number
  positions: Array<{ node: LineageNode; x: number; y: number; h: number }>
}

function layout(nodes: LineageNode[]): LayoutResult {
  let y = TOP_PAD
  const x = HORIZ_PAD
  const positions = nodes.map((node) => {
    const h = nodeHeight(node)
    const pos = { node, x, y, h }
    y += h + NODE_GAP
    return pos
  })
  return {
    total_h: y - NODE_GAP + TOP_PAD,
    total_w: NODE_W + HORIZ_PAD * 2,
    positions,
  }
}

function nodeIcon(kind: LineageNode["kind"]) {
  if (kind === "source") return Cloud
  if (kind === "export") return Send
  return Database
}

export function FileLineageTab({
  file,
  versions,
  versionsLoading,
  selectedUploadId,
  onSelectVersion,
}: FileLineageTabProps) {
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement>(null)
  const { toast } = useToast()

  const nodes = useMemo(() => buildNodes(file, versions, selectedUploadId), [file, versions, selectedUploadId])
  const { total_h, total_w, positions } = useMemo(() => layout(nodes), [nodes])

  const filenameBase = (file.original_filename || file.filename || file.upload_id).replace(/\.[^.]+$/, "")

  const downloadJson = () => {
    const payload = {
      root_upload_id: file.root_upload_id || file.upload_id,
      original_filename: file.original_filename || file.filename,
      source: nodes[0]
        ? { title: nodes[0].title, subtitle: nodes[0].subtitle, meta: nodes[0].meta }
        : null,
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/60 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{nodes.length}</span>
          <span className="text-muted-foreground">node{nodes.length !== 1 ? "s" : ""}</span>
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
          <span className="w-10 text-center font-mono text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
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
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
          >
            <Maximize2 className="h-3.5 w-3.5" />
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

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
        <div className="px-6 py-4">
          {nodes.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground">
              <Upload className="mb-2 h-6 w-6" />
              No lineage data yet.
            </div>
          ) : (
            <div className="flex justify-center">
              <svg
                ref={svgRef}
                width={total_w * zoom}
                height={total_h * zoom}
                viewBox={`0 0 ${total_w} ${total_h}`}
                className="max-w-full"
              >
                <defs>
                  <marker
                    id="lineage-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(99, 102, 241, 0.65)" />
                  </marker>
                </defs>
                {positions.map((p, i) => {
                  if (i === positions.length - 1) return null
                  const next = positions[i + 1]
                  const x1 = p.x + NODE_W / 2
                  const y1 = p.y + p.h
                  const x2 = next.x + NODE_W / 2
                  const y2 = next.y - 2
                  const midY = y1 + (y2 - y1) / 2
                  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
                  return (
                    <path
                      key={`edge-${i}`}
                      d={path}
                      fill="none"
                      stroke="rgba(99, 102, 241, 0.45)"
                      strokeWidth={1.5}
                      markerEnd="url(#lineage-arrow)"
                    />
                  )
                })}
                {positions.map(({ node, x, y, h }) => {
                  const c = STATUS_COLORS[node.status]
                  const Icon = nodeIcon(node.kind)
                  const interactive = node.kind === "version" && Boolean(node.uploadId)
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x}, ${y})`}
                      style={{ cursor: interactive ? "pointer" : "default" }}
                      onClick={() => {
                        if (interactive && node.uploadId) onSelectVersion(node.uploadId)
                      }}
                    >
                      <rect
                        width={NODE_W}
                        height={h}
                        rx={10}
                        fill={c.fill}
                        stroke={node.selected ? "rgba(59, 130, 246, 0.95)" : c.stroke}
                        strokeWidth={node.selected ? 2 : 1.25}
                      />
                      <foreignObject x={0} y={0} width={NODE_W} height={h}>
                        <div
                          className="flex h-full flex-col gap-1 px-3 py-2 text-xs"
                          style={{ color: "var(--foreground)" }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <span className="truncate font-semibold">{node.title}</span>
                            </div>
                            {node.subtitle ? (
                              <span
                                className={cn(
                                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                  c.chip,
                                )}
                              >
                                {node.subtitle}
                              </span>
                            ) : null}
                          </div>
                          {node.meta && node.meta.length > 0 ? (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                              {node.meta.map((m, idx) => (
                                <span key={idx} className="truncate">
                                  {m}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {node.uploadId ? (
                            <div className="mt-auto truncate font-mono text-[10px] text-muted-foreground/70">
                              {node.uploadId}
                            </div>
                          ) : null}
                        </div>
                      </foreignObject>
                    </g>
                  )
                })}
              </svg>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-medium uppercase tracking-wider">Legend:</span>
            {([
              ["ok", "Success"],
              ["partial", "Partial"],
              ["running", "Running / Queued"],
              ["fail", "Failed"],
              ["neutral", "Source / Pending"],
            ] as Array<[NodeStatus, string]>).map(([key, label]) => (
              <Badge key={key} variant="outline" className={cn("font-medium", STATUS_COLORS[key].chip)}>
                {label}
              </Badge>
            ))}
            <span className="ml-2">Click any version node to load it.</span>
          </div>
        </div>
        </ScrollArea>
      </div>
    </div>
  )
}
