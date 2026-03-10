"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const data = [
  { erp: "NetSuite", avgTime: 245, count: 1200 },
  { erp: "SAP ERP", avgTime: 312, count: 980 },
  { erp: "Dynamics", avgTime: 189, count: 850 },
  { erp: "Oracle", avgTime: 278, count: 720 },
  { erp: "Workday", avgTime: 156, count: 650 },
  { erp: "Infor", avgTime: 203, count: 420 },
]

export function PerformanceChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance by ERP System</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            avgTime: {
              label: "Avg Processing Time (ms)",
              color: "hsl(var(--chart-3))",
            },
            count: {
              label: "Transformations",
              color: "hsl(var(--chart-4))",
            },
          }}
          className="h-[250px] sm:h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="erp"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={60} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="avgTime" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
