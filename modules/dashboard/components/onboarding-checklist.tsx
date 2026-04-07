"use client"

import { CheckCircle2, Upload, Play, Pencil, Download } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import type { FileStatusResponse } from "@/modules/files"

interface OnboardingChecklistProps {
  files: FileStatusResponse[]
}

/**
 * Shown on the dashboard when the user has no files yet (or very few).
 * Guides new users through the core workflow:
 *   1. Upload a file
 *   2. Run DQ processing
 *   3. Review quarantined rows
 *   4. Export clean data
 *
 * Each step links directly to the relevant action. Completed steps show a checkmark.
 * The entire component hides once all 4 steps are completed.
 */
export function OnboardingChecklist({ files }: OnboardingChecklistProps) {
  const router = useRouter()

  const steps = useMemo(() => {
    const visible = files.filter((f) => !f.parent_upload_id)
    const hasUploaded = visible.length > 0
    const hasProcessed = visible.some((f) => f.status === "DQ_FIXED" || f.status === "COMPLETED")
    const hasRemediated = visible.some(
      (f) => (f.status === "DQ_FIXED" || f.status === "COMPLETED") && (f.rows_quarantined || 0) === 0
    )
    const hasExported = visible.some((f) => (f as any).exported_at || (f as any).status === "EXPORTED")

    return [
      {
        id: "upload",
        title: "Upload your first file",
        description: "CSV, Excel, or JSON — up to 1 GB",
        icon: Upload,
        done: hasUploaded,
        action: () => router.push("/files"),
        actionLabel: "Go to Data Catalog",
      },
      {
        id: "process",
        title: "Run data quality processing",
        description: "AI detects column types and applies 33+ quality rules",
        icon: Play,
        done: hasProcessed,
        action: () => router.push("/files"),
        actionLabel: "Open Files",
      },
      {
        id: "remediate",
        title: "Review & fix quarantined rows",
        description: "Edit flagged cells in the inline quarantine editor",
        icon: Pencil,
        done: hasRemediated,
        action: () => router.push("/files"),
        actionLabel: "Open Files",
      },
      {
        id: "export",
        title: "Export clean data",
        description: "Download as CSV/Excel or push directly to QuickBooks/Zoho",
        icon: Download,
        done: hasExported,
        action: () => router.push("/files"),
        actionLabel: "Open Files",
      },
    ]
  }, [files, router])

  const allDone = steps.every((s) => s.done)
  const completedCount = steps.filter((s) => s.done).length

  // Don't show if all steps are completed
  if (allDone) return null

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-lg mx-auto">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Welcome to CleanFlowAI</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Complete these steps to start cleaning your data.
        </p>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {completedCount}/{steps.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const isNext = !step.done && (i === 0 || steps[i - 1].done)

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                step.done
                  ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                  : isNext
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-card opacity-50"
              }`}
            >
              {/* Checkbox */}
              <div className="flex-shrink-0">
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    isNext ? "border-primary" : "border-border"
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </div>
              </div>

              {/* Action */}
              {isNext && !step.done && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs shrink-0"
                  onClick={step.action}
                >
                  {step.actionLabel}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
