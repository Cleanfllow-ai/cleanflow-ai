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

type Props = {
  issues?: TopIssue[]
}

export function TopIssuesChart({ issues }: Props) {
  const normalized = (issues || [])
    .filter((i) => typeof i.count === "number" && i.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((issue, idx) => ({
      id: idx + 1,
      name: issue.violation.replace(/_/g, " "),
      count: issue.count,
      color: COLORS[idx % COLORS.length],
    }))

  const totalIssues = normalized.reduce((sum, issue) => sum + issue.count, 0)
  const issuesWithPct = normalized.map((issue) => ({
    ...issue,
    percentage: totalIssues > 0 ? Math.round((issue.count / totalIssues) * 100) : 0,
  }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Top Data Quality Issues
          </CardTitle>
          <div className="text-right">
            <span className="text-lg font-bold">{totalIssues.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground ml-1">total</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-3 max-h-[280px] overflow-y-auto">
        {issuesWithPct.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            No issues yet. Process files to see real data quality insights.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-1 h-14 mb-2">
              {issuesWithPct.map((issue, index) => (
                <div
                  key={issue.id}
                  className={cn(
                    "rounded-md flex items-center justify-center text-white font-semibold text-xs transition-all hover:opacity-90 cursor-default",
                    issue.color,
                    index === 0 ? "col-span-4 row-span-2" :
                    index === 1 ? "col-span-4 row-span-2" :
                    index === 2 ? "col-span-4 row-span-1" :
                    index === 3 ? "col-span-2 row-span-1" :
                    "col-span-2 row-span-1"
                  )}
                  title={`${issue.name}: ${issue.count} issues (${issue.percentage}%)`}
                >
                  <span className="text-center">
                    <span className="block text-sm font-bold">{issue.percentage}%</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {issuesWithPct.map((issue, index) => (
                <div key={issue.id} className="flex items-center gap-2">
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
                    issue.color
                  )}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate">{issue.name}</span>
                      <span className="text-xs font-semibold tabular-nums shrink-0">
                        {issue.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                      <div
                        className={cn("h-full rounded-full", issue.color)}
                        style={{ width: `${issue.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
