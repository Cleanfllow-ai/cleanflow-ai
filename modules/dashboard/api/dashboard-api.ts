/**
 * dashboard-api.ts — AA4 Phase 1 client for GET /dashboard/summary.
 * Reuses the auth + 401-refresh-aware makeRequest helper from files module
 * to stay consistent with every other module (auth header injection,
 * console-noise suppression for 403/membership errors, transparent refresh).
 */
import { makeRequest } from "@/modules/files/api/file-upload-api"
import type { DashboardSummaryResponse } from "@/modules/dashboard/types/dashboard-summary.types"

const ENDPOINT = "/dashboard/summary"

export const dashboardAPI = {
    /** Fetch the full envelope (topbar + 3 tiles) in a single round-trip. */
    getSummary: (authToken: string): Promise<DashboardSummaryResponse> =>
        makeRequest(ENDPOINT, authToken, { method: "GET" }),
}
