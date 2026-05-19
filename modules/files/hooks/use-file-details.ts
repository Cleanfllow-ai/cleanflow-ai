import { useEffect, useState, useCallback } from "react"

import { useToast } from "@/shared/hooks/use-toast"
import { isApiError } from "@/modules/shared/api-error"
import {
  DqReportResponse,
  FileStatusResponse,
  fileManagementAPI,
  type FileVersionSummary,
} from "@/modules/files/api/file-management-api"
import type { FileDetailsTab, FileIssue, FilePreviewData, MatrixTotals } from "@/modules/files/types"

/** Structured reasons the preview surface can surface contextual CTAs for. */
export type PreviewErrorKind =
  | "uploading"     // file not yet ready (UPLOADING / DQ_DISPATCHED / DQ_RUNNING …)
  | "rejected"      // REJECTED — validator failed
  | "timeout"       // API took > PREVIEW_TIMEOUT_MS
  | "server_error"  // 5xx
  | "not_found"     // 404 but NOT a not-ready case (deleted)
  | "generic"       // everything else

const PREVIEW_TIMEOUT_MS = 5_000

/** Map an API error to a structured PreviewErrorKind. */
function classifyPreviewError(err: unknown, fileStatus: string): PreviewErrorKind {
  const status = fileStatus.toUpperCase()
  if (
    status === "UPLOADING" ||
    status === "UPLOADED" ||
    status === "VALIDATED" ||
    status === "DQ_DISPATCHED" ||
    status === "DQ_RUNNING"
  ) {
    return "uploading"
  }
  if (status === "REJECTED") return "rejected"
  if (err instanceof Error && err.name === "AbortError") return "timeout"
  if (isApiError(err)) {
    if (err.status >= 500) return "server_error"
    if (err.status === 404 && err.action === "retry") return "uploading"
    if (err.status === 404) return "not_found"
  }
  return "generic"
}

interface VersionInfo {
  versionNumber: number
  totalVersions: number
  isLatest: boolean
  patchNotes?: string | null
  sourceUploadId?: string | null
  remediationMode?: string | null
}

const READY_FOR_REPORT = new Set(["DQ_FIXED", "DQ_COMPLETE", "COMPLETED", "PROCESSED"])

/**
 * Statuses where preview data exists on S3.
 * Files below this threshold (UPLOADING, UPLOADED, VALIDATED, DQ_DISPATCHED,
 * DQ_RUNNING) have no result.parquet yet — calling preview-data returns 404.
 * REJECTED files are permanently unavailable.
 */
const READY_FOR_PREVIEW = new Set([
  "DQ_FIXED", "DQ_FAILED", "DQ_COMPLETE", "COMPLETED", "PROCESSED",
])

/**
 * Terminal preview-error kinds that must NOT be auto-retried on re-render.
 * "uploading" → file not ready yet (user must click Refresh manually).
 * "rejected"  → file permanently failed validation.
 * "not_found" → file deleted.
 */
const TERMINAL_PREVIEW_ERROR_KINDS = new Set<PreviewErrorKind>([
  "uploading", "rejected", "not_found",
])

function getVersionNumber(
  version: FileVersionSummary | null | undefined,
  file: FileStatusResponse | null | undefined,
): number {
  return version?.version_number || file?.version_number || 1
}

function normalizeVersions(versions: FileVersionSummary[]): FileVersionSummary[] {
  return [...versions].sort((a, b) => (a.version_number || 0) - (b.version_number || 0))
}

function resolveLatestVersion(versions: FileVersionSummary[]): FileVersionSummary | null {
  if (versions.length === 0) return null
  return versions.find((version) => version.is_latest) ||
    versions.reduce((latest, candidate) =>
      (candidate.version_number || 0) >= (latest.version_number || 0) ? candidate : latest
    )
}

