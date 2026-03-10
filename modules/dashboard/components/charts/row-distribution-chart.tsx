"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Cell, Pie, PieChart } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

import { CHART_COLORS, chartConfig } from "@/modules/dashboard/components/chart-constants"

interface RowDistributionChartProps {
  totalRowsOut: number
  totalRowsFixed: number
  totalRowsQuarantined: number
}

export function RowDistributionChart({
  totalRowsOut,
  totalRowsFixed,
  totalRowsQuarantined,
}: RowDistributionChartProps) {
  const dqDistributionData = [
    {
      name: "Validated",
      value: totalRowsOut - totalRowsFixed,
      fill: CHART_COLORS.green,
    },
    { name: "Fixed", value: totalRowsFixed, fill: CHART_COLORS.yellow },
    {
      name: "Quarantined",
      value: totalRowsQuarantined,
      fill: CHART_COLORS.red,
    },
  ].filter((d) => d.value > 0)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-semibold">Data Quality Distribution</CardTitle>
        <CardDescription className="text-xs">Breakdown of processed rows by quality status</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        {dqDistributionData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <PieChart>
              <Pie
                data={dqDistributionData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                labelLine={false}
                strokeWidth={0}
              >
                {dqDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
            No records available
          </div>
        )}
      </CardContent>
    </Card>
  )
}

