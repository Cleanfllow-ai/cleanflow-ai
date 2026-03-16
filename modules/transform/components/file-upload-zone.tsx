"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useAppDispatch, useAppSelector } from "@/shared/store/store"
import { setUploadedFileInfo, setError } from "@/modules/transform/store/transformSlice"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, X, CheckCircle } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export function FileUploadZone() {
  const dispatch = useAppDispatch()
  const { uploadedFileInfo, isLoading } = useAppSelector((state) => state.transform)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [localFile, setLocalFile] = useState<File | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        // Simulate upload progress
        setUploadProgress(0)
        const interval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 100) {
              clearInterval(interval)
              setLocalFile(file)
              dispatch(setUploadedFileInfo({ name: file.name, size: file.size, type: file.type }))
              return 100
            }
            return prev + 10
          })
        }, 100)

        dispatch(setError(null))
      }
    },
    [dispatch],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/json": [".json"],
      "application/octet-stream": [".parquet"],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  })

  const removeFile = () => {
    setLocalFile(null)
    dispatch(setUploadedFileInfo(null))
    setUploadProgress(0)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase()
    switch (extension) {
      case "csv":
        return "📊"
      case "xlsx":
      case "xls":
        return "📈"
      case "json":
        return "📄"
      case "parquet":
        return "🗃️"
      default:
        return "📁"
    }
  }

  if (uploadedFileInfo) {
    return (
      <Card className="hover:glow transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-2xl">{getFileIcon(uploadedFileInfo.name)}</span>
              </div>
              <div>
                <div className="font-medium text-foreground">{uploadedFileInfo.name}</div>
                <div className="text-sm text-muted-foreground">{formatFileSize(uploadedFileInfo.size)}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <Badge variant="outline" className="text-xs">
                    Ready to transform
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={removeFile}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200",
            isDragActive ? "border-primary bg-primary/5 glow" : "border-border hover:border-primary/50",
          )}
        >
          <input {...getInputProps()} />

          {uploadProgress > 0 && uploadProgress < 100 ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div>
                <div className="text-lg font-medium mb-2">Uploading...</div>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                <div className="text-sm text-muted-foreground mt-2">{uploadProgress.toFixed(2)}% complete</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <div className="text-lg font-medium mb-2">
                  {isDragActive ? "Drop your file here" : "Upload your ERP data file"}
                </div>
                <div className="text-sm text-muted-foreground mb-4">Drag and drop or click to select files</div>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {["CSV", "Excel", "JSON", "Parquet"].map((format) => (
                    <Badge key={format} variant="outline" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          Maximum file size: 100MB • Supported formats: CSV, Excel, JSON, Parquet
        </div>
      </CardContent>
    </Card>
  )
}
