"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { CHART_COLORS, chartConfig } from "@/modules/dashboard/components/chart-constants"
import type { FileStatusResponse } from "@/modules/files"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
interface DqScoreChartProps {
  completedFiles: FileStatusResponse[]
}
export function DqScoreChart({ completedFiles }: DqScoreChartProps) {
  if (completedFiles.length === 0) {
    return (
      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70"
          >
            Score Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-1">
          <div className="h-[220px] flex items-center justify-center text-white/60 text-xs">
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
    <Card className="border-border bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70"
        >
          Score Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-1">
        <div className="flex flex-col gap-3">
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <BarChart data={scoreDistData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" stroke="#ffffff" fontSize={10} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#ffffff" }} stroke="#ffffff" />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#F1FFEE] border border-[#69C04B]/20 rounded-lg shadow-lg p-2.5 text-xs">
                        <p className="font-medium text-[#164234]">{payload[0].payload.name}</p>
                        <p className="text-[#164234]/60 font-mono tabular-nums">{payload[0].value} files</p>
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
            <div className="p-2.5 rounded-lg bg-[#69C04B]/10 border border-[#69C04B]/20 text-center flex-1">
              <p className="text-lg font-bold text-[#69C04B] font-mono tabular-nums">{excellent}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/60 font-medium">Excellent</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center flex-1">
              <p className="text-lg font-bold text-amber-400 font-mono tabular-nums">{good}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/60 font-medium">Good</p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center flex-1">
              <p className="text-lg font-bold text-rose-400 font-mono tabular-nums">{bad}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/60 font-medium">Bad</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
