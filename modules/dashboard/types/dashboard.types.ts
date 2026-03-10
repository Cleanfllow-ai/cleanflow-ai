// ─── Dashboard types ──────────────────────────────────────────────────────────
// Extracted from lib/features/dashboard/dashboardSlice.ts

export interface DashboardState {
    totalTransformations: number
    successRate: number
    activeConnections: number
    recentActivity: Array<{
        id: string
        type: "transform" | "upload" | "download"
        status: "success" | "error" | "pending"
        timestamp: string
        details: string
    }>
    systemHealth: {
        api: "healthy" | "degraded" | "down"
        database: "healthy" | "degraded" | "down"
        storage: "healthy" | "degraded" | "down"
    }
}
