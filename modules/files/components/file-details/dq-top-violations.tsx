import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { DqReportResponse } from "@/modules/files"

interface DqTopViolationsProps {
  dqReport: DqReportResponse | null
}

export function DqTopViolations({ dqReport }: DqTopViolationsProps) {
  const topViolations =
    dqReport?.top_violations ??
    (dqReport?.violation_counts
      ? Object.entries(dqReport.violation_counts)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 5)
          .map(([violation, count]) => ({ violation, count }))
      : [])

  if (!topViolations || topViolations.length === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Top Violations
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {topViolations.map((item) => (
          <div key={item.violation} className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
            <span className="text-sm truncate" title={item.violation}>
              {item.violation.replace(/_/g, " ")}
            </span>
            <Badge variant="secondary">{item.count.toLocaleString()}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

