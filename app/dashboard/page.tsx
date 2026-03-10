"use client"

import { useEffect, useState, useCallback } from "react"
import { MainLayout } from "@/shared/layout/main-layout"
import { DashboardHeader, ActivityFeed, TopIssuesChart, DqCharts, ProcessingSummary } from "@/modules/dashboard"
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
    const count = toNumericCount(
      issue.count ?? issue.total ?? issue.occurrences ?? issue.value,
    )
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
    .map(([violation, count]) => ({
      violation,
      count: toNumericCount(count),
    }))
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
  const [refreshKey, setRefreshKey] = useState(0)
  const [topIssues, setTopIssues] = useState<TopIssue[]>([])
  const { idToken } = useAuth()

  // Load files for analytics
  const loadFiles = useCallback(async () => {
    if (!idToken) return

    try {
      const response = await fileManagementAPI.getUploads(idToken)
      setFiles(response.items || [])
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
    try {
      const overall: OverallDqReportResponse = await fileManagementAPI.downloadOverallDqReport(idToken)
      if (!overall) {
        setTopIssues([])
        return
      }

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

      setTopIssues(
        Array.from(merged.entries())
          .map(([violation, count]) => ({ violation, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      )
    } catch (error: any) {
      const message = (error?.message || "").toLowerCase()
      if (!message.includes("permission denied") && !message.includes("organization membership required")) {
        console.warn("Failed to load overall DQ report.")
      }
      setTopIssues([])
    }
  }, [idToken])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([loadFiles(), loadOverall()])
      setIsLoading(false)
    }
    loadData()
  }, [loadFiles, loadOverall])

  // Refresh all dashboard data
  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([loadFiles(), loadOverall()])
    setIsLoading(false)
    // Increment refresh key to force re-render of components that fetch their own data
    setRefreshKey(prev => prev + 1)
  }, [loadFiles, loadOverall])

  return (
    <AuthGuard>
      <MainLayout>
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <DashboardHeader onRefresh={handleRefresh} />

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3 space-y-6">
                <DqCharts files={files} key={`dq-charts-${refreshKey}`} />
              </div>

              <div className="xl:col-span-1 space-y-4">
                <ActivityFeed files={files} />
                <TopIssuesChart issues={topIssues} />
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
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-72 rounded-md bg-muted/70" />
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="h-96 rounded-xl border bg-card" />
          <div className="h-80 rounded-xl border bg-card" />
        </div>
        <div className="xl:col-span-1 space-y-4">
          <div className="h-56 rounded-xl border bg-card" />
          <div className="h-56 rounded-xl border bg-card" />
          <div className="h-56 rounded-xl border bg-card" />
        </div>
      </div>
    </div>
  )
}
