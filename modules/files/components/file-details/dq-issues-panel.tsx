import { AlertTriangle, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
            <div className="flex flex-wrap gap-2 items-center">
              {Object.entries(availableViolations).map(([code, count]) => (
                <label key={code} className="flex items-center gap-1 text-xs">
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
                  <span className="truncate max-w-[140px]" title={code}>
                    {code}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {count}
                  </Badge>
                </label>
              ))}
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

