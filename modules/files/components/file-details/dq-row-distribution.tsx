import { PieChart as PieChartIcon } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import type { DqReportResponse, FileStatusResponse } from "@/modules/files"

interface DqRowDistributionProps {
  file: FileStatusResponse
  dqReport: DqReportResponse | null
}

export function DqRowDistribution({ file, dqReport }: DqRowDistributionProps) {
  const total = dqReport?.rows_in ?? file.rows_in ?? 0
  const clean = dqReport?.rows_clean ?? file.rows_clean ?? 0
  const fixed = dqReport?.rows_fixed ?? file.rows_fixed ?? 0
  const quarantined = dqReport?.rows_quarantined ?? file.rows_quarantined ?? 0

  const pieData = [
    { name: "Clean", value: clean, color: "#22C55E" },
    { name: "Fixed", value: fixed, color: "#EAB308" },
    { name: "Quarantined", value: quarantined, color: "#EF4444" },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <PieChartIcon className="w-4 h-4" />
        Row Distribution
      </h4>

      {pieData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">No data available</div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-6">
          <div className="text-center mb-4">
            <p className="text-3xl font-bold">{total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </div>

          <div className="flex justify-center">
            <div style={{ width: 220, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString(), "Rows"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--background))",
                      padding: "8px 12px",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.value.toLocaleString()} ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

