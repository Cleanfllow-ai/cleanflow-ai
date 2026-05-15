"use client"

import { Button } from "@/components/ui/button"
import type { FileStatusResponse } from "@/modules/files"
import { AlertCircle, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

const FAILED_STATUSES = ["DQ_FAILED", "UPLOAD_FAILED", "FAILED", "REJECTED"] as const

/**
 * Dashboard summary card — NOT a full list.
 * Shows a compact one-line summary: "28 files need attention — 1 failed, 27 quarantined"
 * Clicking "View All" navigates to Data Catalog → Needs Attention section.
 *
 * Design rationale: Users may have 100s-1000s of files. The dashboard should surface
 * the count and severity, not scroll through every file. The Data Catalog is the
 * proper place for file-level actions.
 */
export function ActionRequiredPanel({ files }: { files: FileStatusResponse[] }) {
  const router = useRouter()

  const stats = useMemo(() => {
    const visible = files.filter((f) => !f.parent_upload_id)
    const failed = visible.filter((f) =>
      (FAILED_STATUSES as readonly string[]).includes(f.status)
    ).length
    const quarantined = visible.filter(
      (f) => f.status === "DQ_FIXED" && (f.rows_quarantined ?? 0) > 0
    ).length
    const processing = visible.filter((f) =>
      ["DQ_RUNNING", "DQ_DISPATCHED", "QUEUED", "NORMALIZING"].includes(f.status)
    ).length

    return { failed, quarantined, processing, total: failed + quarantined }
  }, [files])

  if (stats.total === 0 && stats.processing === 0) return null

  // Build summary parts
  const parts: string[] = []
  if (stats.failed > 0) parts.push(`${stats.failed} failed`)
  if (stats.quarantined > 0) parts.push(`${stats.quarantined} with quarantined rows`)

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm cursor-pointer hover:bg-[#0f2d23]/70 transition-colors"
      onClick={() => router.push("/files?status=attention")}
    >
      <div className="flex items-center gap-2.5">
        <AlertCircle className="h-4 w-4 text-[#69C04B] shrink-0" />
        <span className="text-sm text-white">
          <strong className="font-semibold">{stats.total} file{stats.total !== 1 ? "s" : ""}</strong>
          {" "}need attention
          {parts.length > 0 && (
            <span className="text-white/70"> — {parts.join(", ")}</span>
          )}
        </span>
        {stats.processing > 0 && (
          <span className="text-xs text-white/70 ml-2">
            · {stats.processing} processing
          </span>
        )}
      </div>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-[#69C04B] hover:text-[#69C04B] hover:bg-[#69C04B]/20 shrink-0">
        View All
        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
      </Button>
    </div>
  )
}
