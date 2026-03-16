"use client"

import { memo, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle, FileText, TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { DqChartsProps } from "@/modules/dashboard/components/chart-constants"
import { ProfessionalChartsCarousel } from "@/modules/dashboard/components/professional-charts-carousel"
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

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          className="relative overflow-hidden cursor-pointer border-border bg-card hover:border-primary/30 transition-colors"
          onClick={() => router.push("/files?tab=explorer")}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-sky-500" />
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Files</span>
            </div>
            <div className="font-sans text-2xl font-bold text-foreground">{visibleFiles.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              <span className="font-mono tabular-nums">{completedFiles.length}</span> files processed
            </p>
          </CardContent>
        </Card>
        <Card
          className="relative overflow-hidden cursor-pointer border-border bg-card hover:border-primary/30 transition-colors"
          onClick={() => router.push("/files?tab=explorer&status=bad")}
        >
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${avgDqScore >= 90 ? "bg-emerald-500" : avgDqScore >= 70 ? "bg-amber-500" : "bg-rose-500"}`} />
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Avg DQ</span>
            </div>
            <div
              className={`font-sans text-2xl font-bold ${avgDqScore >= 90 ? "text-emerald-400" : avgDqScore >= 70 ? "text-amber-400" : "text-rose-400"}`}
            >
              <span className="font-mono tabular-nums">{avgDqScore.toFixed(1)}</span>%
            </div>
          </CardContent>
        </Card>
        <Card
          className="relative overflow-hidden cursor-pointer border-border bg-card hover:border-primary/30 transition-colors"
          onClick={() => router.push("/files?tab=explorer&status=DQ_FIXED")}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500" />
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rows Processed</span>
            </div>
            <div className="font-sans text-2xl font-bold text-foreground font-mono tabular-nums">
              {totalRowsIn.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              <span className="font-mono tabular-nums">{totalRowsOut.toLocaleString()}</span> valid output rows
            </p>
          </CardContent>
        </Card>
        <Card
          className="relative overflow-hidden cursor-pointer border-border bg-card hover:border-primary/30 transition-colors"
          onClick={() => router.push("/files?tab=explorer&status=DQ_FIXED")}
        >
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${totalRowsFixed > 0 ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Issues Resolved</span>
            </div>
            <div className="font-sans text-2xl font-bold text-foreground font-mono tabular-nums">
              {totalRowsFixed.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              <span className="font-mono tabular-nums">{totalRowsQuarantined.toLocaleString()}</span> quarantined
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RowDistributionChart
          totalRowsOut={totalRowsOut}
          totalRowsFixed={totalRowsFixed}
          totalRowsQuarantined={totalRowsQuarantined}
        />
        <DqScoreChart completedFiles={completedFiles} />
      </div>

      <Card className="border-border bg-card">
        <CardContent className="px-4 pb-4 pt-2">
          <ProfessionalChartsCarousel files={files} />
        </CardContent>
      </Card>
    </div>
  )
}

export const DqCharts = memo(DqChartsComponent)
