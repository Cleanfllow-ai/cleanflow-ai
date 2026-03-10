"use client"

import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Info,
  Settings,
  Sparkles,
  Upload,
  Zap
} from "lucide-react"
import type { AnalyzeResponse, HealthResponse, TransformResponse, ValidateResponse } from "@/modules/transform"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import React, { useEffect, useRef, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MainLayout } from "@/shared/layout/main-layout"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { erpTransformAPI } from "@/modules/transform"
import { useToast } from "@/shared/hooks/use-toast"
import { AuthGuard } from "@/modules/auth"

export default function DataToolsPage() {
  const { toast } = useToast()
  
  // Core state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'complete'>('upload')
  
  // API information
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null)
  const [availableERPs, setAvailableERPs] = useState<string[]>([])
  const [availableEntities, setAvailableEntities] = useState<string[]>([])
  const [supportedFormats, setSupportedFormats] = useState<string[]>([])
  
  // Results
  const [analysisResults, setAnalysisResults] = useState<AnalyzeResponse | null>(null)
  const [validationResults, setValidationResults] = useState<ValidateResponse | null>(null)
  const [transformResults, setTransformResults] = useState<TransformResponse | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  
  // Configuration
  const [transformMode, setTransformMode] = useState<'auto' | 'manual'>('auto')
  const [outputFormat, setOutputFormat] = useState<string>('csv')
  const [selectedERP, setSelectedERP] = useState<string>('')
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  
  // Badge display state
  const [showAllERPs, setShowAllERPs] = useState(false)
  const [showAllEntities, setShowAllEntities] = useState(false)
  const [showAllFormats, setShowAllFormats] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load API info on mount
  useEffect(() => {
    loadAPIInfo()
  }, [])

  // --- API info loading ---
  const loadAPIInfo = async () => {
    try {
      const [health, erps, entities, formats] = await Promise.all([
        erpTransformAPI.getHealth(),
        erpTransformAPI.getERPs(),
        erpTransformAPI.getEntities(),
        erpTransformAPI.getFormats()
      ])
      setApiHealth(health as HealthResponse)
      setAvailableERPs(erps)
      setAvailableEntities(entities)
      setSupportedFormats(formats)
      if (health.status === 'healthy') {
        toast({
          title: "Connected",
          description: `Connected to ${health.engine}`,
          variant: "default",
        })
      } else {
        toast({
          title: "API Offline",
          description: "API server unavailable.",
          variant: "destructive",
        })
      }
    } catch (err) {
      setApiHealth({ status: 'offline', engine: 'unavailable' })
      setError('API server is not available.')
      toast({
        title: "Connection Failed",
        description: "Unable to connect to API server.",
        variant: "destructive",
      })
    }
  }

  const resetState = () => {
    setAnalysisResults(null)
    setValidationResults(null)
    setTransformResults(null)
    setDownloadUrl(null)
    setError(null)
    setProgress(0)
    setCurrentStep('upload')
  }

  // --- File change ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        })
        return
      }

      // Check file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (fileExtension && !supportedFormats.includes(fileExtension)) {
        toast({
          title: "Unsupported File Type",
          description: `Allowed formats: ${supportedFormats.join(', ')}`,
          variant: "destructive",
        })
        return
      }

      setSelectedFile(file)
      resetState()
      
      toast({
        title: "File Selected",
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        variant: "default",
      })
    } else {
      setSelectedFile(null)
      resetState()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        })
        return
      }

      // Check file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (fileExtension && !supportedFormats.includes(fileExtension)) {
        toast({
          title: "Unsupported File Type",
          description: `Allowed formats: ${supportedFormats.join(', ')}`,
          variant: "destructive",
        })
        return
      }

      setSelectedFile(file)
      resetState()
      
      toast({
        title: "File Dropped",
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        variant: "default",
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const simulateProgress = (callback: () => Promise<void>, duration = 3000) => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval)
          callback()
          return 100
        }
        return prev + Math.random() * 10
      })
    }, duration / 20)
  }

  const formatEntityName = (entity: string | null | undefined) => {
    if (!entity) return 'Unknown'
    return entity.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Quick Analysis
  const handleQuickAnalysis = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file before running analysis.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)
    setCurrentStep('processing')

    toast({
      title: "Analysis Started",
      description: `Analyzing ${selectedFile.name}...`,
      variant: "default",
    })

    try {
      simulateProgress(async () => {
        try {
          const [analysis, validation] = await Promise.all([
            erpTransformAPI.analyzeFile(selectedFile!),
            erpTransformAPI.validateFile(selectedFile!)
          ])
          
          setAnalysisResults(analysis)
          setValidationResults(validation)
          
          toast({
            title: "Analysis Complete",
            description: `Successfully analyzed ${selectedFile!.name} with ${analysis.erp_entity_suggestions.length} suggestions.`,
            variant: "default",
          })
        } catch (apiError) {
          const errorMessage = apiError instanceof Error ? apiError.message : 'Analysis failed'
          setError(errorMessage)
          setLoading(false)
          setCurrentStep('upload')
          
          toast({
            title: "Analysis Failed",
            description: errorMessage,
            variant: "destructive",
          })
        }
        
        setLoading(false)
        setCurrentStep('complete')
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      setError(errorMessage)
      setLoading(false)
      setCurrentStep('upload')
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Transform with different modes
  const handleTransform = async (mode: 'download' | 'json' = 'json') => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file before transforming.",
        variant: "destructive",
      })
      return
    }

    if (transformMode === 'manual' && (!selectedERP || !selectedEntity)) {
      toast({
        title: "Missing Selection",
        description: "Select both ERP and Entity for manual mode.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)
    setCurrentStep('processing')

    toast({
      title: "Transformation Started",
      description: `Transforming ${selectedFile.name}...`,
      variant: "default",
    })

    try {
      const options = {
        auto_select_erp: transformMode !== 'manual',
        auto_select_entity: transformMode !== 'manual',
        ...(transformMode === 'manual' && selectedERP && { erp: selectedERP }),
        ...(transformMode === 'manual' && selectedEntity && { entity: selectedEntity }),
        output_format: outputFormat
      }

      if (mode === 'download') {
        const blob = await erpTransformAPI.transformFileDownload(selectedFile!, options)
        const url = URL.createObjectURL(blob)
        setDownloadUrl(url)
        
        toast({
          title: "Download Ready",
          description: "Your transformed file is ready.",
          variant: "default",
        })
      } else {
        const result = await erpTransformAPI.transformFile(selectedFile!, options)
        setTransformResults(result)
        
        toast({
          title: "Transformation Complete",
          description: `Transformed ${result.row_count} rows successfully!`,
          variant: "default",
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transformation failed'
      setError(errorMessage)
      setLoading(false)
      setCurrentStep('upload')
      
      toast({
        title: "Transformation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
    
    setLoading(false)
    setCurrentStep('complete')
  }

  const downloadFile = () => {
    if (downloadUrl && selectedFile) {
      const fileName = `transformed_${selectedFile.name.split('.')[0]}.${outputFormat}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast({
        title: "Download Started",
        description: `Downloading ${fileName}...`,
        variant: "default",
      })
    } else {
      toast({
        title: "Download Failed",
        description: "No file available for download.",
        variant: "destructive",
      })
    }
  }

  const getRecommendation = () => {
    if (analysisResults?.erp_entity_suggestions?.[0]) {
      const suggestion = analysisResults.erp_entity_suggestions[0]
      return {
        erp: suggestion.erp,
        entity: suggestion.entity,
        confidence: Math.round(suggestion.confidence * 100)
      }
    }
    return null
  }

  // Helper functions for badge displays
  const getDisplayERPs = () => {
    const maxShow = 5
    const erps = showAllERPs ? availableERPs : availableERPs.slice(0, maxShow)
    const hasMore = availableERPs.length > maxShow
    return { erps, hasMore }
  }

  const getDisplayEntities = () => {
    const maxShow = 5
    const entities = showAllEntities ? availableEntities : availableEntities.slice(0, maxShow)
    const hasMore = availableEntities.length > maxShow
    return { entities, hasMore }
  }

  const getDisplayFormats = () => {
    const maxShow = 5
    const formats = showAllFormats ? supportedFormats : supportedFormats.slice(0, maxShow)
    const hasMore = supportedFormats.length > maxShow
    return { formats, hasMore }
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="container mx-auto p-6 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ERP Data Transformation</h1>
                <p className="text-gray-600 mt-2">
                  Easily convert your ERP data to Common Data Frame (CDF) format. Just upload your file and let us do the rest!
              </p>
            </div>
            {apiHealth && (
              <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm font-medium text-green-700">
                  {apiHealth.status === 'healthy' ? `Connected to ${apiHealth.engine}` : 'API Offline'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Upload & Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Upload your ERP file</h2>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors hover:border-blue-500 cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{selectedFile ? selectedFile.name : 'Click or drag your file here'}</h3>
                  <p className="text-gray-500 text-sm mb-2">Supported formats: CSV, Excel, JSON, SQL, Parquet</p>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.json,.sql,.parquet" onChange={handleFileChange} className="hidden" />
                </div>
                {selectedFile && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-blue-900">{selectedFile.name}</span>
                      <span className="text-sm text-blue-700">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      <Button onClick={handleQuickAnalysis} size="sm" className="bg-blue-600 hover:bg-blue-700">Analyze</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Configuration */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Transformation Settings</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Transformation Mode</Label>
                    <Select value={transformMode} onValueChange={v => setTransformMode(v as 'auto' | 'manual')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-detect (Recommended)</SelectItem>
                        <SelectItem value="manual">Manual selection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Output Format</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {supportedFormats.map(format => (
                          <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {transformMode === 'manual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <Label>ERP System</Label>
                      <Select value={selectedERP} onValueChange={setSelectedERP}>
                        <SelectTrigger><SelectValue placeholder="Select ERP" /></SelectTrigger>
                        <SelectContent>
                          {availableERPs.map(erp => (
                            <SelectItem key={erp} value={erp}>{erp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Entity Type</Label>
                      <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                        <SelectTrigger><SelectValue placeholder="Select Entity" /></SelectTrigger>
                        <SelectContent>
                          {availableEntities.map(entity => (
                            <SelectItem key={entity} value={entity}>{formatEntityName(entity)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Transform Actions */}
            <Card>
              <CardContent className="p-6 text-center">
                <Button
                  onClick={() => handleTransform('json')}
                  disabled={!selectedFile || loading || (transformMode === 'manual' && (!selectedERP || !selectedEntity))}
                  className="w-40"
                >
                  Transform
                </Button>
                <Button
                  onClick={() => handleTransform('download')}
                  disabled={!selectedFile || loading || (transformMode === 'manual' && (!selectedERP || !selectedEntity))}
                  variant="outline"
                  className="w-40 ml-4"
                >
                  Download
                </Button>
              </CardContent>
            </Card>
            {loading && (
              <Card className="mt-2">
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></span>
                    <span className="text-blue-700 font-medium">Processing your file...</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>
            )}
            {error && (
              <Card className="mt-2 border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900">Error</h4>
                      <p className="text-red-700 text-sm mt-1">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          {/* Right Panel - Results */}
          <div className="space-y-6">
            {analysisResults && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">File Analysis</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-700">{analysisResults.column_info.row_count}</div>
                      <div className="text-xs text-blue-600">Rows</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-700">{analysisResults.column_info.column_count}</div>
                      <div className="text-xs text-green-600">Columns</div>
                    </div>
                  </div>
                  {/* ERP/Entity Recommendation */}
                  {(() => {
                    const recommendation = getRecommendation();
                    return recommendation && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-emerald-800">Recommended ERP:</span>
                          <span className="font-medium text-emerald-800">{recommendation.erp}</span>
                          <span className="font-medium text-emerald-800">Entity:</span>
                          <span className="font-medium text-emerald-800">{formatEntityName(recommendation.entity)}</span>
                        </div>
                        <div className="text-xs text-emerald-600 mt-1">{recommendation.confidence}% confidence</div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
            {validationResults && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Validation</h2>
                </CardHeader>
                <CardContent>
                  <div className={`p-3 rounded-lg border ${validationResults.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                      {validationResults.valid ? (
                        <span className="w-4 h-4 bg-green-600 rounded-full inline-block"></span>
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-sm font-medium ${validationResults.valid ? 'text-green-800' : 'text-red-800'}`}>{validationResults.valid ? 'Valid file structure' : 'Issues found'}</span>
                    </div>
                    <p className={`text-xs mt-1 ${validationResults.valid ? 'text-green-700' : 'text-red-700'}`}>{validationResults.message}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {transformResults && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Transformation Success</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-700">{transformResults.row_count}</div>
                    <div className="text-sm text-green-600">Records transformed</div>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">ERP:</span><span className="font-medium">{transformResults.detected_erp}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Entity:</span><span className="font-medium">{formatEntityName(transformResults.detected_entity)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Time:</span><span className="font-medium">{transformResults.processing_time_ms}ms</span></div>
                  </div>
                </CardContent>
              </Card>
            )}
            {downloadUrl && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">Download Ready</h2>
                </CardHeader>
                <CardContent>
                  <Button onClick={downloadFile} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    Download {outputFormat.toUpperCase()}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
    </AuthGuard>
  )
}
