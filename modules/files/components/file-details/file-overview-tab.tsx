import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  FileText,
  Hash,
  Terminal,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { formatBytes, formatToIST } from "@/shared/lib/utils"
import type { FileStatusResponse } from "@/modules/files"

interface FileOverviewTabProps {
  file: FileStatusResponse
  versionInfo?: { versionNumber: number; totalVersions: number } | null
}

export function FileOverviewTab({ file, versionInfo }: FileOverviewTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Hash className="w-4 h-4" />
              <span className="text-sm font-medium">Rows</span>
            </div>
            <div className="text-2xl font-bold">{file.rows_in || 0}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">No Issues</span>
            </div>
            <div className="text-2xl font-bold">{file.rows_clean || 0}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Fixed</span>
            </div>
            <div className="text-2xl font-bold">{file.rows_fixed || 0}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Quarantined</span>
            </div>
            <div className="text-2xl font-bold">{file.rows_quarantined || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-muted/50 p-5 rounded-lg flex items-center justify-between border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">Quality Score</div>
                <div className="text-xs text-muted-foreground">Overall data health</div>
              </div>
            </div>
            <span className="text-3xl font-bold text-primary">
              {typeof file.dq_score === "number" ? `${file.dq_score.toFixed(1)}%` : "N/A"}
            </span>
          </div>
          <div className="bg-muted/50 p-5 rounded-lg flex items-center justify-between border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-full">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium">File Size</div>
                <div className="text-xs text-muted-foreground">Original input size</div>
              </div>
            </div>
            <span className="text-xl font-mono font-medium">
              {formatBytes(file.input_size_bytes || file.file_size || 0)}
            </span>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Timeline (IST)
          </h4>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="bg-muted/30 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Uploaded</p>
              <p className="font-mono text-sm font-medium">{formatToIST(file.uploaded_at || file.created_at)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
              <p className="font-mono text-sm font-medium">{formatToIST(file.updated_at)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Processing Time</p>
              <p className="font-mono text-sm font-medium">
                {(() => {
                  if (file.processing_time_seconds || file.processing_time) {
                    if (typeof file.processing_time === "string" && file.processing_time.includes("s")) {
                      return file.processing_time
                    }
                    const seconds =
                      file.processing_time_seconds ??
                      (typeof file.processing_time === "string"
                        ? parseFloat(file.processing_time)
                        : file.processing_time)
                    if (typeof seconds === "number" && !isNaN(seconds)) {
                      if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
                      if (seconds < 60) return `${seconds.toFixed(2)}s`
                      const minutes = Math.floor(seconds / 60)
                      const remainingSeconds = Math.floor(seconds % 60)
                      if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
                      const hours = Math.floor(minutes / 60)
                      const remainingMinutes = minutes % 60
                      return `${hours}h ${remainingMinutes}m`
                    }
                  }
                  return "-"
                })()}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4" />
            System Info
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-muted/30 p-3 rounded border">
              <span className="text-xs text-muted-foreground block mb-1">Upload ID</span>
              <code className="text-xs font-mono block truncate select-all" title={file.upload_id}>
                {file.upload_id}
              </code>
            </div>
            <div className="bg-muted/30 p-3 rounded border">
              <span className="text-xs text-muted-foreground block mb-1">Engine</span>
              <span className="text-sm font-medium">CleanAI 1.0</span>
            </div>
            {versionInfo && (
              <div className="bg-muted/30 p-3 rounded border">
                <span className="text-xs text-muted-foreground block mb-1">Version</span>
                <span className="text-sm font-medium">
                  v{versionInfo.versionNumber}
                  <span className="text-muted-foreground text-xs ml-1">of {versionInfo.totalVersions}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            API Response Debug
          </h4>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                Show Raw Data
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted/30 p-4 rounded mt-2 overflow-auto max-h-60 border">
                <div className="text-xs text-muted-foreground mb-2">Endpoint: /files/{file.upload_id}/status</div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(file, null, 2)}</pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </ScrollArea>
  )
}

