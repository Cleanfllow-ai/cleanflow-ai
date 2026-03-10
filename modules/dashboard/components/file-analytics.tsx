"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, CheckCircle, Activity, TrendingUp, AlertCircle } from 'lucide-react'
import { useAuth } from '@/modules/auth'
import { fileManagementAPI, type FileStatusResponse } from '@/modules/files'
import { calculateFileAnalytics } from '@/shared/lib/utils/file-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export function FileAnalytics() {
  const [files, setFiles] = useState<FileStatusResponse[]>([])
  const [loading, setLoading] = useState(true)
  const { idToken } = useAuth()

  useEffect(() => {
    const loadFiles = async () => {
      if (!idToken) return
      
      try {
        const response = await fileManagementAPI.getUploads(idToken)
        setFiles(response.items || [])
      } catch (error: any) {
        const message = (error?.message || "").toLowerCase()
        if (!message.includes("permission denied") && !message.includes("forbidden")) {
          console.warn("Failed to load files for analytics.")
        }
        setFiles([])
      } finally {
        setLoading(false)
      }
    }

    loadFiles()

    // Refresh every 30 seconds
    const interval = setInterval(loadFiles, 30000)
    return () => clearInterval(interval)
  }, [idToken])

  const analytics = calculateFileAnalytics(files)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>File Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          File Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Files */}
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Files</p>
              <p className="text-2xl font-bold">{analytics.totalFiles}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-card">
            All Time
          </Badge>
        </div>

        {/* Completed Files */}
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                {analytics.completedFiles}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-sm font-medium">
              {analytics.totalFiles > 0 
                ? Math.round((analytics.completedFiles / analytics.totalFiles) * 100)
                : 0}%
            </p>
          </div>
        </div>

        {/* Processing Files */}
        <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Processing</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                {analytics.processingFiles}
              </p>
            </div>
          </div>
          {analytics.processingFiles > 0 && (
            <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 animate-pulse">
              Active
            </Badge>
          )}
        </div>

        {/* Data Quality Score */}
        <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Avg DQ Score</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                {analytics.avgDqScore}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Quality</p>
            <p className="text-sm font-medium">
              {analytics.avgDqScore >= 90 ? 'Excellent' :
               analytics.avgDqScore >= 70 ? 'Good' :
               analytics.avgDqScore >= 50 ? 'Fair' : 'Poor'}
            </p>
          </div>
        </div>

        {/* Failed Files */}
        {analytics.failedFiles > 0 && (
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                  {analytics.failedFiles}
                </p>
              </div>
            </div>
            <Badge variant="destructive">
              Needs Attention
            </Badge>
          </div>
        )}

        {/* Total Rows Processed */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Rows Processed</p>
              <p className="text-xl font-bold">
                {analytics.totalRowsProcessed.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Quarantined</p>
              <p className="text-xl font-bold text-orange-600">
                {analytics.totalQuarantined.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
