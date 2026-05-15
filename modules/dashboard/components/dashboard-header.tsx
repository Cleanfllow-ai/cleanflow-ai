"use client"

import { Download, Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/modules/auth"
import { fileManagementAPI } from "@/modules/files"
import { useToast } from "@/shared/hooks/use-toast"

interface DashboardHeaderProps {
  onRefresh?: () => Promise<void>
}

export function DashboardHeader({ onRefresh }: DashboardHeaderProps) {
  const { user, isAuthenticated, idToken } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { toast } = useToast()

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
      toast({
        title: "Export failed",
        description: error.message || "Failed to export dashboard data",
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
        <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1.5">
          {isAuthenticated && user ? `Welcome back, ${user.name?.split(" ")[0] || "there"}` : "Dashboard"}
        </h1>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
          {today}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 px-3 border border-[#69C04B]/30 text-white hover:text-white hover:bg-[#69C04B]/20 transition-colors"
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
          className="h-8 px-3 border border-[#69C04B]/30 text-white hover:text-white hover:bg-[#69C04B]/20 transition-colors"
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