export function useFileDetails(file: FileStatusResponse | null, open: boolean, defaultTab: FileDetailsTab = "details") {
  const ISSUES_PAGE_SIZE = 50
  const [activeTab, setActiveTab] = useState<FileDetailsTab>(defaultTab)
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewErrorKind, setPreviewErrorKind] = useState<PreviewErrorKind | null>(null)
  const [dqReport, setDqReport] = useState<DqReportResponse | null>(null)
  const [dqReportLoading, setDqReportLoading] = useState(false)
  const [dqReportError, setDqReportError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadingMatrix, setDownloadingMatrix] = useState(false)
  const [matrixDialogOpen, setMatrixDialogOpen] = useState(false)
  const [matrixLimit, setMatrixLimit] = useState<number | string>(500)
  const [matrixStart, setMatrixStart] = useState<string>("")
  const [matrixEnd, setMatrixEnd] = useState<string>("")
  const [matrixTotals, setMatrixTotals] = useState<MatrixTotals | null>(null)
  const [matrixLoadingTotals, setMatrixLoadingTotals] = useState(false)
  const [issues, setIssues] = useState<FileIssue[]>([])
  const [issuesTotal, setIssuesTotal] = useState<number | null>(null)
  const [issuesNextOffset, setIssuesNextOffset] = useState<number | null>(null)
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [availableViolations, setAvailableViolations] = useState<Record<string, number>>({})
  const [selectedViolations, setSelectedViolations] = useState<Set<string>>(new Set())
  const [versions, setVersions] = useState<FileVersionSummary[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [selectedVersionUploadId, setSelectedVersionUploadId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileStatusResponse | null>(file)
  const [statusCache, setStatusCache] = useState<Record<string, FileStatusResponse>>({})
  const { toast } = useToast()

  const selectedVersion = versions.find((version) => version.upload_id === selectedVersionUploadId) || null
  const currentFile = selectedFile || file
  const versionInfo: VersionInfo | null = currentFile ? {
    versionNumber: getVersionNumber(selectedVersion, currentFile),
    totalVersions: Math.max(versions.length, 1),
    isLatest: Boolean(selectedVersion?.is_latest || currentFile.is_latest),
    patchNotes: selectedVersion?.patch_notes,
    sourceUploadId: selectedVersion?.source_upload_id || currentFile.source_upload_id || null,
    remediationMode: selectedVersion?.remediation_mode || currentFile.remediation_mode || null,
  } : null

  const selectedUploadId = selectedVersionUploadId || currentFile?.upload_id || file?.upload_id || null

  const loadPreview = useCallback(async () => {
    if (!selectedUploadId) return

    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewErrorKind(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS)

    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")

      // Inject AbortSignal via the options parameter of makeRequest
      const data = await fileManagementAPI.getFilePreview(selectedUploadId, token, controller.signal)

      // Failure mode 6: header-only file (0 data rows)
      if (data.total_rows === 0 && data.headers.length > 0) {
        setPreviewData(data)  // render empty-state in tab
      } else {
        setPreviewData(data)
      }
    } catch (err: any) {
      const fileStatus = currentFile?.status || ""
      const kind = classifyPreviewError(err, fileStatus)
      setPreviewErrorKind(kind)

      switch (kind) {
        case "uploading":
          setPreviewError("File is still processing. Try again in a moment.")
          break
        case "rejected":
          setPreviewError("This file was rejected during validation.")
          break
        case "timeout":
          setPreviewError("Preview took too long to load.")
          break
        case "server_error":
          setPreviewError("Server error generating preview.")
          toast({
            title: "Preview failed",
            description: "Couldn't generate preview. Retry?",
            variant: "destructive",
            id: "preview-500",
          })
          break
        case "not_found":
          setPreviewError("This file was deleted.")
          break
        default:
          setPreviewError("Could not load preview. Please try again.")
      }
    } finally {
      clearTimeout(timeoutId)
      setPreviewLoading(false)
    }
  }, [selectedUploadId, currentFile?.status, toast])

  const loadDqReport = useCallback(async () => {
    if (!selectedUploadId) return

    setDqReportLoading(true)
    setDqReportError(null)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const report = await fileManagementAPI.downloadDqReport(selectedUploadId, token)
      setDqReport(report)

      const sampleIssues = report?.hybrid_summary?.outstanding_issues || []
      const initialIssues = sampleIssues.slice(0, ISSUES_PAGE_SIZE)
      setIssues(initialIssues)

      const totalIssues = report?.hybrid_summary?.outstanding_issues_total ?? sampleIssues.length
      setIssuesTotal(totalIssues)
      const hasMore = totalIssues > initialIssues.length
      const sampleSize = report?.hybrid_summary?.outstanding_issues_sample_size ?? sampleIssues.length
      setIssuesNextOffset(hasMore ? Math.min(sampleSize, ISSUES_PAGE_SIZE) : null)
      setAvailableViolations(report?.violation_counts || {})
    } catch (err: any) {
      console.error("Failed to load DQ report:", err)
      setDqReportError("Could not load the quality report. Please try again.")
    } finally {
      setDqReportLoading(false)
    }
  }, [selectedUploadId])

  useEffect(() => {
    if (!open) {
      setActiveTab(defaultTab)
      setPreviewData(null)
      setPreviewError(null)
      setPreviewErrorKind(null)
      setDqReport(null)
      setDqReportError(null)
      setIssues([])
      setIssuesTotal(null)
      setIssuesNextOffset(null)
      setAvailableViolations({})
      setSelectedViolations(new Set())
      setVersions([])
      setSelectedVersionUploadId(null)
      setSelectedFile(file)
      setStatusCache({})
      setMatrixTotals(null)
      return
    }

    if (!file) return

    let cancelled = false
    const refreshLineage = async () => {
      setVersionsLoading(true)
      try {
        const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
        const token = authTokens.idToken
        if (!token) return

        const rawFreshFile = await fileManagementAPI.getFileStatus(file.upload_id, token)
        if (cancelled) return

        // Preserve processing_time from the original file if the status endpoint doesn't return it
        const freshFile: FileStatusResponse = {
          ...rawFreshFile,
          processing_time: rawFreshFile.processing_time ?? file.processing_time,
          processing_time_seconds: rawFreshFile.processing_time_seconds ?? file.processing_time_seconds,
        }

        let nextStatusCache: Record<string, FileStatusResponse> = { [freshFile.upload_id]: freshFile }

        const rootUploadId = freshFile.root_upload_id || freshFile.upload_id
        const versionsResp = await fileManagementAPI.getFileVersions(rootUploadId, token).catch(() => ({ versions: [], count: 0 }))
        if (cancelled) return

        const normalized = normalizeVersions(versionsResp.versions || [])
        setVersions(normalized)

        const latest = resolveLatestVersion(normalized)
        const openedSpecificVersion = Boolean(freshFile.root_upload_id && freshFile.root_upload_id !== freshFile.upload_id)
        const defaultVersionId = openedSpecificVersion
          ? freshFile.upload_id
          : (latest?.upload_id || freshFile.upload_id)
        if (defaultVersionId !== freshFile.upload_id) {
          const defaultVersionFile = await fileManagementAPI.getFileStatus(defaultVersionId, token)
          if (cancelled) return
          nextStatusCache = {
            ...nextStatusCache,
            [defaultVersionId]: defaultVersionFile,
          }
          setSelectedFile(defaultVersionFile)
        } else {
          setSelectedFile(freshFile)
        }
        setStatusCache(nextStatusCache)
        setSelectedVersionUploadId(defaultVersionId)
      } catch (error) {
        console.error("Failed to refresh file details", error)
        if (!cancelled) {
          setVersions([])
          setSelectedVersionUploadId(file.upload_id)
          setSelectedFile(file)
          setStatusCache(file ? { [file.upload_id]: file } : {})
        }
      } finally {
        if (!cancelled) {
          setVersionsLoading(false)
        }
      }
    }

    void refreshLineage()
    return () => {
      cancelled = true
    }
  }, [open, file, defaultTab])

  useEffect(() => {
    if (!open || !selectedUploadId) return

    const cached = statusCache[selectedUploadId]
    if (cached) {
      setSelectedFile(cached)
      return
    }

    let cancelled = false
    const loadSelectedFile = async () => {
      try {
        const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
        const token = authTokens.idToken
        if (!token) return
        const nextFile = await fileManagementAPI.getFileStatus(selectedUploadId, token)
        if (cancelled) return
        setStatusCache((prev) => ({ ...prev, [selectedUploadId]: nextFile }))
        setSelectedFile(nextFile)
      } catch (error) {
        console.error("Failed to load selected version details", error)
      }
    }

    void loadSelectedFile()
    return () => {
      cancelled = true
    }
  }, [open, selectedUploadId, statusCache])

  useEffect(() => {
    setPreviewData(null)
    setPreviewError(null)
    setPreviewErrorKind(null)
    setDqReport(null)
    setDqReportError(null)
    setIssues([])
    setIssuesTotal(null)
    setIssuesNextOffset(null)
    setAvailableViolations({})
    setSelectedViolations(new Set())
    setMatrixTotals(null)
  }, [selectedUploadId])

  useEffect(() => {
    if (!open || !selectedUploadId) return

    const fileStatus = (currentFile?.status || "").toUpperCase()
    const isReadyForPreview = READY_FOR_PREVIEW.has(fileStatus)

    // Bug 1 fix: only attempt preview fetch when the file actually has
    // result data on S3 (DQ_FIXED / DQ_FAILED / COMPLETED).
    // For not-ready statuses we show the "uploading" error state without
    // polling — the user clicks Refresh manually.
    // Also stop retrying once a terminal error has been classified
    // (uploading / rejected / not_found) to prevent the re-render loop
    // where !previewData && !previewLoading stays true after a 404.
    if (activeTab === "preview" && !previewData && !previewLoading) {
      if (!isReadyForPreview) {
        // Show the "not ready" state immediately without hitting the API.
        setPreviewErrorKind("uploading")
        setPreviewError("File is still processing. Preview available after DQ completes.")
      } else if (!previewErrorKind || !TERMINAL_PREVIEW_ERROR_KINDS.has(previewErrorKind)) {
        void loadPreview()
      }
    }

    // Lazy-load the dq report on preview tab too (#11): we need
    // `synthesised_columns` from there to render calculator icons on
    // formula-derived headers. Cheap single S3 GET; no-op when already
    // loaded.
    // Bug 4 fix: only fetch when the file is actually in a ready state —
    // prevents polling /download?type=report for files still processing.
    if (
      (activeTab === "preview" || activeTab === "dq-report") &&
      !dqReport && !dqReportLoading &&
      READY_FOR_REPORT.has(fileStatus)
    ) {
      void loadDqReport()
    }
  }, [
    open,
    selectedUploadId,
    activeTab,
    previewData,
    previewLoading,
    previewErrorKind,
    dqReport,
    dqReportLoading,
    currentFile?.status,
    loadPreview,
    loadDqReport,
  ])

  useEffect(() => {
    const status = (currentFile?.status || "").toUpperCase()
    if (activeTab === "dq-report" && status && !READY_FOR_REPORT.has(status)) {
      setActiveTab(defaultTab === "details" ? "details" : "preview")
    }
  }, [activeTab, currentFile?.status, defaultTab])

  const fetchIssues = async (reset = false) => {
    if (!selectedUploadId) return
    if (!reset && issuesNextOffset === null) return
    setIssuesLoading(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const resp = await fileManagementAPI.getFileIssues(selectedUploadId, token, {
        offset: reset ? 0 : issuesNextOffset || 0,
        violations: Array.from(selectedViolations),
      })

      if (reset) {
        setIssues(resp.issues || [])
      } else {
        setIssues((prev) => [...prev, ...(resp.issues || [])])
      }

      setIssuesTotal(resp.total ?? (resp.issues ? resp.issues.length : 0))
      setIssuesNextOffset(resp.next_offset === undefined ? null : resp.next_offset)
      if (resp.available_violations) {
        setAvailableViolations(resp.available_violations)
      }
    } catch (err: any) {
      console.error("Failed to load issues:", err)
      setDqReportError("Could not load issues. Please try again.")
    } finally {
      setIssuesLoading(false)
    }
  }

  const handleDownloadDqReport = async () => {
    if (!selectedUploadId || !currentFile) return
    setDownloading(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const report = await fileManagementAPI.downloadDqReport(selectedUploadId, token)

      /** Wrap a single CSV field: double-quote if it contains comma, quote, or newline. */
      const csvField = (value: unknown): string => {
        const s = value === null || value === undefined ? "" : String(value)
        if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      }
      const csvRow = (...fields: unknown[]): string => fields.map(csvField).join(",")

      const uploadId = report.upload_id || selectedUploadId
      const totalRows = report.hybrid_summary?.total_rows ?? report.rows_in ?? ""
      const cleanRows = report.hybrid_summary?.clean_rows ?? report.rows_clean ?? ""
      const quarantinedRows = report.hybrid_summary?.quarantined_rows ?? report.rows_quarantined ?? ""
      const score = report.dq_score !== undefined && report.dq_score !== null
        ? `${Math.round(report.dq_score * 100) / 100}%`
        : ""

      const lines: string[] = [
        csvRow("Upload ID", uploadId),
        csvRow("Total Rows", totalRows),
        csvRow("Clean Rows", cleanRows),
        csvRow("Quarantined Rows", quarantinedRows),
        csvRow("Quality Score", score),
        "",
        csvRow("Rule ID", "Issue", "Description", "Hits"),
      ]

      const topViolations = report.top_violations
      if (topViolations && topViolations.length > 0) {
        for (const v of topViolations) {
          lines.push(csvRow(v.violation, v.short_label || v.violation, v.description || "", v.count))
        }
      } else if (report.violation_counts && Object.keys(report.violation_counts).length > 0) {
        for (const [ruleId, count] of Object.entries(report.violation_counts)) {
          lines.push(csvRow(ruleId, ruleId, "", count))
        }
      }

      const csv = lines.join("\n")
      const rawFilename = currentFile.original_filename || currentFile.filename || selectedUploadId
      const baseName = rawFilename.replace(/\.[^.]+$/, "")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `dq_report_${baseName}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded",
        description: "DQ report downloaded successfully",
      })
    } catch (err: any) {
      console.error("Failed to download DQ report:", err)
      toast({
        title: "Download failed",
        description: "Could not download the quality report. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const openMatrixDialog = async () => {
    setMatrixDialogOpen(true)
    if (!selectedUploadId) return

    setMatrixLoadingTotals(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const head = await fileManagementAPI.getDQMatrix(selectedUploadId, token, { limit: 1, offset: 0 })
      setMatrixTotals({
        totalResults: head?.total_results,
        totalRows: head?.total_rows,
      })
    } catch {
      // ignore
    } finally {
      setMatrixLoadingTotals(false)
    }
  }

  const handleDownloadDqMatrix = async () => {
    if (!selectedUploadId || !currentFile) return
    setDownloadingMatrix(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const params: { limit?: number; offset?: number } = {}
      const limitVal = Number(matrixLimit)
      if (!Number.isNaN(limitVal) && limitVal > 0) params.limit = limitVal
      const startVal = matrixStart ? Number(matrixStart) : undefined
      const endVal = matrixEnd ? Number(matrixEnd) : undefined
      if (startVal !== undefined && !Number.isNaN(startVal) && startVal >= 0) {
        params.offset = startVal
        if (endVal !== undefined && !Number.isNaN(endVal) && endVal >= startVal) {
          params.limit = endVal - startVal + 1
        }
      }
      const data = await fileManagementAPI.getDQMatrix(selectedUploadId, token, params)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `dq_matrix_${currentFile.original_filename || currentFile.filename || selectedUploadId}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: "Downloaded", description: `Returned ${data.returned ?? "some"} rows` })
      setMatrixDialogOpen(false)
    } catch (err: any) {
      const message = err?.message || "Failed to download dq_matrix"
      const friendly =
        message.includes("not ready") || message.includes("dq_matrix not found")
          ? "DQ matrix is not ready yet. Please run processing and wait for DQ_COMPLETE, then try again."
          : message
      toast({ title: "Download failed", description: friendly, variant: "destructive" })
    } finally {
      setDownloadingMatrix(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    previewData,
    previewLoading,
    previewError,
    previewErrorKind,
    loadPreview,
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
  }
}
