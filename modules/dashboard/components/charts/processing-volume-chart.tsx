"use client"

import { Cell, Pie, PieChart } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

import { CHART_COLORS, chartConfig } from "@/modules/dashboard/components/chart-constants"

interface ProcessingVolumeChartProps {
  completedCount: number
  processingCount: number
  failedCount: number
}

export function ProcessingVolumeChart({
  completedCount,
  processingCount,
  failedCount,
}: ProcessingVolumeChartProps) {
  const fileStatusData = [
    { name: "Completed", value: completedCount, fill: CHART_COLORS.greenSoft },
    { name: "Processing", value: processingCount, fill: CHART_COLORS.blueSoft },
    { name: "Failed", value: failedCount, fill: CHART_COLORS.redSoft },
  ].filter((d) => d.value > 0)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-semibold">Processing Volume</CardTitle>
        <CardDescription className="text-xs">File count grouped by current processing state</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        {fileStatusData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <PieChart>
              <Pie
                data={fileStatusData}
                cx="50%"
                cy="50%"
                outerRadius={78}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {fileStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
            No files available
          </div>
        )}
      </CardContent>
    </Card>
  )
}

