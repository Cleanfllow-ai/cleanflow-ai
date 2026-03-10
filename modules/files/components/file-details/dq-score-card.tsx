import { Badge } from "@/components/ui/badge"
import { cn } from "@/shared/lib/utils"
import type { DqReportResponse, FileStatusResponse } from "@/modules/files"

interface DqScoreCardProps {
  file: FileStatusResponse
  dqReport: DqReportResponse | null
}

export function DqScoreCard({ file, dqReport }: DqScoreCardProps) {
  const score = dqReport?.dq_score ?? file.dq_score ?? 0

  return (
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1">Data Quality Score</h3>
          <p className="text-sm text-muted-foreground">Overall quality assessment</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-primary">
            {dqReport?.dq_score !== undefined
              ? `${dqReport.dq_score}%`
              : file.dq_score !== undefined
                ? `${file.dq_score}%`
                : "N/A"}
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "mt-1",
              score >= 90 ? "bg-emerald-100 text-emerald-700" : score >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
            )}
          >
            {score >= 90 ? "Excellent" : score >= 70 ? "Good" : "Needs Attention"}
          </Badge>
        </div>
      </div>
    </div>
  )
}

