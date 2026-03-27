import { FileText, GitBranch, PieChart as PieChartIcon, Server, Table as TableIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/modules/auth"
import type { FileStatusResponse } from "@/modules/files/api/file-management-api"
import { useFileDetails } from "@/modules/files/hooks/use-file-details"

import { DqMatrixDialog } from "./dq-matrix-dialog"
import { FileDqReportTab } from "./file-details/file-dq-report-tab"
import { FileOverviewTab } from "./file-details/file-overview-tab"
import { FilePreviewTab } from "./file-details/file-preview-tab"
import { FileVersionHistory } from "./file-version-history"
import { RowWiseIssues } from "./row-wise-issues"

export { DqMatrixDialog } from "./dq-matrix-dialog"
export { RowWiseIssues } from "./row-wise-issues"

interface FileDetailsDialogProps {
  file: FileStatusResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemediate?: (file: FileStatusResponse) => void
  /** Hide specific tabs (e.g. ["details", "versions"] for job file viewer) */
  hideTabs?: string[]
}

export function FileDetailsDialog({ file, open, onOpenChange, onRemediate, hideTabs = [] }: FileDetailsDialogProps) {
  const { idToken } = useAuth()
  const defaultTab = hideTabs.includes("details") ? "preview" as const : "details" as const
  const {
    activeTab,
    setActiveTab,
    previewData,
    previewLoading,
    previewError,
    dqReport,
    dqReportLoading,
    dqReportError,
    downloading,
    downloadingMatrix,
    matrixDialogOpen,
    setMatrixDialogOpen,
    matrixLimit,
    setMatrixLimit,
    matrixStart,
    setMatrixStart,
    matrixEnd,
    setMatrixEnd,
    matrixTotals,
    matrixLoadingTotals,
    issues,
    issuesTotal,
    issuesNextOffset,
    issuesLoading,
    availableViolations,
    selectedViolations,
    setSelectedViolations,
    currentFile,
    versions,
    versionsLoading,
    selectedVersion,
    selectedVersionUploadId,
    setSelectedVersionUploadId,
    versionInfo,
    fetchIssues,
    handleDownloadDqReport,
    openMatrixDialog,
    handleDownloadDqMatrix,
  } = useFileDetails(file, open, defaultTab)

  if (!file) return null
  const resolvedFile = currentFile || file

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase() || ""
    if (s.includes("FIXED") || s.includes("COMPLETED") || s.includes("PROCESSED")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-green-500/10 dark:text-green-500 dark:border-green-500/20"
    }
    if (s.includes("FAILED")) return "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20"
    if (s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED")) {
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-yellow-500/10 dark:text-yellow-500 dark:border-yellow-500/20"
    }
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20"
  }

  const isDqMatrixReady = (() => {
    const status = (resolvedFile.status || "").toUpperCase()
    return (
      status.includes("DQ_COMPLETE") ||
      status.includes("DQ_FIXED") ||
      status.includes("COMPLETED") ||
      status.includes("PROCESSED")
    )
  })()

  const versionOptions = [...versions].sort((a, b) => (b.version_number || 0) - (a.version_number || 0))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[98vw] h-[80vh] max-w-6xl max-h-none p-0 flex flex-col gap-0">
          <div className="flex h-full flex-col">
            <DialogHeader className="px-6 py-3 border-b shrink-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <DialogTitle className="flex items-center gap-2.5 font-sans text-base font-semibold tracking-tight truncate">
                      <span className="truncate">{resolvedFile.original_filename || resolvedFile.filename || "File"}</span>
                    </DialogTitle>
                    <Badge className={cn("shrink-0 text-[10px] font-medium", getStatusColor(resolvedFile.status))} variant="outline">
                      {resolvedFile.status}
                    </Badge>
                    {versionInfo && (
                      <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
                        v{versionInfo.versionNumber}
                        <span className="ml-1 text-muted-foreground">of {versionInfo.totalVersions}</span>
                      </Badge>
                    )}
                  </div>
                  {versionInfo && (versionInfo.patchNotes || versionInfo.remediationMode || versionInfo.isLatest) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {versionInfo.patchNotes && (
                        <span className="max-w-[420px] truncate">{versionInfo.patchNotes}</span>
                      )}
                      {versionInfo.remediationMode && (
                        <Badge variant="secondary" className="font-normal capitalize">
                          {versionInfo.remediationMode}
                        </Badge>
                      )}
                      {versionInfo.isLatest && (
                        <Badge variant="secondary" className="font-normal">
                          Current latest
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {versionOptions.length > 0 && (
                  <div className="w-full shrink-0 lg:w-[320px]">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Viewing Version
                    </div>
                    <Select
                      value={selectedVersionUploadId || resolvedFile.upload_id}
                      onValueChange={setSelectedVersionUploadId}
                      disabled={versionsLoading}
                    >
                      <SelectTrigger className="h-10 bg-background/80">
                        <SelectValue placeholder={selectedVersion ? `v${selectedVersion.version_number}` : "Select version"} />
                      </SelectTrigger>
                      <SelectContent>
                        {versionOptions.map((version) => (
                          <SelectItem key={version.upload_id} value={version.upload_id}>
                            {`v${version.version_number} | ${version.status || "Unknown"}${version.is_latest ? " | Latest" : ""}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="px-6 py-2 border-b shrink-0">
              <div className="inline-flex rounded-lg bg-muted p-0.5 gap-0.5">
                {!hideTabs.includes("details") && (
                  <button
                    onClick={() => setActiveTab("details")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                      activeTab === "details"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Server className="h-3.5 w-3.5" />
                    Details
                  </button>
                )}
                <button
                  onClick={() => setActiveTab("preview")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    activeTab === "preview"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Preview
                </button>
                {isDqMatrixReady && (
                  <button
                    onClick={() => setActiveTab("dq-report")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                      activeTab === "dq-report"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <PieChartIcon className="h-3.5 w-3.5" />
                    DQ Report
                  </button>
                )}
                {!hideTabs.includes("versions") && (
                  <button
                    onClick={() => setActiveTab("versions")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                      activeTab === "versions"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    Versions
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              {activeTab === "details" && <FileOverviewTab file={resolvedFile} versionInfo={versionInfo} />}
              {activeTab === "preview" && (
                <FilePreviewTab
                  previewLoading={previewLoading}
                  previewError={previewError}
                  previewData={previewData}
                />
              )}
              {activeTab === "dq-report" && (
                <FileDqReportTab
                  file={resolvedFile}
                  dqReport={dqReport}
                  dqReportLoading={dqReportLoading}
                  dqReportError={dqReportError}
                  isDqMatrixReady={isDqMatrixReady}
                  downloadingMatrix={downloadingMatrix}
                  downloading={downloading}
                  issues={issues}
                  issuesTotal={issuesTotal}
                  issuesNextOffset={issuesNextOffset}
                  issuesLoading={issuesLoading}
                  availableViolations={availableViolations}
                  selectedViolations={selectedViolations}
                  setSelectedViolations={setSelectedViolations}
                  openMatrixDialog={openMatrixDialog}
                  handleDownloadDqReport={handleDownloadDqReport}
                  fetchIssues={fetchIssues}
                />
              )}
              {activeTab === "versions" && idToken && (
                <div className="px-6 py-4 overflow-auto">
                  <FileVersionHistory
                    rootUploadId={resolvedFile.root_upload_id || resolvedFile.upload_id}
                    authToken={idToken}
                    selectedUploadId={selectedVersionUploadId}
                    onSelectVersion={(version) => setSelectedVersionUploadId(version.upload_id)}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DqMatrixDialog
        open={matrixDialogOpen}
        onOpenChange={setMatrixDialogOpen}
        limit={matrixLimit}
        start={matrixStart}
        end={matrixEnd}
        setLimit={setMatrixLimit}
        setStart={setMatrixStart}
        setEnd={setMatrixEnd}
        totals={matrixTotals}
        loadingTotals={matrixLoadingTotals}
        onDownload={handleDownloadDqMatrix}
        downloading={downloadingMatrix}
      />
    </>
  )
}
