import { AlertTriangle, Database, Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { DqReportResponse, FileStatusResponse } from "@/modules/files"
import type { FileIssue } from "@/modules/files/types"

import { DqDetectionInfo } from "./dq-detection-info"
import { DqIssuesPanel } from "./dq-issues-panel"
import { DqRowDistribution } from "./dq-row-distribution"
import { DqScoreCard } from "./dq-score-card"
import { DqTopViolations } from "./dq-top-violations"

interface FileDqReportTabProps {
  file: FileStatusResponse
  dqReport: DqReportResponse | null
  dqReportLoading: boolean
  dqReportError: string | null
  isDqMatrixReady: boolean
  downloadingMatrix: boolean
  downloading: boolean
  issues: FileIssue[]
  issuesTotal: number | null
  issuesNextOffset: number | null
  issuesLoading: boolean
  availableViolations: Record<string, number>
  selectedViolations: Set<string>
  setSelectedViolations: (next: Set<string>) => void
  openMatrixDialog: () => void
  handleDownloadDqReport: () => void
  fetchIssues: (reset?: boolean) => void
}

export function FileDqReportTab({
  file,
  dqReport,
  dqReportLoading,
  dqReportError,
  isDqMatrixReady,
  downloadingMatrix,
  downloading,
  issues,
  issuesTotal,
  issuesNextOffset,
  issuesLoading,
  availableViolations,
  selectedViolations,
  setSelectedViolations,
  openMatrixDialog,
  handleDownloadDqReport,
  fetchIssues,
}: FileDqReportTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {dqReportLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading DQ report...</p>
            </div>
          </div>
        )}

        {dqReportError && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-yellow-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">Report Unavailable</h3>
            <p className="text-muted-foreground max-w-md">{dqReportError}</p>
          </div>
        )}

        {!dqReportLoading && !dqReportError && (
          <>
            {/* Bug 6 follow-up: overfire banner — shown when rules were flagged
                but not quarantined because they hit >50% of rows */}
            {(dqReport?.overfire_rules?.length ?? 0) > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <span className="font-medium">
                    {dqReport!.overfire_rules!.reduce((sum, r) => sum + r.count, 0).toLocaleString()} row
                    {dqReport!.overfire_rules!.reduce((sum, r) => sum + r.count, 0) !== 1 ? "s" : ""} flagged for review without quarantining
                  </span>
                  {" — "}rule{dqReport!.overfire_rules!.length !== 1 ? "s" : ""} fired on a majority of rows (likely a policy mismatch, not a data error). Review the rule configuration.
                  {" Rules: "}
                  {dqReport!.overfire_rules!.map((r, i) => (
                    <span key={r.rule_id}>
                      {i > 0 && ", "}
                      <strong>{r.rule_id}</strong>{" "}({r.short_label}, {Math.round(r.hit_rate * 100)}% hit rate, {r.count.toLocaleString()} rows)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={openMatrixDialog}
                disabled={!isDqMatrixReady || downloadingMatrix}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {downloadingMatrix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Download DQ Matrix
              </Button>
              <Button
                onClick={handleDownloadDqReport}
                disabled={downloading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Report
              </Button>
            </div>

            <DqScoreCard file={file} dqReport={dqReport} />

            <DqDetectionInfo dqReport={dqReport} />

            <DqRowDistribution file={file} dqReport={dqReport} />
            <DqTopViolations dqReport={dqReport} />
            <DqIssuesPanel
              issues={issues}
              issuesTotal={issuesTotal}
              issuesNextOffset={issuesNextOffset}
              issuesLoading={issuesLoading}
              availableViolations={availableViolations}
              selectedViolations={selectedViolations}
              setSelectedViolations={setSelectedViolations}
              fetchIssues={fetchIssues}
            />
          </>
        )}
      </div>
    </ScrollArea>
  )
}
