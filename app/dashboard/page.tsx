"use client"

/**
 * AA4 Phase 1 — customer usage dashboard.
 *
 * This route is the new org home page. The previous analytics-heavy
 * dashboard (DqCharts / ActivityFeed / TopIssuesChart / ProcessingSummary)
 * is still available via the underlying module exports for admin contexts
 * but is no longer the default landing experience for a customer.
 */
import { MainLayout } from "@/shared/layout/main-layout"
import { AuthGuard } from "@/modules/auth"
import { CustomerUsageDashboard } from "@/modules/dashboard"

export default function DashboardPage() {
    return (
        <AuthGuard>
            <MainLayout>
                <CustomerUsageDashboard />
            </MainLayout>
        </AuthGuard>
    )
}
