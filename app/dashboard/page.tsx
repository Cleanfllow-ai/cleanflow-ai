"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { AlertCircle } from "lucide-react"
import { MainLayout } from "@/shared/layout/main-layout"
import { DashboardHeader, ActivityFeed, TopIssuesChart, DqCharts, ProcessingSummary } from "@/modules/dashboard"
import { DashboardKpiCards } from "@/modules/dashboard/components/dashboard-kpi-cards"

import { ActionRequiredPanel } from "@/modules/dashboard/components/action-required-panel"
import { DashboardZeroState } from "@/modules/dashboard/components/dashboard-zero-state"
import { AuthGuard, useAuth } from "@/modules/auth"
import { fileManagementAPI, type FileStatusResponse, type OverallDqReportResponse, type TopIssue } from "@/modules/files"

const isBenignAuthError = (msg: string): boolean => {
  const m = msg.toLowerCase()
  return (
    m.includes("permission denied") ||
    m.includes("organization membership required") ||
    m.includes("forbidden")
  )
}

const toNumericCount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/**
 * IssueAccumulator preserves the BE-supplied `short_label` and `description`
 * alongside the rolling count. Without this, the FE would discard the
 * business-friendly chip + tooltip text and the dashboard would fall back to
 * raw rule codes (R36, R19, …) — see top-issues-chart.tsx line 44-45 which
 * only renders short_label when present.
 */
type IssueAccumulator = { count: number; short_label?: string; description?: string }

const normalizeTopIssues = (raw: unknown): TopIssue[] => {
  if (!Array.isArray(raw)) return []
  const merged = new Map<string, IssueAccumulator>()
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const issue = item as Record<string, unknown>
    const violation =
      (typeof issue.violation === "string" && issue.violation) ||
      (typeof issue.issue === "string" && issue.issue) ||
      (typeof issue.rule === "string" && issue.rule) ||
      (typeof issue.name === "string" && issue.name) ||
      ""
    const count = toNumericCount(issue.count ?? issue.total ?? issue.occurrences ?? issue.value)
    if (!violation || count <= 0) continue
    const shortLabel = typeof issue.short_label === "string" ? issue.short_label : undefined
    const description = typeof issue.description === "string" ? issue.description : undefined
    const prev = merged.get(violation)
    merged.set(violation, {
      count: (prev?.count || 0) + count,
      // First-wins: BE labels are deterministic per rule_id; we only keep
      // the first non-empty value rather than risk overwriting with "".
      short_label: prev?.short_label || shortLabel,
      description: prev?.description || description,
    })
  }
  return Array.from(merged.entries())
    .map(([violation, acc]) => ({
      violation,
      count: acc.count,
      short_label: acc.short_label,
      description: acc.description,
    }))
    .sort((a, b) => b.count - a.count)
}

const normalizeViolationCounts = (raw: unknown): TopIssue[] => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>)
    .map(([violation, count]) => ({ violation, count: toNumericCount(count) }))
    .filter((issue) => issue.count > 0)
    .sort((a, b) => b.count - a.count)
}

