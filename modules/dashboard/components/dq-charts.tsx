"use client"

import { memo, useMemo } from "react"

import { Card, CardContent } from "@/components/ui/card"
import type { DqChartsProps } from "@/modules/dashboard/components/chart-constants"
import { DqScoreChart } from "@/modules/dashboard/components/charts/dq-score-chart"
import { ProfessionalChartsCarousel } from "@/modules/dashboard/components/professional-charts-carousel"

import { RowDistributionChart } from "@/modules/dashboard/components/charts/row-distribution-chart"

export type { DqChartsProps } from "@/modules/dashboard/components/chart-constants"
export { MonthlyTrendsCompact } from "@/modules/dashboard/components/monthly-trends-compact"
export { ProcessingSummary } from "@/modules/dashboard/components/processing-summary"
export { ProfessionalChartsCarousel } from "@/modules/dashboard/components/professional-charts-carousel"

function DqChartsComponent({ files }: DqChartsProps) {
  const completedFiles = useMemo(
    () => {
      const visible = files.filter((f) => !f.parent_upload_id)
      return visible.filter((f) => f.status === "DQ_FIXED")
    },
    [files]
  )

  const { totalRowsFixed, totalRowsQuarantined, totalRowsOut } = useMemo(() => {
    const rowsIn = completedFiles.reduce((sum, f) => sum + (f.rows_in || 0), 0)
    const rowsFixed = completedFiles.reduce((sum, f) => sum + (f.rows_fixed || 0), 0)
    const rowsQuarantined = completedFiles.reduce((sum, f) => sum + (f.rows_quarantined || 0), 0)

    return {
      totalRowsFixed: rowsFixed,
      totalRowsQuarantined: rowsQuarantined,
      totalRowsOut: rowsIn - rowsQuarantined,
    }
  }, [completedFiles])

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RowDistributionChart
          totalRowsOut={totalRowsOut}
          totalRowsFixed={totalRowsFixed}
          totalRowsQuarantined={totalRowsQuarantined}
        />
        <DqScoreChart completedFiles={completedFiles} />
      </div>

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardContent className="px-4 pb-4 pt-2">
          <ProfessionalChartsCarousel files={files} />
        </CardContent>
      </Card>
    </div>
  )
}

export const DqCharts = memo(DqChartsComponent)
