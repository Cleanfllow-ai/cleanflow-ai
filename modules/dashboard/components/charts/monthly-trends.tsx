"use client"

import type { FileStatusResponse } from "@/modules/files"

import { MonthlyTrendsCompact } from "@/modules/dashboard/components/monthly-trends-compact"

interface MonthlyTrendsProps {
  files: FileStatusResponse[]
}

export function MonthlyTrends({ files }: MonthlyTrendsProps) {
  return <MonthlyTrendsCompact files={files} />
}

