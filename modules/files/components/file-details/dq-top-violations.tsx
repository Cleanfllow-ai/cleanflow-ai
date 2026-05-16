import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { DqReportResponse, TopIssue } from "@/modules/files"

interface DqTopViolationsProps {
  dqReport: DqReportResponse | null
}

export function DqTopViolations({ dqReport }: DqTopViolationsProps) {
  const topViolations: TopIssue[] =
    dqReport?.top_violations ??
    (dqReport?.violation_counts
      ? Object.entries(dqReport.violation_counts)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 5)
          .map(([violation, count]): TopIssue => ({ violation, count }))
      : [])

  if (!topViolations || topViolations.length === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Top Violations
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {topViolations.map((item) => {
          const displayLabel = item.short_label || item.violation.replace(/_/g, " ")
          const showCode = item.short_label && item.short_label !== item.violation
          return (
            <div key={item.violation} className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between gap-2">
              <div className="min-w-0 flex flex-col">
                <span className="text-sm truncate" title={displayLabel}>
                  {displayLabel}
                </span>
                {showCode && (
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{item.violation}</span>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0">{item.count.toLocaleString()}</Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}

