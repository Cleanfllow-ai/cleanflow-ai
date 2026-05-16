/**
 * use-dashboard-summary.ts — AA4 Phase 1.
 *
 * Single-call fetch hook for GET /dashboard/summary with a 60-second
 * in-memory cache keyed on the auth token. The cache is a module-level
 * Map so the same data is served to every dashboard mount within the
 * window (e.g. sidebar nav -> dashboard remount). The cache is cleared
 * on `refresh()`.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/modules/auth"
import { dashboardAPI } from "@/modules/dashboard/api/dashboard-api"
import type { DashboardSummaryResponse } from "@/modules/dashboard/types/dashboard-summary.types"

const CACHE_TTL_MS = 60_000
type CacheEntry = { data: DashboardSummaryResponse; ts: number }
const _cache = new Map<string, CacheEntry>()

export interface UseDashboardSummaryResult {
    data: DashboardSummaryResponse | null
    isLoading: boolean
    error: Error | null
    refresh: () => Promise<void>
}

export function useDashboardSummary(): UseDashboardSummaryResult {
    const { idToken } = useAuth()
    const [data, setData] = useState<DashboardSummaryResponse | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchSummary = useCallback(
        async (bypassCache: boolean) => {
            if (!idToken) return
            if (!bypassCache) {
                const cached = _cache.get(idToken)
                if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
                    setData(cached.data)
                    setIsLoading(false)
                    setError(null)
                    return
                }
            }
            setIsLoading(true)
            setError(null)
            try {
                const resp = await dashboardAPI.getSummary(idToken)
                _cache.set(idToken, { data: resp, ts: Date.now() })
                setData(resp)
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)))
            } finally {
                setIsLoading(false)
            }
        },
        [idToken],
    )

    useEffect(() => {
        void fetchSummary(false)
    }, [fetchSummary])

    const refresh = useCallback(async () => {
        if (idToken) _cache.delete(idToken)
        await fetchSummary(true)
    }, [idToken, fetchSummary])

    return { data, isLoading, error, refresh }
}

/** Test-only — clears the module cache between unit-test mounts. */
export function _clearDashboardSummaryCache(): void {
    _cache.clear()
}
