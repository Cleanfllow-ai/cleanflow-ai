"use client"

import Link from "next/link"
import { ArrowRight, Plug2, Sparkles, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * W5A-3 — First-run dashboard hero card.
 *
 * Personas Jagan (CEO demo) and Marcus (data steward): first login lands
 * on /dashboard which is otherwise empty + confusing. No clear "what do I
 * do first" action.
 *
 * Rendered when uploads count = 0 AND jobs count = 0 (i.e. fresh-state
 * org). As soon as the user has even one upload the normal dashboard
 * charts take over.
 *
 * The CTA wraps `next/link` so Playwright probes can both click it and
 * verify the navigation target is `/files`. Secondary text links to
 * /admin?tab=connectors via plain anchor for symmetric prefetch.
 */
export function DashboardZeroState() {
  return (
    <div
      data-testid="dashboard-zero-state"
      role="region"
      aria-label="Welcome — first-run dashboard"
      className="rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-primary/[0.02] p-8 sm:p-12 shadow-sm"
    >
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Sparkles className="h-9 w-9 text-primary" aria-hidden />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Welcome to RightRev
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-prose">
            Upload your first CSV to start the DQ engine. We will profile
            every column, suggest validation rules, and surface issues for
            review — usually in under two minutes.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/files" data-testid="dashboard-zero-state-primary-cta">
                <Upload className="h-4 w-4" aria-hidden />
                Upload Data
                <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="gap-2">
              <Link
                href="/admin?tab=connectors"
                data-testid="dashboard-zero-state-secondary-cta"
              >
                <Plug2 className="h-4 w-4" aria-hidden />
                Or connect a source from the Connectors marketplace
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