const mergeIssues = (bucket: Map<string, IssueAccumulator>, issues: TopIssue[]) => {
  for (const issue of issues) {
    if (!issue.violation || issue.count <= 0) continue
    const prev = bucket.get(issue.violation)
    bucket.set(issue.violation, {
      count: (prev?.count || 0) + issue.count,
      short_label: prev?.short_label || issue.short_label,
      description: prev?.description || issue.description,
    })
  }
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileStatusResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOverallLoading, setIsOverallLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [topIssues, setTopIssues] = useState<TopIssue[]>([])
  const [filesError, setFilesError] = useState<string | null>(null)
  const [overallError, setOverallError] = useState<string | null>(null)
  const { idToken } = useAuth()

  // ── Race protection: only the latest fetch wins ─────────────────────────
  // Each call increments a generation counter; stale responses are dropped.
  const filesGenRef = useRef(0)
  const overallGenRef = useRef(0)

  const loadFiles = useCallback(async () => {
    if (!idToken) return
    const gen = ++filesGenRef.current
    try {
      const response = await fileManagementAPI.getUploads(idToken)
      if (gen !== filesGenRef.current) return // stale; a newer request superseded us
      const items = response.items || []
      setFiles(items)
      setFilesError(null)
    } catch (error: any) {
      if (gen !== filesGenRef.current) return
      const message = error?.message || ""
      // Benign auth/membership errors: treat as empty data, no banner.
      if (isBenignAuthError(message)) {
        setFiles([])
        setFilesError(null)
        return
      }
      // Real failure: keep prior data (if any) but surface a banner so the
      // user knows the numbers are stale rather than "no data".
      console.warn("Failed to load files for dashboard analytics:", message)
      setFilesError(message || "Unable to load files")
    }
  }, [idToken])

  const loadOverall = useCallback(async () => {
    if (!idToken) return
    const gen = ++overallGenRef.current
    setIsOverallLoading(true)
    try {
      const overall: OverallDqReportResponse = await fileManagementAPI.downloadOverallDqReport(idToken)
      if (gen !== overallGenRef.current) return
      if (!overall) {
        setTopIssues([])
        setOverallError(null)
        return
      }
      const merged = new Map<string, IssueAccumulator>()
      const months = Object.values(overall?.months || {})
      mergeIssues(merged, normalizeTopIssues((overall as any).top_issues))
      mergeIssues(merged, normalizeTopIssues((overall as any).top_violations))
      mergeIssues(merged, normalizeViolationCounts((overall as any).violation_counts))
      for (const stats of months) {
        mergeIssues(merged, normalizeTopIssues((stats as any)?.top_issues))
        mergeIssues(merged, normalizeTopIssues((stats as any)?.top_violations))
        mergeIssues(merged, normalizeViolationCounts((stats as any)?.violation_counts))
      }
      setTopIssues(
        Array.from(merged.entries())
          .map(([violation, acc]) => ({
            violation,
            count: acc.count,
            short_label: acc.short_label,
            description: acc.description,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      )
      setOverallError(null)
    } catch (error: any) {
      if (gen !== overallGenRef.current) return
      const message = error?.message || ""
      if (isBenignAuthError(message)) {
        setTopIssues([])
        setOverallError(null)
      } else {
        console.warn("Failed to load overall DQ report:", message)
        // Per task requirement: other widgets must still render. We surface
        // a per-widget error via the isLoading=false + empty topIssues path
        // plus an `overallError` state passed to TopIssuesChart.
        setTopIssues([])
        setOverallError(message || "Unable to load DQ report")
      }
    } finally {
      if (gen === overallGenRef.current) setIsOverallLoading(false)
    }
  }, [idToken])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      // Run BOTH endpoints in parallel but isolated — neither crashes the
      // other (no Promise.all). Each writes its own error/state slot.
      await Promise.allSettled([loadFiles(), loadOverall()])
      setIsLoading(false)
    }
    void loadData()
  }, [loadFiles, loadOverall])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    await Promise.allSettled([loadFiles(), loadOverall()])
    setIsLoading(false)
    setRefreshKey(prev => prev + 1)
  }, [loadFiles, loadOverall])

  return (
    <AuthGuard>
      <MainLayout>
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-5">
            <DashboardHeader onRefresh={handleRefresh} />

            {/* Files-load failure banner — distinguishes "failed to fetch"
                from "you have no files yet". Other widgets still render. */}
            {filesError && (
              <div
                data-testid="dashboard-files-error"
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Couldn’t refresh file data — showing last known values. Use Refresh to retry.
                </span>
              </div>
            )}

            {/* W5A-3 — Hero CTA when both jobs count = 0 AND uploads count = 0.
                The dashboard doesn't fetch jobs separately, so we treat
                "no uploads + no top-issues + no filesError" as the fresh-state
                signal. Personas Jagan + Marcus flagged the blank-dashboard
                first-run experience.  If even one upload exists, we fall
                through to the normal charts grid. */}
            {files.length === 0 && !filesError ? (
              <DashboardZeroState />
            ) : (
              <>
                <DashboardKpiCards files={files} />

                {/* ─── UX Improvement: Action Required panel ──────────────────────── */}
                <ActionRequiredPanel files={files} />

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                  <div className="xl:col-span-3 space-y-5">
                    <DqCharts files={files} key={`dq-charts-${refreshKey}`} />
                  </div>

                  <div className="xl:col-span-1 space-y-4">
                    <ActivityFeed files={files} />
                    <TopIssuesChart
                      issues={topIssues}
                      isLoading={isOverallLoading}
                      errorMessage={overallError}
                    />
                    <ProcessingSummary files={files} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </MainLayout>
    </AuthGuard>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 w-72 rounded-md bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-3 space-y-5">
          <div className="h-80 rounded-xl border border-border bg-card" />
        </div>
        <div className="xl:col-span-1 space-y-4">
          <div className="h-56 rounded-xl border border-border bg-card" />
          <div className="h-56 rounded-xl border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}
