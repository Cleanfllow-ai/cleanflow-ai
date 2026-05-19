import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { getRuleLabel, getRuleDescription } from "@/shared/lib/dq-rules"
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
      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {topViolations.map((item) => {
            // Hide raw rule code (R1..R39 / CUST_*). Only the human label
            // is visible; the long description lives in the hover tooltip;
            // the code itself is in data-rule-id for inspection but never
            // rendered to the user.
            const friendly =
              item.short_label?.trim() ||
              getRuleLabel(item.violation) ||
              "Data Quality Rule"
            const longDesc =
              (item.description && item.description.trim()) ||
              getRuleDescription(item.violation) ||
              friendly
            return (
              <Tooltip key={item.violation}>
                <TooltipTrigger asChild>
                  <div
                    data-rule-id={item.violation}
                    data-testid="dq-top-violation-row"
                    className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between gap-2 cursor-help"
                  >
                    <div className="min-w-0 flex flex-col">
                      <span
                        className="text-sm truncate"
                        data-testid="dq-top-violation-label"
                      >
                        {friendly}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{item.count.toLocaleString()}</Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs" data-testid="dq-top-violation-tooltip">
                  {longDesc}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

