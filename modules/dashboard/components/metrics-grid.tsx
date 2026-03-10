"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, TrendingDown, TrendingUp, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useAppSelector } from "@/shared/store/store"

export function MetricsGrid() {
  const { totalTransformations, successRate, activeConnections } = useAppSelector((state) => state.dashboard)

  const metrics = [
    {
      title: "Total Transformations",
      value: totalTransformations.toLocaleString(),
      change: "+12.5%",
      trend: "up" as const,
      icon: Database,
      color: "text-chart-1",
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      change: "+2.1%",
      trend: "up" as const,
      icon: TrendingUp,
      color: "text-chart-2",
    },
    {
      title: "Active Connections",
      value: activeConnections.toString(),
      change: "-1.2%",
      trend: "down" as const,
      icon: Users,
      color: "text-chart-3",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {metrics.map((metric) => (
        <article key={metric.title}>
          <Card className="h-full border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
                <span>{metric.title}</span>
                <Badge
                  variant={metric.trend === "up" ? "default" : "secondary"}
                  className="text-[10px] font-medium"
                >
                  {metric.trend === "up" ? "↑" : "↓"} {metric.change}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">{metric.value}</div>
              <p className="text-xs text-muted-foreground">Compared to last month</p>
            </CardContent>
          </Card>
        </article>
      ))}
    </div>
  )
}
