"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, Download, FileText, Upload, XCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

import { ScrollArea } from "@/components/ui/scroll-area"
import { FileStatusResponse } from "@/modules/files"

interface ActivityFeedProps {
  files: FileStatusResponse[]
}

export function ActivityFeed({ files }: ActivityFeedProps) {
  const router = useRouter()

  const getActivityIcon = (status: string) => {
    switch (status) {
      case "DQ_FIXED":
      case "EXPORTED":
        return CheckCircle
      case "DQ_FAILED":
      case "UPLOAD_FAILED":
        return XCircle
      case "DQ_RUNNING":
      case "NORMALIZING":
      case "QUEUED":
        return Clock
      case "UPLOADING":
        return Upload
      default:
        return FileText
    }
  }

  const getActivityLabel = (status: string) => {
    switch (status) {
      case "DQ_FIXED":
        return "Processed"
      case "EXPORTED":
        return "Exported"
      case "DQ_FAILED":
        return "Failed"
      case "UPLOAD_FAILED":
        return "Upload Failed"
      case "DQ_RUNNING":
        return "Processing"
      case "NORMALIZING":
        return "Normalizing"
      case "QUEUED":
        return "Queued"
      case "UPLOADING":
        return "Uploading"
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DQ_FIXED":
      case "EXPORTED":
        return "text-emerald-400"
      case "DQ_FAILED":
      case "UPLOAD_FAILED":
        return "text-rose-400"
      case "DQ_RUNNING":
      case "NORMALIZING":
      case "QUEUED":
      case "UPLOADING":
        return "text-amber-400"
      default:
        return "text-muted-foreground"
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case "DQ_FIXED":
      case "EXPORTED":
        return "bg-emerald-500/10"
      case "DQ_FAILED":
      case "UPLOAD_FAILED":
        return "bg-rose-500/10"
      case "DQ_RUNNING":
      case "NORMALIZING":
      case "QUEUED":
      case "UPLOADING":
        return "bg-amber-500/10"
      default:
        return "bg-muted"
    }
  }

  const getStatusLabelColor = (status: string) => {
    switch (status) {
      case "DQ_FIXED":
      case "EXPORTED":
        return "text-emerald-400"
      case "DQ_FAILED":
      case "UPLOAD_FAILED":
        return "text-rose-400"
      case "DQ_RUNNING":
      case "NORMALIZING":
      case "QUEUED":
      case "UPLOADING":
        return "text-amber-400"
      default:
        return "text-muted-foreground"
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  // Sort files by updated_at descending and take top 10
  const recentFiles = [...files]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
    .slice(0, 10)

  return (
    <Card className="h-fit border-border bg-card">
      <CardHeader className="py-2.5 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recent Activity
          </CardTitle>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
            {recentFiles.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-0 pr-4">
        <ScrollArea className="h-[240px] pr-2">
          {recentFiles.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">
              <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentFiles.map((file) => {
                const ActivityIcon = getActivityIcon(file.status)
                const filename = file.original_filename || file.filename || 'File'

                return (
                  <div
                    key={file.upload_id}
                    className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => router.push(`/files?highlight=${file.upload_id}`)}
                  >
                    {/* Icon pill */}
                    <div className={`rounded-md p-1.5 ${getStatusBg(file.status)} transition-colors`}>
                      <ActivityIcon className={`h-3.5 w-3.5 ${getStatusColor(file.status)}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate group-hover:text-foreground/90" title={filename}>
                        {filename.length > 20 ? filename.slice(0, 20) + '...' : filename}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-medium ${getStatusLabelColor(file.status)}`}>
                          {getActivityLabel(file.status)}
                        </span>
                        {file.dq_score ? (
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                            {file.dq_score}%
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Time */}
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70 shrink-0">
                      {(file.updated_at || file.created_at) ? formatTime(file.updated_at ?? file.created_at ?? '') : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
