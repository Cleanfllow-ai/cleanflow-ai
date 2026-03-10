"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Database, Download, Zap } from "lucide-react"
import { fadeInUp, staggerContainer } from "@/components/ui/motion"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { motion } from "framer-motion"
import { useAppSelector } from "@/shared/store/store"

export function TransformResults() {
  const { transformResult } = useAppSelector((state) => state.transform)

  if (!transformResult) return null

  const handleDownload = (format: string) => {
    // Simulate download
    const blob = new Blob([JSON.stringify(transformResult.data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transformed_data.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="hover:shadow-lg transition-all duration-300 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
              >
                <CheckCircle className="w-5 h-5 text-green-500" />
              </motion.div>
              <span>Transformation Complete</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <motion.div
              className="grid grid-cols-2 gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={fadeInUp} className="space-y-1">
                <div className="text-sm text-muted-foreground">Detected ERP</div>
                <Badge variant="outline">{transformResult.detected_erp}</Badge>
              </motion.div>
              <motion.div variants={fadeInUp} className="space-y-1">
                <div className="text-sm text-muted-foreground">Entity Type</div>
                <Badge variant="outline">{transformResult.detected_entity}</Badge>
              </motion.div>
            </motion.div>

            <Separator />

            <motion.div
              className="grid grid-cols-2 gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={fadeInUp} className="space-y-1">
                <div className="text-sm text-muted-foreground">Records</div>
                <div className="text-lg font-semibold">{transformResult.row_count}</div>
              </motion.div>
              <motion.div variants={fadeInUp} className="space-y-1">
                <div className="text-sm text-muted-foreground">Processing Time</div>
                <div className="text-lg font-semibold">{transformResult.processing_time_ms}ms</div>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeInUp} className="space-y-1">
              <div className="text-sm text-muted-foreground">Confidence Score</div>
              <div className="flex items-center space-x-2">
                <div className="text-lg font-semibold">{(transformResult.confidence_score * 100).toFixed(1)}%</div>
                <Badge variant={transformResult.confidence_score > 0.8 ? "default" : "secondary"} className="text-xs">
                  {transformResult.confidence_score > 0.8 ? "High" : "Medium"}
                </Badge>
              </div>
            </motion.div>

            <Separator />

            <motion.div variants={fadeInUp} className="space-y-2">
              <div className="text-sm font-medium">Download Options</div>
              <div className="flex flex-wrap gap-2">
                {["json", "csv", "excel", "parquet"].map((format, index) => (
                  <motion.div
                    key={format}
                    variants={fadeInUp}
                    custom={index}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button variant="outline" size="sm" onClick={() => handleDownload(format)}>
                      <Download className="w-3 h-3 mr-1" />
                      {format.toUpperCase()}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Column Mappings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {Object.entries(transformResult.column_mappings || {}).map(([source, target], index) => (
                  <motion.div
                    key={source}
                    variants={fadeInUp}
                    custom={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <span className="text-sm font-medium">{source}</span>
                    <span className="text-sm text-muted-foreground">→</span>
                    <span className="text-sm">{String(target)}</span>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Preview Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-60">
              <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(transformResult.data.slice(0, 3), null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
