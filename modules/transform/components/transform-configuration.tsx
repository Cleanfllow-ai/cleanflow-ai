"use client"

import { useState } from "react"
import { useAppDispatch, useAppSelector } from "@/shared/store/store"
import {
  setSelectedErp,
  setSelectedEntity,
  setAutoDetect,
  setLoading,
  setTransformResult,
  setError,
} from "@/modules/transform/store/transformSlice"
import { addActivity } from "@/modules/dashboard/store/dashboardSlice"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Play, Zap, Settings } from "lucide-react"

export function TransformConfiguration() {
  const dispatch = useAppDispatch()
  const { supportedErps, supportedEntities, selectedErp, selectedEntity, autoDetect, isLoading, uploadedFile } =
    useAppSelector((state) => state.transform)

  const [outputFormat, setOutputFormat] = useState("json")

  const handleTransform = async () => {
    if (!uploadedFile) return

    dispatch(setLoading(true))
    dispatch(setError(null))

    try {
      // Simulate transformation process
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000))

      const mockResult = {
        success: true,
        data: [
          {
            order_id: "SO1001",
            order_date: "2025-08-04",
            customer_id: "CUST01",
            total_amount: 1249.0,
            status: "confirmed",
            currency: "USD",
          },
          {
            order_id: "SO1002",
            order_date: "2025-08-04",
            customer_id: "CUST02",
            total_amount: 850.5,
            status: "pending",
            currency: "USD",
          },
        ],
        detected_erp: selectedErp || "NetSuite",
        detected_entity: selectedEntity || "sales_orders",
        transformation_mode: "template",
        confidence_score: 0.95,
        message: "Successfully transformed using template mapping",
        column_mappings: {
          tranId: "order_id",
          trandate: "order_date",
          entity: "customer_id",
          total: "total_amount",
        },
        row_count: 2,
        processing_time_ms: 1247.3,
      }

      dispatch(setTransformResult(mockResult))
      dispatch(
        addActivity({
          id: Date.now().toString(),
          type: "transform",
          status: "success",
          timestamp: new Date().toISOString(),
          details: `${uploadedFile.name} transformed successfully`,
        }),
      )
    } catch (error) {
      dispatch(setError("Transformation failed. Please try again."))
      dispatch(
        addActivity({
          id: Date.now().toString(),
          type: "transform",
          status: "error",
          timestamp: new Date().toISOString(),
          details: `Failed to transform ${uploadedFile.name}`,
        }),
      )
    } finally {
      dispatch(setLoading(false))
    }
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Transform Configuration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Auto-Detection</Label>
            <div className="text-xs text-muted-foreground">Automatically detect ERP system and entity type</div>
          </div>
          <Switch checked={autoDetect} onCheckedChange={(checked) => dispatch(setAutoDetect(checked))} />
        </div>

        <Separator />

        {!autoDetect && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ERP System</Label>
              <Select value={selectedErp || ""} onValueChange={(value) => dispatch(setSelectedErp(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ERP system" />
                </SelectTrigger>
                <SelectContent>
                  {supportedErps.map((erp) => (
                    <SelectItem key={erp} value={erp}>
                      {erp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={selectedEntity || ""} onValueChange={(value) => dispatch(setSelectedEntity(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {supportedEntities.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {entity.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Output Format</Label>
          <Select value={outputFormat} onValueChange={setOutputFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
              <SelectItem value="parquet">Parquet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              <Zap className="w-3 h-3 mr-1" />
              High Performance
            </Badge>
            <Badge variant="outline" className="text-xs">
              Template Mapping
            </Badge>
          </div>

          <Button onClick={handleTransform} disabled={isLoading} className="glow">
            <Play className="w-4 h-4 mr-2" />
            {isLoading ? "Transforming..." : "Transform Data"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
