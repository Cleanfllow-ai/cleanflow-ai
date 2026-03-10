"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { jobsAPI, type JobRun } from "@/modules/jobs/api/jobs-api"

export type SortField = "started_at" | "duration" | "imported" | "exported" | "status"
export type SortDirection = "asc" | "desc"
export type StatusFilter = "all" | "SUCCESS" | "FAILED" | "PARTIAL" | "NO_CHANGES"

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
    handleRefresh: () => void
    isRefreshing: boolean
}

export function useJobRunsExplorer(jobId: string): JobRunsExplorerState {
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

    const handleRefresh = useCallback(() => loadRuns(true), [loadRuns])

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
                    cmp = (a.duration_seconds || 0) - (b.duration_seconds || 0)
                    break
                case "imported":
                    cmp = (a.total_records_imported || 0) - (b.total_records_imported || 0)
                    break
                case "exported":
                    cmp = (a.total_records_exported || 0) - (b.total_records_exported || 0)
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
    }
}
