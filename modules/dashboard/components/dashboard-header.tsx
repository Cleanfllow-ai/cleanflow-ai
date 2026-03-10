"use client"

import { Download, LogOut, RefreshCw, Loader2 } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/modules/auth"
import { fileManagementAPI } from "@/modules/files"
import { useToast } from "@/shared/hooks/use-toast"

interface DashboardHeaderProps {
  onRefresh?: () => Promise<void>
}

export function DashboardHeader({ onRefresh }: DashboardHeaderProps) {
  const { user, logout, isAuthenticated, idToken } = useAuth()
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

  const handleLogout = () => {
    logout()
    window.location.href = '/auth/login'
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

  return (
    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {isAuthenticated && user ? `Welcome back, ${user.name || user.email}` : 'Real-time insights into your ERP data transformation pipeline'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
        {/* <Badge variant="outline">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          Live Data
        </Badge> */}

        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>

        <Button variant="outline" size="sm" onClick={handleExportDashboard} disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export
        </Button>

        {/* {isAuthenticated && (
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        )} */}
      </div>
    </div>
  )
}
