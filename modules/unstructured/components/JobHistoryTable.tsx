"use client"

/**
 * JobHistoryTable — past unstructured-import jobs for the current org.
 *
 * Pagination is page-token based (matches BE contract). Click a row to drill
 * into the live JobRunView; the SSE stream stays closed for terminal jobs.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import {
  UNSTRUCTURED_SCHEMAS,
  type UnstructuredJob,
  type UnstructuredJobStatus,
} from "../types/unstructured.types"

function schemaLabel(id: string): string {
  return UNSTRUCTURED_SCHEMAS.find((s) => s.id === id)?.label || id
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function fmtCost(usd?: number | null): string {
  if (typeof usd !== "number" || !Number.isFinite(usd)) return "—"
  if (usd < 0.01) return "<$0.01"
  return `$${usd.toFixed(2)}`
}

function statusBadge(status: UnstructuredJobStatus) {
  const map: Record<
    UnstructuredJobStatus,
    { label: string; cls: string; Icon: typeof CheckCircle2 }
  > = {
    pending: { label: "Pending", cls: "bg-muted/40 text-muted-foreground border-muted", Icon: Clock },
    running: { label: "Running", cls: "bg-sky-50 text-sky-700 border-sky-200", Icon: Loader2 },
    succeeded: { label: "Succeeded", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    partial: { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: AlertTriangle },
    failed: { label: "Failed", cls: "bg-rose-50 text-rose-700 border-rose-200", Icon: XCircle },
    cancelled: { label: "Cancelled", cls: "bg-muted/40 text-muted-foreground border-muted", Icon: XCircle },
  }
  const entry = map[status] || map.pending
  const Icon = entry.Icon
  return (
    <Badge variant="outline" className={cn("gap-1", entry.cls)}>
      <Icon className={cn("h-3 w-3", status === "running" ? "animate-spin" : "")} />
      {entry.label}
    </Badge>
  )
}

export function JobHistoryTable() {
  const [jobs, setJobs] = useState<UnstructuredJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextToken, setNextToken] = useState<string | null>(null)

  const load = async (token?: string, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await unstructuredApi.listJobs(token, 50)
      setJobs((prev) => (append ? [...prev, ...(resp.jobs || [])] : resp.jobs || []))
      setNextToken(resp.next_page_token || null)
    } catch (err) {
      setError((err as Error)?.message || "Failed to load jobs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!loading && jobs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-sm font-medium">No unstructured jobs yet.</div>
        <p className="text-xs text-muted-foreground mt-1">
          Click &quot;Run Import&quot; on the Unstructured tab to get started.
        </p>
        <div className="mt-4">
          <Link href="/admin/unified-bridge?tab=unstructured">
            <Button size="sm" variant="outline">
              Open Unstructured tab
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-medium">Recent jobs</div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => load()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Schema</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Files</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Started</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow
              key={j.job_id}
              data-testid="unstructured-job-row"
              className="cursor-pointer"
            >
              <TableCell>{statusBadge(j.status)}</TableCell>
              <TableCell className="text-xs">{schemaLabel(j.schema_id)}</TableCell>
              <TableCell className="text-xs">
                {j.source_connector === "google_drive" ? "Google Drive" : "Local"}
              </TableCell>
              <TableCell className="text-right text-xs">
                {j.counts.extracted}
                <span className="text-muted-foreground">/{j.counts.total}</span>
              </TableCell>
              <TableCell className="text-right text-xs">{fmtCost(j.cost_usd)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {fmtDateTime(j.started_at)}
              </TableCell>
              <TableCell>
                <Link
                  href={`/admin/unified-bridge/unstructured/jobs/${encodeURIComponent(
                    j.job_id,
                  )}`}
                >
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {nextToken && (
        <div className="border-t border-border p-3 text-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => load(nextToken, true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Load more
          </Button>
        </div>
      )}
    </Card>
  )
}

export default JobHistoryTable
