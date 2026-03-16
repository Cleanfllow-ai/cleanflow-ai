import { useEffect, useState, useCallback } from "react"

import { useToast } from "@/shared/hooks/use-toast"
import { DqReportResponse, FileStatusResponse, fileManagementAPI } from "@/modules/files/api/file-management-api"
import type { FileDetailsTab, FileIssue, FilePreviewData, MatrixTotals } from "@/modules/files/types"

interface VersionInfo {
  versionNumber: number
  totalVersions: number
}

export function useFileDetails(file: FileStatusResponse | null, open: boolean, defaultTab: FileDetailsTab = "details") {
  const ISSUES_PAGE_SIZE = 50
  const [activeTab, setActiveTab] = useState<FileDetailsTab>(defaultTab)
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
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
  const [latestFile, setLatestFile] = useState<FileStatusResponse | null>(file)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [latestVersionUploadId, setLatestVersionUploadId] = useState<string | null | undefined>(undefined)
  const { toast } = useToast()

  const loadPreview = useCallback(async () => {
    const targetFile = latestFile || file
    if (!targetFile) return

    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const data = await fileManagementAPI.getFilePreview(latestVersionUploadId || targetFile.upload_id, token)
      setPreviewData(data)
    } catch (err: any) {
      setPreviewError(err.message || "Failed to load preview")
    } finally {
      setPreviewLoading(false)
    }
  }, [latestFile, file, latestVersionUploadId])

  const loadDqReport = useCallback(async () => {
    const targetFile = latestFile || file
    if (!targetFile) return

    setDqReportLoading(true)
    setDqReportError(null)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const report = await fileManagementAPI.downloadDqReport(latestVersionUploadId || targetFile.upload_id, token)
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
      setDqReportError(err.message || "Failed to load DQ report")
    } finally {
      setDqReportLoading(false)
    }
  }, [latestFile, file, latestVersionUploadId])

  useEffect(() => {
    // latestVersionUploadId === undefined means "not yet resolved" — wait for it
    if (latestVersionUploadId === undefined) return
    if (open && file && activeTab === "preview" && !previewData) {
      void loadPreview()
    }
    if (open && file && activeTab === "dq-report" && !dqReport) {
      void loadDqReport()
    }
  }, [open, file, activeTab, latestVersionUploadId, loadPreview, loadDqReport])

  useEffect(() => {
    if (!open) {
      setActiveTab(defaultTab)
      setPreviewData(null)
      setPreviewError(null)
      setDqReport(null)
      setDqReportError(null)
      setIssues([])
      setIssuesTotal(null)
      setIssuesNextOffset(null)
      setAvailableViolations({})
      setSelectedViolations(new Set())
      setLatestVersionUploadId(undefined)
    }
  }, [open])

  useEffect(() => {
    setLatestFile(file)
  }, [file])

  useEffect(() => {
    if (open && file) {
      void loadLatestFileDetails()
    }
  }, [open, file])

  const loadLatestFileDetails = async () => {
    if (!file) return
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) return

      const [freshFile, versionsResp] = await Promise.all([
        fileManagementAPI.getFileStatus(file.upload_id, token),
        fileManagementAPI.getFileVersions(file.upload_id, token).catch(() => ({ versions: [], count: 0 })),
      ])

      const versions = versionsResp.versions || []
      if (versions.length > 0) {
        // Find latest version by is_latest flag or highest version_number
        const latest = versions.find((v) => v.is_latest) ||
          versions.reduce((a, b) => ((a.version_number || 0) >= (b.version_number || 0) ? a : b))
        // Merge latest version stats onto the root file record
        if (latest.dq_score != null) freshFile.dq_score = latest.dq_score
        if (latest.status) freshFile.status = latest.status as FileStatusResponse["status"]
        if (latest.rows_in != null) freshFile.rows_in = latest.rows_in
        if (latest.rows_clean != null) freshFile.rows_clean = latest.rows_clean
        if (latest.rows_fixed != null) freshFile.rows_fixed = latest.rows_fixed
        if (latest.rows_quarantined != null) freshFile.rows_quarantined = latest.rows_quarantined
        if (latest.processing_time_seconds != null) freshFile.processing_time_seconds = latest.processing_time_seconds
        setLatestVersionUploadId(latest.upload_id)
        setVersionInfo({ versionNumber: latest.version_number || 1, totalVersions: versions.length })
      } else {
        setLatestVersionUploadId(null)
        setVersionInfo(null)
      }

      setLatestFile(freshFile)
    } catch (error) {
      console.error("Failed to refresh file details", error)
      setLatestVersionUploadId(null)
    }
  }

  const fetchIssues = async (reset = false) => {
    if (!file) return
    if (!reset && issuesNextOffset === null) return
    setIssuesLoading(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const resp = await fileManagementAPI.getFileIssues(latestVersionUploadId || file.upload_id, token, {
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
      setDqReportError(err.message || "Failed to load issues")
    } finally {
      setIssuesLoading(false)
    }
  }

  const handleDownloadDqReport = async () => {
    if (!file) return
    setDownloading(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const report = await fileManagementAPI.downloadDqReport(latestVersionUploadId || file.upload_id, token)

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `dq_report_${file.original_filename || file.filename || file.upload_id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Downloaded",
        description: "DQ report downloaded successfully",
      })
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err.message || "Failed to download DQ report",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const openMatrixDialog = async () => {
    setMatrixDialogOpen(true)
    if (!file) return

    setMatrixLoadingTotals(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem("authTokens") || "{}")
      const token = authTokens.idToken
      if (!token) throw new Error("Not authenticated")
      const head = await fileManagementAPI.getDQMatrix(file.upload_id, token, { limit: 1, offset: 0 })
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
    if (!file) return
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
      const data = await fileManagementAPI.getDQMatrix(file.upload_id, token, params)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `dq_matrix_${file.original_filename || file.filename || file.upload_id}.json`
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
    latestFile,
    versionInfo,
    fetchIssues,
    handleDownloadDqReport,
    openMatrixDialog,
    handleDownloadDqMatrix,
  }
}

