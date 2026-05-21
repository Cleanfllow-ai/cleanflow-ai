"use client"

import { Download, RefreshCw, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/modules/auth"
import { fileManagementAPI } from "@/modules/files"
import { useToast } from "@/shared/hooks/use-toast"
import { formatWelcomeName } from "./welcome-name"

interface DashboardHeaderProps {
  onRefresh?: () => Promise<void>
  /**
   * Wall-clock epoch (ms) of the last successful data load. When provided,
   * the header renders a "Updated Ns ago" pill next to Refresh that ticks
   * every 30s and resets when the user clicks Refresh. Omit on surfaces
   * that don't track freshness — the pill simply disappears.
   */
  lastRefreshedAt?: number | null
}

/**
 * Build a short "Updated Xs ago" string using the native Intl.RelativeTimeFormat
 * (no new deps). Caps at "MMM DD" once we cross the 7-day boundary so the
 * pill never balloons. Returns null if `at` is missing/invalid.
 */
function formatRelative(at: number | null | undefined, now: number): string | null {
  if (!at || !Number.isFinite(at)) return null
  const deltaSec = Math.max(0, Math.round((now - at) / 1000))
  if (deltaSec < 5) return "Updated just now"
  // Native API — supported in every browser we ship to (no polyfill needed).
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" })
  if (deltaSec < 60) return `Updated ${rtf.format(-deltaSec, "second")}`
  const min = Math.round(deltaSec / 60)
  if (min < 60) return `Updated ${rtf.format(-min, "minute")}`
  const hr = Math.round(min / 60)
  if (hr < 24) return `Updated ${rtf.format(-hr, "hour")}`
  const day = Math.round(hr / 24)
  if (day < 7) return `Updated ${rtf.format(-day, "day")}`
  const d = new Date(at)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `Updated ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`
}

export function DashboardHeader({ onRefresh, lastRefreshedAt }: DashboardHeaderProps) {
  const { user, isAuthenticated, idToken } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { toast } = useToast()

  // Tick every 30s so "Updated 14s ago" rolls forward without the user
  // having to click Refresh. We re-render rather than recompute on render
  // because relative-time depends on wall-clock, not props/state.
  const [tickNow, setTickNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (!lastRefreshedAt) return
    const id = window.setInterval(() => setTickNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [lastRefreshedAt])
  // Force-tick on prop change so the pill flips to "just now" the moment
  // a manual Refresh resolves rather than waiting up to 30s.
  useEffect(() => {
    if (lastRefreshedAt) setTickNow(Date.now())
  }, [lastRefreshedAt])

  const relativeLabel = formatRelative(lastRefreshedAt, tickNow)

  const handleRefresh = async () => {
    if (!onRefresh) return

    setRefreshing(true)
    try {
      await onRefresh()
      toast({
        title: "Refreshed",
        description: "Dashboard data updated successfully",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh dashboard data",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportDashboard = async () => {
    if (!idToken) {
      toast({
        title: "Not authenticated",
        description: "Please log in to export dashboard data",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      const report = await fileManagementAPI.downloadOverallDqReport(idToken)

      // The API returns null on 404 (no processed files yet) and on benign
      // 401/403 paths. Don't download a literal "null" JSON in that case —
      // tell the user there's nothing to export.
      if (!report) {
        toast({
          title: "Nothing to export",
          description: "No DQ report is available yet. Process a file first.",
        })
        return
      }

      // Create blob and download
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dashboard_dq_report_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Exported",
        description: "Dashboard data exported successfully",
      })
    } catch (error: any) {
      console.error("Dashboard export error:", error)
      toast({
        title: "Export failed",
        description: "Could not export dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="flex flex-col space-y-4 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
      <div>
        <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-1.5">
          {isAuthenticated && user
            ? `Welcome back, ${formatWelcomeName(user.email, user.name)}`
            : "Dashboard"}
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {today}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {relativeLabel && (
          <span
            data-testid="dashboard-last-refreshed-pill"
            className="hidden sm:inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
            title="Time since the dashboard last loaded fresh data"
            aria-live="polite"
          >
            {relativeLabel}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 px-3 border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          {refreshing ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          <span className="text-xs">Refresh</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportDashboard}
          disabled={exporting}
          className="h-8 px-3 border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5" />
          )}
          <span className="text-xs">Download Report</span>
        </Button>
      </div>
    </div>
  )
}
