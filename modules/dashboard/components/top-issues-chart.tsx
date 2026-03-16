"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { TopIssue } from "@/modules/files"

const COLORS = [
  "bg-rose-400/70",
  "bg-amber-400/70",
  "bg-violet-400/70",
  "bg-sky-400/70",
  "bg-teal-400/70",
  "bg-emerald-400/70",
]

const BAR_COLORS = [
  "bg-rose-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-sky-400",
  "bg-teal-400",
  "bg-emerald-400",
]

type Props = {
  issues?: TopIssue[]
  isLoading?: boolean
}

export function TopIssuesChart({ issues, isLoading }: Props) {
  const normalized = (issues || [])
    .filter((i) => typeof i.count === "number" && i.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((issue, idx) => ({
      id: idx + 1,
      name: issue.violation.replace(/_/g, " "),
      count: issue.count,
      color: COLORS[idx % COLORS.length],
      barColor: BAR_COLORS[idx % BAR_COLORS.length],
    }))

  const totalIssues = normalized.reduce((sum, issue) => sum + issue.count, 0)
  const issuesWithPct = normalized.map((issue) => ({
    ...issue,
    percentage: totalIssues > 0 ? Math.round((issue.count / totalIssues) * 100) : 0,
  }))

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Top DQ Issues
            </span>
          </CardTitle>
          <div className="text-right flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono tabular-nums text-foreground">
              {totalIssues.toLocaleString()}
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1 pb-3 px-3 max-h-[280px] overflow-y-auto">
        {isLoading && issuesWithPct.length === 0 ? (
          <div className="space-y-2.5 py-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-8" />
                  </div>
                  <div className="h-1.5 bg-muted rounded-full w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : issuesWithPct.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            No issues yet. Process files to see real data quality insights.
          </div>
        ) : (
          <div className="space-y-2.5">
            {issuesWithPct.map((issue, index) => (
              <div key={issue.id} className="flex items-center gap-2.5">
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
                  issue.color
                )}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">
                      {issue.name}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0 ml-2">
                      {issue.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", issue.barColor)}
                      style={{ width: `${issue.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
