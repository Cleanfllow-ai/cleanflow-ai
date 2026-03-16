"use client"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import type { FileStatusResponse } from "@/modules/files"
import { CHART_COLORS, chartConfig } from "@/modules/dashboard/components/chart-constants"
interface DqScoreChartProps {
  completedFiles: FileStatusResponse[]
}
export function DqScoreChart({ completedFiles }: DqScoreChartProps) {
  if (completedFiles.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Score Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-1">
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
            No processed files available
          </div>
        </CardContent>
      </Card>
    )
  }
  const excellent = completedFiles.filter((f) => (f.dq_score || 0) >= 90).length
  const good = completedFiles.filter((f) => (f.dq_score || 0) >= 70 && (f.dq_score || 0) < 90).length
  const bad = completedFiles.filter((f) => (f.dq_score || 0) < 70).length
  const scoreDistData = [
    { name: "Excellent (90-100%)", value: excellent, fill: CHART_COLORS.greenSoft },
    { name: "Good (70-89%)", value: good, fill: CHART_COLORS.yellowSoft },
    { name: "Bad (<70%)", value: bad, fill: CHART_COLORS.redSoft },
  ].filter((d) => d.value > 0)
  return (
    <Card className="border-border">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Score Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        <div className="flex flex-col gap-3">
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <BarChart data={scoreDistData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" stroke="hsl(220 10% 50%)" fontSize={10} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} stroke="hsl(220 10% 50%)" />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border rounded-lg shadow-lg p-2.5 text-xs">
                        <p className="font-medium text-foreground">{payload[0].payload.name}</p>
                        <p className="text-muted-foreground font-mono tabular-nums">{payload[0].value} files</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {scoreDistData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="flex gap-2 justify-center">
            <div className="p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/10 text-center flex-1">
              <p className="text-lg font-bold text-emerald-500 font-mono tabular-nums">{excellent}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Excellent</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/10 text-center flex-1">
              <p className="text-lg font-bold text-amber-500 font-mono tabular-nums">{good}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Good</p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/8 border border-rose-500/10 text-center flex-1">
              <p className="text-lg font-bold text-rose-500 font-mono tabular-nums">{bad}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Bad</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
