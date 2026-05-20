"use client"

/**
 * /admin/unified-bridge/unstructured/jobs/[jobId] — live job detail view.
 *
 * Streams SSE log + per-file table for a single unstructured-import run.
 */

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { Button } from "@/components/ui/button"
import { JobRunView } from "@/modules/unstructured"

export default function UnstructuredJobDetailPage() {
  const params = useParams<{ jobId: string }>()
  const jobId = params?.jobId ? decodeURIComponent(params.jobId) : ""

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
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Unstructured Job</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Real-time agent log + per-file extraction status.
              </p>
            </div>
          </div>
          {jobId ? (
            <JobRunView jobId={jobId} />
          ) : (
            <div className="text-sm text-muted-foreground">Missing job ID.</div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
