import { AlertTriangle, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { getRuleLabel, getRuleDescription } from "@/shared/lib/dq-rules"
import type { FileIssue } from "@/modules/files/types"

import { RowWiseIssues } from "../row-wise-issues"

interface DqIssuesPanelProps {
  issues: FileIssue[]
  issuesTotal: number | null
  issuesNextOffset: number | null
  issuesLoading: boolean
  availableViolations: Record<string, number>
  selectedViolations: Set<string>
  setSelectedViolations: (next: Set<string>) => void
  fetchIssues: (reset?: boolean) => void
}

export function DqIssuesPanel({
  issues,
  issuesTotal,
  issuesNextOffset,
  issuesLoading,
  availableViolations,
  selectedViolations,
  setSelectedViolations,
  fetchIssues,
}: DqIssuesPanelProps) {
  if (!issues || issues.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Outstanding Issues
          </h4>
          <Badge variant="secondary">
            Showing {issues.length.toLocaleString()} of {(issuesTotal ?? issues.length).toLocaleString()}
          </Badge>
          {issuesNextOffset !== null && <Badge variant="outline">More available</Badge>}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {Object.keys(availableViolations).length > 0 && (
            <TooltipProvider delayDuration={150}>
              <div className="flex flex-wrap gap-2 items-center">
                {Object.entries(availableViolations).map(([code, count]) => {
                  // Hide raw rule code; show the human label + hover tooltip
                  // describes the rule. The code itself is in data-rule-id.
                  const label = getRuleLabel(code)
                  const desc = getRuleDescription(code) || label
                  return (
                    <Tooltip key={code}>
                      <TooltipTrigger asChild>
                        <label
                          data-rule-id={code}
                          data-testid="issue-filter-checkbox"
                          className="flex items-center gap-1 text-xs cursor-help"
                        >
                          <Checkbox
                            checked={selectedViolations.has(code)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedViolations)
                              if (checked) {
                                next.add(code)
                              } else {
                                next.delete(code)
                              }
                              setSelectedViolations(next)
                            }}
                          />
                          <span className="truncate max-w-[180px]">
                            {label}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {count}
                          </Badge>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs" data-testid="issue-filter-tooltip">
                        {desc}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => fetchIssues(true)}
                  disabled={issuesLoading}
                >
                  {issuesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply filters"}
                </Button>
              </div>
            </TooltipProvider>
          )}
          {issuesNextOffset !== null && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => fetchIssues(false)}
              disabled={issuesLoading}
            >
              {issuesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load more"}
            </Button>
          )}
        </div>
      </div>

      <RowWiseIssues issues={issues} total={issuesTotal || undefined} hasMore={issuesNextOffset !== null} />
    </div>
  )
}

