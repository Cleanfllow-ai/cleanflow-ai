"use client"

import { ShieldCheck, ArrowRight } from "lucide-react"
import Link from "next/link"

import { AuthGuard } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { Button } from "@/components/ui/button"

/**
 * Empty-state landing page for `/quarantine` without an `upload_id` segment.
 *
 * The real quarantine editor lives at `/files/[uploadId]/quarantine` and
 * requires an upload_id to load the per-file remediation session. Before
 * this page existed, hitting `/quarantine` rendered the generic 404
 * "Page not found" screen, which gave users no path to recovery and
 * sometimes followed a stale wizard 401 toast ("session expired") that
 * made the failure look like an auth problem.
 *
 * This page intentionally renders a friendly empty state inside the
 * authenticated `MainLayout` so the sidebar stays visible and the user
 * can pick a file from `/files` to remediate without losing context.
 */
export default function QuarantineLandingPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div
          data-testid="quarantine-empty-state"
          className="flex flex-1 items-center justify-center px-4 py-12"
        >
          <div className="w-full max-w-md text-center space-y-5">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Quarantine remediation
              </p>
              <h1 className="font-sans text-xl font-semibold text-foreground">
                Pick a file to remediate
              </h1>
              <p className="text-sm text-muted-foreground">
                Open the Files page and choose a processed file with quarantined
                rows to begin the remediation session.
              </p>
            </div>
            <div className="pt-1">
              <Link href="/files">
                <Button
                  variant="default"
                  size="sm"
                  aria-label="Go to files"
                  data-testid="quarantine-empty-files-link"
                >
                  Go to Files
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
