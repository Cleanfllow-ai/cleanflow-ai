"use client"

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type FileStatusResponse } from '@/modules/files'
import { AlertTriangle, FileText, Gauge, Target, TrendingUp } from 'lucide-react'

interface AnalyticsSectionProps {
  files: FileStatusResponse[]
}

export function AnalyticsSection({ files }: AnalyticsSectionProps) {
  // Exclude versioned files (those with parent_upload_id)
  const visibleFiles = files.filter(f => !f.parent_upload_id)
  const completedFiles = visibleFiles.filter(f => f.status === 'DQ_FIXED')
  const processingFiles = visibleFiles.filter(f => ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status))
  const failedFiles = visibleFiles.filter(f => ['DQ_FAILED', 'UPLOAD_FAILED'].includes(f.status))

  const avgDqScore = completedFiles.length > 0
    ? completedFiles.reduce((sum, f) => sum + (f.dq_score || 0), 0) / completedFiles.length
    : 0
  const totalRowsIn = completedFiles.reduce((sum, f) => sum + (f.rows_in || 0), 0)
  const totalQuarantined = completedFiles.reduce((sum, f) => sum + (f.rows_quarantined || 0), 0)
  const totalRowsProcessed = totalRowsIn - totalQuarantined

  // Collect all DQ issues from completed files
  const allIssues = completedFiles.flatMap(f => f.dq_issues || [])
  const issueCount: Record<string, number> = {}
  allIssues.forEach(issue => {
    issueCount[issue] = (issueCount[issue] || 0) + 1
  })

  const topIssues = Object.entries(issueCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => ({
      issue: issue.replace(/_/g, ' '),
      count,
      severity: issue.includes('duplicate_primary_key') || issue.includes('invalid_calendar_date') ? 'Fatal' :
                issue.includes('missing_required') || issue.includes('schema_drift') ? 'High' : 'Medium'
    }))

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Files',
            value: visibleFiles.length.toString(),
            change: visibleFiles.length > 0 ? '+100%' : '0%',
            icon: FileText,
            color: 'text-blue-600'
          },
          {
            title: 'Avg DQ',
            value: `${avgDqScore.toFixed(1)}%`,
            change: avgDqScore > 90 ? '+5%' : avgDqScore > 70 ? '+2%' : '0%',
            icon: Gauge,
            color: 'text-emerald-600',
            valueColor: avgDqScore >= 90 ? 'text-emerald-600' : avgDqScore >= 70 ? 'text-amber-600' : 'text-red-600'
          },
          {
            title: 'Rows Processed',
            value: totalRowsProcessed.toLocaleString(),
            change: totalRowsProcessed > 0 ? '+100%' : '0%',
            icon: TrendingUp,
            color: 'text-violet-600'
          },
          {
            title: 'Success Rate',
            value: visibleFiles.length > 0 ? `${Math.round((completedFiles.length / visibleFiles.length) * 100)}%` : '0%',
            change: completedFiles.length > 0 ? '+100%' : '0%',
            icon: Target,
            color: 'text-orange-600'
          }
        ].map((stat) => (
          <div key={stat.title} className="h-full">
            <Card className="h-full border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center space-x-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <span>{stat.title}</span>
                </CardTitle>
                {/* <Badge
                  variant="default"
                  className="text-[10px] font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30"
                >
                  {stat.change}
                </Badge> */}
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold mb-1 ${(stat as any).valueColor || ''}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground">vs last period</p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* DQ Issues Analysis */}
      <Card className="border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="mb-4 flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5 text-[#69C04B]" />
            Data Quality Issues Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topIssues.length > 0 ? topIssues.map((issue) => (
              <div key={issue.issue} className="flex items-center justify-between p-3 bg-[#0f2d23]/50 rounded-lg border border-[#69C04B]/20">
                <div>
                  <span className="font-medium text-white">{issue.issue}</span>
                  <Badge variant="secondary" className={
                    issue.severity === 'Fatal' ? "bg-red-500/20 text-red-300 ml-2" :
                    issue.severity === 'High' ? "bg-orange-500/20 text-orange-300 ml-2" :
                    "bg-yellow-500/20 text-yellow-300 ml-2"
                  }>
                    {issue.severity}
                  </Badge>
                </div>
                <span className="text-white/70">{issue.count} occurrences</span>
              </div>
            )) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-white/40 mx-auto mb-4" />
                <h4 className="text-lg font-medium mb-2 text-white">No Issues Found</h4>
                <p className="text-white/60">Upload and process files to see data quality analysis</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Summary */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">File Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-white">
                  <span className="text-[#69C04B]">Completed</span>
                  <span>{completedFiles.length}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-yellow-400">Processing</span>
                  <span>{processingFiles.length}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-red-400">Failed</span>
                  <span>{failedFiles.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Data Quality Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-white">
                  <span className="text-white/70">Total Input Rows</span>
                  <span>{files.reduce((sum, f) => sum + (f.rows_in || 0), 0)}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-[#69C04B]">Validated Output Rows</span>
                  <span>{totalRowsProcessed}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-yellow-400">Records Quarantined</span>
                  <span>{totalQuarantined}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-white">
                  <span className="text-white/70">Avg Processing Time</span>
                  <span>N/A</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-white/70">Total Files Processed</span>
                  <span>{completedFiles.length}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span className="text-white/70">Success Rate</span>
                  <span>
                    {files.length > 0 ? `${Math.round((completedFiles.length / files.length) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
