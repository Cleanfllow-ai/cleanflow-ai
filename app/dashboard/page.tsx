"use client"

import { useEffect, useState, useCallback } from "react"
import { MainLayout } from "@/shared/layout/main-layout"
import { DashboardHeader, ActivityFeed, TopIssuesChart, DqCharts, ProcessingSummary } from "@/modules/dashboard"
import { DashboardKpiCards } from "@/modules/dashboard/components/dashboard-kpi-cards"

import { ActionRequiredPanel } from "@/modules/dashboard/components/action-required-panel"
import { AuthGuard, useAuth } from "@/modules/auth"
import { fileManagementAPI, type FileStatusResponse, type OverallDqReportResponse, type TopIssue } from "@/modules/files"

const toNumericCount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const normalizeTopIssues = (raw: unknown): TopIssue[] => {
  if (!Array.isArray(raw)) return []
  const merged = new Map<string, number>()
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
    merged.set(violation, (merged.get(violation) || 0) + count)
  }
  return Array.from(merged.entries())
    .map(([violation, count]) => ({ violation, count }))
    .sort((a, b) => b.count - a.count)
}

const normalizeViolationCounts = (raw: unknown): TopIssue[] => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
  return Object.entries(raw as Record<string, unknown>)
    .map(([violation, count]) => ({ violation, count: toNumericCount(count) }))
    .filter((issue) => issue.count > 0)
    .sort((a, b) => b.count - a.count)
}

const mergeIssues = (bucket: Map<string, number>, issues: TopIssue[]) => {
  for (const issue of issues) {
    if (!issue.violation || issue.count <= 0) continue
    bucket.set(issue.violation, (bucket.get(issue.violation) || 0) + issue.count)
  }
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileStatusResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOverallLoading, setIsOverallLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [topIssues, setTopIssues] = useState<TopIssue[]>([])
  const { idToken } = useAuth()

  const loadFiles = useCallback(async () => {
    if (!idToken) return
    try {
      const response = await fileManagementAPI.getUploads(idToken)
      const items = response.items || []
      setFiles(items)
      const seed = new Map<string, number>()
      for (const f of items) {
        for (const issue of (f.dq_issues || [])) {
          if (issue) seed.set(issue, (seed.get(issue) || 0) + 1)
        }
      }
      if (seed.size > 0) {
        setTopIssues(
          Array.from(seed.entries())
            .map(([violation, count]) => ({ violation, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        )
      }
    } catch (error: any) {
      const message = (error?.message || "").toLowerCase()
      if (!message.includes("permission denied") && !message.includes("organization membership required")) {
        console.warn("Failed to load files for dashboard analytics.")
      }
      setFiles([])
    }
  }, [idToken])

  const loadOverall = useCallback(async () => {
    if (!idToken) return
    setIsOverallLoading(true)
    try {
      const overall: OverallDqReportResponse = await fileManagementAPI.downloadOverallDqReport(idToken)
      if (!overall) return
      const merged = new Map<string, number>()
      const months = Object.values(overall?.months || {})
      mergeIssues(merged, normalizeTopIssues((overall as any).top_issues))
      mergeIssues(merged, normalizeTopIssues((overall as any).top_violations))
      mergeIssues(merged, normalizeViolationCounts((overall as any).violation_counts))
      for (const stats of months) {
        mergeIssues(merged, normalizeTopIssues((stats as any)?.top_issues))
        mergeIssues(merged, normalizeTopIssues((stats as any)?.top_violations))
        mergeIssues(merged, normalizeViolationCounts((stats as any)?.violation_counts))
      }
      if (merged.size > 0) {
        setTopIssues(
          Array.from(merged.entries())
            .map(([violation, count]) => ({ violation, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        )
      }
    } catch (error: any) {
      const message = (error?.message || "").toLowerCase()
      if (!message.includes("permission denied") && !message.includes("organization membership required")) {
        console.warn("Failed to load overall DQ report.")
      }
    } finally {
      setIsOverallLoading(false)
    }
  }, [idToken])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await loadFiles()
      setIsLoading(false)
      loadOverall()
    }
    loadData()
  }, [loadFiles, loadOverall])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    await loadFiles()
    setIsLoading(false)
    setRefreshKey(prev => prev + 1)
    loadOverall()
  }, [loadFiles, loadOverall])

  return (
    <AuthGuard>
      <MainLayout>
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-5">
            <DashboardHeader onRefresh={handleRefresh} />

            <DashboardKpiCards files={files} />

            {/* ─── UX Improvement: Action Required panel ──────────────────────── */}
            <ActionRequiredPanel files={files} />

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
              <div className="xl:col-span-3 space-y-5">
                <DqCharts files={files} key={`dq-charts-${refreshKey}`} />
              </div>

              <div className="xl:col-span-1 space-y-4">
                <ActivityFeed files={files} />
                <TopIssuesChart issues={topIssues} isLoading={isOverallLoading} />
                <ProcessingSummary files={files} />
              </div>
            </div>
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
