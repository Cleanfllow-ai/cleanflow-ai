"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, Download, Settings, Zap } from "lucide-react"

export function TransformHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Data Transformation</h1>
        <p className="text-muted-foreground">Upload and transform your ERP data into standardized CDF format</p>
      </div>

      <div className="flex items-center space-x-3">
        <Badge variant="outline" className="pulse-glow">
          <Zap className="w-3 h-3 mr-1" />
          Polars + DuckDB
        </Badge>

        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Templates
        </Button>

        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Batch Export
        </Button>

        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  )
}
