"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { jobsAPI, type JobRun } from "@/modules/jobs/api/jobs-api"
import { useAuth } from "@/modules/auth"
import { fileManagementAPI } from "@/modules/files/api/file-management-api"
import type { FileStatusResponse } from "@/modules/files/types"

export type SortField = "started_at" | "duration" | "imported" | "exported" | "status"
export type SortDirection = "asc" | "desc"
export type StatusFilter = "all" | "SUCCESS" | "FAILED" | "PARTIAL" | "AWAITING_REVIEW" | "NO_CHANGES"

export interface RunLiveSummary {
    status: string | null
    dqScore: number | null
    rowsClean: number | null
    rowsQuarantined: number | null
    versionCount: number
    reprocessed: boolean
    running: boolean
}

export interface JobRunsExplorerState {
    runs: JobRun[]
    loading: boolean
    searchQuery: string
    setSearchQuery: (q: string) => void
    statusFilter: StatusFilter
    setStatusFilter: (f: StatusFilter) => void
    sortField: SortField
    sortDirection: SortDirection
    handleSort: (field: SortField) => void
    filteredRuns: JobRun[]
    selectedRun: JobRun | null
    setSelectedRun: (run: JobRun | null) => void
    detailModalOpen: boolean
    setDetailModalOpen: (open: boolean) => void
    handleViewRunDetail: (run: JobRun) => void
    fileViewerRun: JobRun | null
    fileViewerOpen: boolean
    setFileViewerOpen: (open: boolean) => void
    handleViewRunFiles: (run: JobRun) => void
    handleRefresh: () => void | Promise<void>
    isRefreshing: boolean
    handleRetry: () => Promise<void>
    isRetrying: boolean
    liveSummaries: Record<string, RunLiveSummary>
}

async function fetchLiveSummaryForRun(run: JobRun, token: string): Promise<RunLiveSummary> {
    const entityResults = run.entity_results || {}
    const uploadIds = Object.values(entityResults)
        .map((r: any) => r?.upload_id as string | undefined)
        .filter((u): u is string => !!u)

    if (uploadIds.length === 0) {
        return { status: null, dqScore: null, rowsClean: null, rowsQuarantined: null, versionCount: 0, reprocessed: false, running: false }
    }

    const files = await Promise.all(uploadIds.map(async (uid) => {
        try {
            const [file, versionsResp] = await Promise.all([
                fileManagementAPI.getFileStatus(uid, token),
                fileManagementAPI.getFileVersions(uid, token).catch(() => ({ versions: [] as any[], count: 0 })),
            ])
            const versions = versionsResp.versions || []
            if (versions.length > 0) {
                const latest = versions.find((v: any) => v.is_latest) ||
                    versions.reduce((a: any, b: any) => ((a.version_number || 0) >= (b.version_number || 0) ? a : b))
                if (latest.dq_score != null) file.dq_score = latest.dq_score
                if (latest.status) file.status = latest.status as FileStatusResponse["status"]
                if (latest.rows_clean != null) file.rows_clean = latest.rows_clean
                if (latest.rows_quarantined != null) file.rows_quarantined = latest.rows_quarantined
            }
            return { file, versionCount: versions.length }
        } catch {
            return null
        }
    }))

    const valid = files.filter((x): x is { file: FileStatusResponse; versionCount: number } => !!x)
    if (valid.length === 0) {
        return { status: null, dqScore: null, rowsClean: null, rowsQuarantined: null, versionCount: 0, reprocessed: false, running: false }
    }

    const statuses = valid.map(v => (v.file.status || "").toUpperCase())
    const anyRunning = statuses.some(s => s.includes("RUNNING") || s.includes("PROCESSING") || s.includes("QUEUED"))
    const anyFailed = statuses.some(s => s.includes("FAILED"))
    const anyQuarantined = statuses.some(s => s.includes("QUARANTINED"))
    const allFixed = statuses.every(s => s.includes("FIXED") || s.includes("COMPLETED") || s.includes("PROCESSED"))
    const aggregateStatus = anyFailed ? "FAILED"
        : anyRunning ? "PROCESSING"
        : allFixed ? valid[0].file.status || "FIXED"
        : anyQuarantined ? "QUARANTINED"
        : valid[0].file.status || null

    const dqScores = valid.map(v => v.file.dq_score).filter((s): s is number => s != null).map(Number)
    const avgDq = dqScores.length > 0 ? dqScores.reduce((a, b) => a + b, 0) / dqScores.length : null

    const rowsClean = valid.reduce((sum, v) => sum + (v.file.rows_clean ?? 0), 0)
    const rowsQuarantined = valid.reduce((sum, v) => sum + (v.file.rows_quarantined ?? 0), 0)
    const maxVersions = Math.max(...valid.map(v => v.versionCount))

    return {
        status: aggregateStatus,
        dqScore: avgDq,
        rowsClean,
        rowsQuarantined,
        versionCount: maxVersions,
        reprocessed: maxVersions > 1,
        running: anyRunning,
    }
}

