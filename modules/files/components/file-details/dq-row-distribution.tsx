"use client"

import { PieChart as PieChartIcon } from "lucide-react"

import type { DqReportResponse, FileStatusResponse } from "@/modules/files"

interface DqRowDistributionProps {
  file: FileStatusResponse
  dqReport: DqReportResponse | null
}

interface Segment {
  name: string
  value: number
  color: string
}

function DonutChart({ segments, total }: { segments: Segment[]; total: number }) {
  const r = 70
  const cx = 110
  const cy = 110
  const circumference = 2 * Math.PI * r
  let offsetAngle = -90 // start at 12 o'clock

  return (
    <svg width={220} height={220} viewBox="0 0 220 220">
      {/* Background track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={28}
      />
      {segments.map((seg) => {
        const fraction = total > 0 ? seg.value / total : 0
        const dashLen = fraction * circumference
        const rotation = offsetAngle
        offsetAngle += fraction * 360

        return (
          <circle
            key={seg.name}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={28}
            strokeDasharray={`${dashLen} ${circumference}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation}, ${cx}, ${cy})`}
          />
        )
      })}
    </svg>
  )
}

export function DqRowDistribution({ file, dqReport }: DqRowDistributionProps) {
  const total = dqReport?.rows_in ?? file.rows_in ?? 0
  const clean = dqReport?.rows_clean ?? file.rows_clean ?? 0
  const fixed = dqReport?.rows_fixed ?? file.rows_fixed ?? 0
  const quarantined = dqReport?.rows_quarantined ?? file.rows_quarantined ?? 0

  const segments: Segment[] = [
    { name: "Clean", value: clean, color: "#22C55E" },
    { name: "Fixed", value: fixed, color: "#EAB308" },
    { name: "Quarantined", value: quarantined, color: "#EF4444" },
  ].filter((d) => d.value > 0)

  const pct = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0.0")

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <PieChartIcon className="w-4 h-4" />
        Row Distribution
      </h4>

      {segments.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">No data available</div>
      ) : (
        <div className="bg-muted/30 rounded-lg p-6">
          <div className="flex justify-center">
            <div className="relative" style={{ width: 220, height: 220 }}>
              <DonutChart segments={segments} total={total} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold leading-tight">{total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center flex-wrap gap-6 mt-4">
            {segments.map((item) => (
              <div key={item.name} className="flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {item.value.toLocaleString()} ({pct(item.value)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
