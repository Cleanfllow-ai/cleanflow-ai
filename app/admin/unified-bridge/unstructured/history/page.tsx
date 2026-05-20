"use client"

/**
 * /admin/unified-bridge/unstructured/history — past unstructured-import jobs.
 */

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { Button } from "@/components/ui/button"
import { JobHistoryTable } from "@/modules/unstructured"

export default function UnstructuredHistoryPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/unified-bridge?tab=unstructured">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Unstructured Job History</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Past unstructured-import runs for this organization.
              </p>
            </div>
          </div>
          <JobHistoryTable />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