export function useJobRunsExplorer(jobId: string): JobRunsExplorerState {
    const { idToken } = useAuth()
    const [runs, setRuns] = useState<JobRun[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [sortField, setSortField] = useState<SortField>("started_at")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
    const [selectedRun, setSelectedRun] = useState<JobRun | null>(null)
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [fileViewerRun, setFileViewerRun] = useState<JobRun | null>(null)
    const [fileViewerOpen, setFileViewerOpen] = useState(false)
    const [liveSummaries, setLiveSummaries] = useState<Record<string, RunLiveSummary>>({})

    const loadRuns = useCallback(async (isManual = false) => {
        if (isManual) setIsRefreshing(true)
        else setLoading(true)
        try {
            const res = await jobsAPI.getJobRuns(jobId, 50)
            setRuns(res.runs || [])
        } catch {
            setRuns([])
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }, [jobId])

    useEffect(() => {
        loadRuns()
    }, [loadRuns])

    // Silent poll every 3s when any run is RUNNING (no loading flash)
    useEffect(() => {
        const hasRunning = runs.some(r => r.status === "RUNNING")
        if (!hasRunning) return
        const interval = setInterval(async () => {
            try {
                const res = await jobsAPI.getJobRuns(jobId, 50)
                setRuns(res.runs || [])
            } catch { /* silent */ }
        }, 3000)
        return () => clearInterval(interval)
    }, [runs, jobId])

    // Refetch when the tab regains visibility (user returning from quarantine editor)
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") void loadRuns(true)
        }
        document.addEventListener("visibilitychange", onVisible)
        return () => document.removeEventListener("visibilitychange", onVisible)
    }, [loadRuns])

    // Keep selectedRun in sync with the latest fetched run data so the detail
    // modal shows fresh timing/DQ stats after a reprocess+resume.
    useEffect(() => {
        if (!selectedRun) return
        const fresh = runs.find(r => r.run_id === selectedRun.run_id)
        if (fresh && fresh !== selectedRun) setSelectedRun(fresh)
    }, [runs, selectedRun])

    // Fetch live file status per run so the row can reflect reprocess state
    // (REPROCESSED, PROCESSING, FIXED, etc.) without waiting for a resume.
    const refreshLiveSummaries = useCallback(async () => {
        if (!idToken || runs.length === 0) return
        const results = await Promise.all(
            runs.map(async (run) => [run.run_id, await fetchLiveSummaryForRun(run, idToken)] as const)
        )
        setLiveSummaries(Object.fromEntries(results))
    }, [runs, idToken])

    useEffect(() => {
        void refreshLiveSummaries()
    }, [refreshLiveSummaries])

    // Poll live summaries every 5s while any file is still processing.
    useEffect(() => {
        const anyRunning = Object.values(liveSummaries).some(s => s.running)
        if (!anyRunning) return
        const interval = setInterval(() => { void refreshLiveSummaries() }, 5000)
        return () => clearInterval(interval)
    }, [liveSummaries, refreshLiveSummaries])

    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortDirection("desc")
        }
    }, [sortField])

    const handleViewRunDetail = useCallback((run: JobRun) => {
        setSelectedRun(run)
        setDetailModalOpen(true)
    }, [])

    const handleViewRunFiles = useCallback((run: JobRun) => {
        setFileViewerRun(run)
        setFileViewerOpen(true)
    }, [])

    const handleRefresh = useCallback(async () => {
        await loadRuns(true)
        await refreshLiveSummaries()
    }, [loadRuns, refreshLiveSummaries])

    const [isRetrying, setIsRetrying] = useState(false)
    const handleRetry = useCallback(async () => {
        setIsRetrying(true)
        try {
            await jobsAPI.triggerJob(jobId)
            // Quick refresh to pick up RUNNING status, then auto-poll takes over
            setTimeout(() => loadRuns(true), 500)
        } catch {
            // ignore — user will see no new run appear
        } finally {
            setIsRetrying(false)
        }
    }, [jobId, loadRuns])


    const filteredRuns = useMemo(() => {
        let result = [...runs]

        // Status filter
        if (statusFilter !== "all") {
            result = result.filter(r => r.status === statusFilter)
        }

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(r =>
                r.run_id.toLowerCase().includes(q) ||
                r.started_at?.toLowerCase().includes(q) ||
                r.trigger_source?.toLowerCase().includes(q) ||
                r.status.toLowerCase().includes(q)
            )
        }

        // Sort
        result.sort((a, b) => {
            let cmp = 0
            switch (sortField) {
                case "started_at":
                    cmp = (a.started_at || "").localeCompare(b.started_at || "")
                    break
                case "duration":
                    cmp = (a.duration_ms || 0) - (b.duration_ms || 0)
                    break
                case "imported":
                    cmp = (a.total_imported || 0) - (b.total_imported || 0)
                    break
                case "exported":
                    cmp = (a.total_exported || 0) - (b.total_exported || 0)
                    break
                case "status":
                    cmp = (a.status || "").localeCompare(b.status || "")
                    break
            }
            return sortDirection === "asc" ? cmp : -cmp
        })

        return result
    }, [runs, statusFilter, searchQuery, sortField, sortDirection])

    return {
        runs,
        loading,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        sortField,
        sortDirection,
        handleSort,
        filteredRuns,
        selectedRun,
        setSelectedRun,
        detailModalOpen,
        setDetailModalOpen,
        handleViewRunDetail,
        fileViewerRun,
        fileViewerOpen,
        setFileViewerOpen,
        handleViewRunFiles,
        handleRefresh,
        isRefreshing,
        handleRetry,
        isRetrying,
        liveSummaries,
    }
}
