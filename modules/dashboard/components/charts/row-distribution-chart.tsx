"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { CHART_COLORS, chartConfig } from "@/modules/dashboard/components/chart-constants"
import { Cell, Pie, PieChart } from "recharts"
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
  // Recharts <Pie> crashes on negative values; clamp to zero. The math
  // (`rowsOut - rowsFixed`) can go negative when fixed > out due to upstream
  // bookkeeping drift, so we guard at the render boundary rather than relying
  // on backend invariants.
  const validatedRaw = totalRowsOut - totalRowsFixed
  const dqDistributionData = [
    {
      name: "Validated",
      value: Math.max(validatedRaw, 0),
      fill: CHART_COLORS.green,
    },
    { name: "Fixed", value: Math.max(totalRowsFixed, 0), fill: CHART_COLORS.yellow },
    {
      name: "Quarantined",
      value: Math.max(totalRowsQuarantined, 0),
      fill: CHART_COLORS.red,
    },
  ].filter((d) => d.value > 0)
  return (
    <Card className="border-[#69C04B]/40 bg-[#0f2d23]/50 backdrop-blur-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70"
        >
          Row Distribution
        </CardTitle>
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
                label={({ name, percent }) => {
                  const pct = (percent as number) * 100;
                  if (pct < 1) return null;
                  return `${name} ${pct.toFixed(0)}%`;
                }}
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
          <div className="h-[220px] flex items-center justify-center text-white/60 text-xs">
            No records available
          </div>
        )}
      </CardContent>
    </Card>
  )
}
