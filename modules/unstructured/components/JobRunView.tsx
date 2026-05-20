"use client"

/**
 * JobRunView — live split-pane for a single unstructured-import job.
 *
 *   Left pane:   SSE log (auto-scroll, color-coded by kind)
 *   Right pane:  per-file results table (polled every 4 s while running)
 *
 * Job-level summary header shows counts + cost + a download button when the
 * job reaches a terminal state and the BE has produced an augmented file.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Pause,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/shared/lib/utils"
import { unstructuredApi } from "../api/unstructured-api"
import { useUnstructuredSSE } from "../hooks/useUnstructuredSSE"
import type {
  UnstructuredFileRecord,
  UnstructuredFileStatus,
  UnstructuredJob,
  UnstructuredLogEvent,
} from "../types/unstructured.types"

interface JobRunViewProps {
  jobId: string
}

const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "partial",
  "cancelled",
])

function fmtTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return ts
  }
}

function logColor(ev: UnstructuredLogEvent): string {
  switch (ev.kind) {
    case "state_transition":
      return "text-muted-foreground"
    case "file_event":
      if (ev.file_status === "done") return "text-emerald-600"
      if (ev.file_status === "review_required") return "text-amber-600"
      if (ev.file_status === "failed") return "text-rose-600"
      if (ev.file_status === "skipped") return "text-muted-foreground"
      return "text-foreground"
    case "warning":
      return "text-amber-600"
    case "error":
      return "text-rose-600"
    case "done":
      return "text-emerald-600 font-medium"
    default:
      return "text-foreground"
  }
}

function fileStatusBadge(status: UnstructuredFileStatus) {
  const map: Record<
    UnstructuredFileStatus,
    { label: string; cls: string; Icon: typeof CheckCircle2 }
  > = {
    queued: {
      label: "Queued",
      cls: "bg-muted/40 text-muted-foreground border-muted",
      Icon: Clock,
    },
    parsing: {
      label: "Parsing",
      cls: "bg-sky-50 text-sky-700 border-sky-200",
      Icon: Loader2,
    },
    extracting: {
      label: "Extracting",
      cls: "bg-violet-50 text-violet-700 border-violet-200",
      Icon: Loader2,
    },
    augmenting: {
      label: "Augmenting",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
      Icon: Loader2,
    },
    done: {
      label: "Done",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Icon: CheckCircle2,
    },
    review_required: {
      label: "Review",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      Icon: AlertTriangle,
    },
    failed: {
      label: "Failed",
      cls: "bg-rose-50 text-rose-700 border-rose-200",
      Icon: XCircle,
    },
    skipped: {
      label: "Skipped",
      cls: "bg-muted/30 text-muted-foreground border-muted",
      Icon: Pause,
    },
  }
  const entry = map[status] || map.queued
  const Icon = entry.Icon
  return (
    <Badge variant="outline" className={cn("gap-1", entry.cls)}>
      <Icon className={cn("h-3 w-3", status === "parsing" || status === "extracting" || status === "augmenting" ? "animate-spin" : "")} />
      {entry.label}
    </Badge>
  )
}

export function JobRunView({ jobId }: JobRunViewProps) {
  const [job, setJob] = useState<UnstructuredJob | null>(null)
  const [files, setFiles] = useState<UnstructuredFileRecord[]>([])
  const [jobError, setJobError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const logScrollRef = useRef<HTMLDivElement | null>(null)

  const terminal = job ? TERMINAL_STATUSES.has(job.status) : false

  const sse = useUnstructuredSSE(jobId, { enabled: !terminal })

  // Poll job + files every 4 s while not terminal.
  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const j = await unstructuredApi.getJob(jobId)
        if (cancelled) return
        setJob(j)
        setJobError(null)
        if (TERMINAL_STATUSES.has(j.status)) {
          // Fetch full file list once at completion.
          const fl = await unstructuredApi.listFiles(jobId, undefined, 500)
          if (!cancelled) setFiles(fl.files || [])
          return
        }
        // Otherwise: light incremental fetch (first 100).
        const fl = await unstructuredApi.listFiles(jobId, undefined, 100)
        if (!cancelled) setFiles(fl.files || [])
      } catch (err) {
        if (cancelled) return
        const message = (err as Error)?.message || "Failed to load job"
        setJobError(message)
      }
    }

    void refresh()
    const interval = setInterval(() => {
      if (terminal) return
      void refresh()
    }, 4000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId, terminal])

  // Auto-scroll the log pane when new events arrive.
  useEffect(() => {
    if (!autoScroll) return
    const node = logScrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [sse.events, autoScroll])

  const handleDownloadResult = async () => {
    setDownloading(true)
    try {
      const r = await unstructuredApi.getResult(jobId)
      setResultUrl(r.presigned_url)
      window.open(r.presigned_url, "_blank", "noopener,noreferrer")
    } catch (err) {
      setJobError((err as Error)?.message || "Failed to fetch result")
    } finally {
      setDownloading(false)
    }
  }

  const headerStatus = useMemo(() => {
    if (!job) return null
    const status = job.status
    if (status === "running" || status === "pending") {
      return (
        <Badge className="gap-1 bg-sky-50 text-sky-700 border-sky-200" variant="outline">
          <Loader2 className="h-3 w-3 animate-spin" />
          {status === "pending" ? "Pending" : "Running"}
        </Badge>
      )
    }
    if (status === "succeeded") {
      return (
        <Badge className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">
          <CheckCircle2 className="h-3 w-3" />
          Succeeded
        </Badge>
      )
    }
    if (status === "partial") {
      return (
        <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200" variant="outline">
          <AlertTriangle className="h-3 w-3" />
          Partial
        </Badge>
      )
    }
    if (status === "failed") {
      return (
        <Badge className="gap-1 bg-rose-50 text-rose-700 border-rose-200" variant="outline">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    }
    if (status === "cancelled") {
      return (
        <Badge className="gap-1" variant="outline">
          Cancelled
        </Badge>
      )
    }
    return null
  }, [job])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Job ID</div>
            <div className="font-mono text-sm break-all">{jobId}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {headerStatus}
            {job && (
              <>
                <Badge variant="outline" className="text-[11px]">
                  {job.counts.total} files
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  {job.counts.extracted} extracted
                </Badge>
                {job.counts.review_required > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-amber-50 text-amber-700 border-amber-200"
                  >
                    {job.counts.review_required} review
                  </Badge>
                )}
                {job.counts.failed > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-rose-50 text-rose-700 border-rose-200"
                  >
                    {job.counts.failed} failed
                  </Badge>
                )}
              </>
            )}
            {terminal && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadResult}
                disabled={downloading}
                data-testid="unstructured-download-result"
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                Download result
              </Button>
            )}
          </div>
        </div>
        {job?.error_message && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{job.error_message}</AlertDescription>
          </Alert>
        )}
        {jobError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{jobError}</AlertDescription>
          </Alert>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Log pane */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-sm font-medium">Live agent log</div>
            <div className="flex items-center gap-2">
              {sse.state === "open" && (
                <Badge className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Streaming
                </Badge>
              )}
              {sse.state === "reconnecting" && (
                <Badge className="gap-1 bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Retry {sse.retryCount}/10
                </Badge>
              )}
              {sse.state === "lost" && (
                <Badge className="gap-1 bg-rose-50 text-rose-700 border-rose-200" variant="outline">
                  <XCircle className="h-3 w-3" />
                  Lost
                </Badge>
              )}
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={autoScroll}
                  onCheckedChange={(c) => setAutoScroll(Boolean(c))}
                />
                Auto-scroll
              </label>
            </div>
          </div>
          {sse.state === "lost" && (
            <Alert variant="destructive" className="m-3">
              <AlertDescription>
                Connection lost after 10 retries. Refresh the page to resume the log stream.
              </AlertDescription>
            </Alert>
          )}
          <div
            ref={logScrollRef}
            data-testid="unstructured-log-pane"
            className="h-[420px] overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed bg-muted/20"
          >
            {sse.events.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                Waiting for the first event…
              </div>
            ) : (
              sse.events.map((ev, i) => (
                <div key={i} className={cn("py-0.5", logColor(ev))}>
                  <span className="text-muted-foreground/70 mr-2">
                    {fmtTime(ev.ts)}
                  </span>
                  {ev.message}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Results table */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-sm font-medium">
              Results <span className="text-muted-foreground">({files.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {resultUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  asChild
                >
                  <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                    Export
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="h-[420px] overflow-y-auto">
            {files.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {job?.status === "pending" || job?.status === "running"
                  ? "Files will appear as they are discovered…"
                  : "No files yet."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[80px] text-right">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => (
                    <TableRow key={f.file_id} data-testid="unstructured-file-row">
                      <TableCell className="font-mono text-[11px] truncate max-w-[260px]">
                        {f.file_name}
                      </TableCell>
                      <TableCell>{fileStatusBadge(f.status)}</TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {typeof f.confidence === "number"
                          ? `${(f.confidence * 100).toFixed(0)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default JobRunView
