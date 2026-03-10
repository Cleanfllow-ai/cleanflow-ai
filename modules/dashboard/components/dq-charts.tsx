"use client"

import { memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { DqChartsProps } from "@/modules/dashboard/components/chart-constants"
import { ChartsCarousel } from "@/modules/dashboard/components/charts/charts-carousel"
import { DqScoreChart } from "@/modules/dashboard/components/charts/dq-score-chart"

import { RowDistributionChart } from "@/modules/dashboard/components/charts/row-distribution-chart"

export { MonthlyTrendsCompact } from "@/modules/dashboard/components/monthly-trends-compact"
export { ProcessingSummary } from "@/modules/dashboard/components/processing-summary"
export { ProfessionalChartsCarousel } from "@/modules/dashboard/components/professional-charts-carousel"
export type { DqChartsProps } from "@/modules/dashboard/components/chart-constants"

function DqChartsComponent({ files }: DqChartsProps) {
  const router = useRouter()

  const { visibleFiles, completedFiles } = useMemo(
    () => {
      // Exclude versioned files (those with parent_upload_id)
      const visible = files.filter((f) => !f.parent_upload_id)
      return {
        visibleFiles: visible,
        completedFiles: visible.filter((f) => f.status === "DQ_FIXED"),
      }
    },
    [files]
  )

  const { totalRowsIn, totalRowsFixed, totalRowsQuarantined, totalRowsOut, avgDqScore } = useMemo(() => {
    const rowsIn = completedFiles.reduce((sum, f) => sum + (f.rows_in || 0), 0)
    const rowsFixed = completedFiles.reduce((sum, f) => sum + (f.rows_fixed || 0), 0)
    const rowsQuarantined = completedFiles.reduce((sum, f) => sum + (f.rows_quarantined || 0), 0)
    const avgScore =
      completedFiles.length > 0
        ? completedFiles.reduce((sum, f) => sum + (f.dq_score || 0), 0) / completedFiles.length
        : 0

    return {
      totalRowsIn: rowsIn,
      totalRowsFixed: rowsFixed,
      totalRowsQuarantined: rowsQuarantined,
      totalRowsOut: rowsIn - rowsQuarantined,
      avgDqScore: avgScore,
    }
  }, [completedFiles])

  // Files needing attention (failed, quarantined)
  const attentionFiles = useMemo(() => {
    const ATTENTION_STATUSES = ["DQ_FAILED", "REJECTED", "UPLOAD_FAILED"]
    return visibleFiles.filter(
      (f) =>
        ATTENTION_STATUSES.includes(f.status) ||
        (f.status === "DQ_FIXED" && (f.rows_quarantined || 0) > 0)
    )
  }, [visibleFiles])

  return (
    <div className="space-y-4">
      {/* Attention banner */}
      {attentionFiles.length > 0 && (() => {
        const failed = attentionFiles.filter((f) => ["DQ_FAILED", "REJECTED", "UPLOAD_FAILED"].includes(f.status)).length
        const quarantined = attentionFiles.filter((f) => f.status === "DQ_FIXED" && (f.rows_quarantined || 0) > 0).length
        const parts: string[] = []
        if (failed > 0) parts.push(`${failed} failed`)
        if (quarantined > 0) parts.push(`${quarantined} with quarantined rows`)
        return (
          <div
            className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors"
            onClick={() => router.push("/files")}
          >
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                <strong>{attentionFiles.length}</strong> file{attentionFiles.length > 1 ? "s" : ""} need attention
                {parts.length > 0 && (
                  <span className="text-muted-foreground"> — {parts.join(", ")}</span>
                )}
              </span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600 hover:text-amber-700">
              View All
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RowDistributionChart
          totalRowsOut={totalRowsOut}
          totalRowsFixed={totalRowsFixed}
          totalRowsQuarantined={totalRowsQuarantined}
        />
        <DqScoreChart completedFiles={completedFiles} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="px-4 pb-4 pt-2">
          <ChartsCarousel files={files} />
        </CardContent>
      </Card>
    </div>
  )
}

export const DqCharts = memo(DqChartsComponent)

