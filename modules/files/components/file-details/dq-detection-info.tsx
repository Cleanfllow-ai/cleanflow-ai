import { Cpu, Database } from "lucide-react"

import type { DqReportResponse } from "@/modules/files"

interface DqDetectionInfoProps {
  dqReport: DqReportResponse | null
}

export function DqDetectionInfo({ dqReport }: DqDetectionInfoProps) {
  if (!dqReport?.detected_erp && !dqReport?.detected_entity) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {dqReport?.detected_erp && (
        <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Cpu className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Detected ERP</p>
            <p className="font-medium">{dqReport.detected_erp}</p>
          </div>
        </div>
      )}
      {dqReport?.detected_entity && (
        <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Database className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Detected Entity</p>
            <p className="font-medium capitalize">{dqReport.detected_entity.replace(/_/g, " ")}</p>
          </div>
        </div>
      )}
    </div>
  )
}

