"use client"

/**
 * /admin/unified-bridge — top-level page for the Unified Bridge admin section.
 *
 * Hosts the structured/unstructured tab switcher. The actual import surfaces
 * live in @/modules/unified-bridge (structured) and @/modules/unstructured
 * (new tab).
 */

import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import UnifiedBridgeTabs from "@/modules/admin/components/unified-bridge-tabs"

export default function UnifiedBridgePage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="w-full max-w-6xl mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold">Unified Bridge</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bring data into CleanFlowAI from any source — structured connectors
              or unstructured document pipelines.
            </p>
          </div>
          <UnifiedBridgeTabs />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
