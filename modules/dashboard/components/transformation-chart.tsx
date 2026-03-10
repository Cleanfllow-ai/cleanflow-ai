"use client"

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const data = [
  { name: "Jan", transformations: 1200, success: 1140 },
  { name: "Feb", transformations: 1900, success: 1824 },
  { name: "Mar", transformations: 2400, success: 2304 },
  { name: "Apr", transformations: 2100, success: 2016 },
  { name: "May", transformations: 2800, success: 2688 },
  { name: "Jun", transformations: 3200, success: 3072 },
  { name: "Jul", transformations: 3600, success: 3456 },
]

export function TransformationChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transformation Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            transformations: {
              label: "Total Transformations",
              color: "hsl(var(--chart-1))",
            },
            success: {
              label: "Successful",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[250px] sm:h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="transformations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="success" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={60} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="transformations"
                stroke="hsl(var(--chart-1))"
                fillOpacity={1}
                fill="url(#transformations)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="success"
                stroke="hsl(var(--chart-2))"
                fillOpacity={1}
                fill="url(#success)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
