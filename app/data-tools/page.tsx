"use client"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<'upload' | 'processing' | 'complete'>('upload')
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null)
  const [availableERPs, setAvailableERPs] = useState<string[]>([])
  const [availableEntities, setAvailableEntities] = useState<string[]>([])
  const [supportedFormats, setSupportedFormats] = useState<string[]>([])
  const [analysisResults, setAnalysisResults] = useState<AnalyzeResponse | null>(null)
  const [validationResults, setValidationResults] = useState<ValidateResponse | null>(null)
  const [transformResults, setTransformResults] = useState<TransformResponse | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<'auto' | 'manual'>('auto')
  const [outputFormat, setOutputFormat] = useState<string>('csv')
  const [selectedERP, setSelectedERP] = useState<string>('')
  const [selectedEntity, setSelectedEntity] = useState<string>('')
  const [showAllERPs, setShowAllERPs] = useState(false)
  const [showAllEntities, setShowAllEntities] = useState(false)
  const [showAllFormats, setShowAllFormats] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    loadAPIInfo()
  }, [])
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
        toast({ title: "Connected", description: `Connected to ${health.engine}`, variant: "default" })
      } else {
        toast({ title: "API Offline", description: "API server unavailable.", variant: "destructive" })
      }
    } catch (err) {
      setApiHealth({ status: 'offline', engine: 'unavailable' })
      setError('API server is not available.')
      toast({ title: "Connection Failed", description: "Unable to connect to API server.", variant: "destructive" })
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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast({ title: "File Too Large", description: "Please select a file smaller than 10MB.", variant: "destructive" })
        return
      }
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (fileExtension && !supportedFormats.includes(fileExtension)) {
        toast({ title: "Unsupported File Type", description: `Allowed formats: ${supportedFormats.join(', ')}`, variant: "destructive" })
        return
      }
      setSelectedFile(file)
      resetState()
      toast({ title: "File Selected", description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, variant: "default" })
    } else {
      setSelectedFile(null)
      resetState()
    }
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast({ title: "File Too Large", description: "Please select a file smaller than 10MB.", variant: "destructive" })
        return
      }
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (fileExtension && !supportedFormats.includes(fileExtension)) {
        toast({ title: "Unsupported File Type", description: `Allowed formats: ${supportedFormats.join(', ')}`, variant: "destructive" })
        return
      }
      setSelectedFile(file)
      resetState()
      toast({ title: "File Dropped", description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, variant: "default" })
    }
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const simulateProgress = (callback: () => Promise<void>, duration = 3000) => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) { clearInterval(interval); callback(); return 100 }
        return prev + Math.random() * 10
      })
    }, duration / 20)
  }
  const formatEntityName = (entity: string | null | undefined) => {
    if (!entity) return 'Unknown'
    return entity.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
  const handleQuickAnalysis = async () => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please select a file before running analysis.", variant: "destructive" })
      return
    }
    setLoading(true)
    setError(null)
    setCurrentStep('processing')
    toast({ title: "Analysis Started", description: `Analyzing ${selectedFile.name}...`, variant: "default" })
    try {
      simulateProgress(async () => {
        try {
          const [analysis, validation] = await Promise.all([
            erpTransformAPI.analyzeFile(selectedFile!),
            erpTransformAPI.validateFile(selectedFile!)
          ])
          setAnalysisResults(analysis)
          setValidationResults(validation)
          toast({ title: "Analysis Complete", description: `Successfully analyzed ${selectedFile!.name} with ${analysis.erp_entity_suggestions.length} suggestions.`, variant: "default" })
        } catch (apiError) {
          const errorMessage = apiError instanceof Error ? apiError.message : 'Analysis failed'
          setError(errorMessage)
          setLoading(false)
          setCurrentStep('upload')
          toast({ title: "Analysis Failed", description: errorMessage, variant: "destructive" })
        }
        setLoading(false)
        setCurrentStep('complete')
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      setError(errorMessage)
      setLoading(false)
      setCurrentStep('upload')
      toast({ title: "Analysis Failed", description: errorMessage, variant: "destructive" })
    }
  }
  const handleTransform = async (mode: 'download' | 'json' = 'json') => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please select a file before transforming.", variant: "destructive" })
      return
    }
    if (transformMode === 'manual' && (!selectedERP || !selectedEntity)) {
      toast({ title: "Missing Selection", description: "Select both ERP and Entity for manual mode.", variant: "destructive" })
      return
    }
    setLoading(true)
    setError(null)
    setCurrentStep('processing')
    toast({ title: "Transformation Started", description: `Transforming ${selectedFile.name}...`, variant: "default" })
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
        toast({ title: "Download Ready", description: "Your transformed file is ready.", variant: "default" })
      } else {
        const result = await erpTransformAPI.transformFile(selectedFile!, options)
        setTransformResults(result)
        toast({ title: "Transformation Complete", description: `Transformed ${result.row_count} rows successfully!`, variant: "default" })
      }
      setLoading(false)
      setCurrentStep('complete')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transformation failed'
      setError(errorMessage)
      setLoading(false)
      setCurrentStep('upload')
      toast({ title: "Transformation Failed", description: errorMessage, variant: "destructive" })
    }
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
      toast({ title: "Download Started", description: `Downloading ${fileName}...`, variant: "default" })
    } else {
      toast({ title: "Download Failed", description: "No file available for download.", variant: "destructive" })
    }
  }
  const getRecommendation = () => {
    if (analysisResults?.erp_entity_suggestions?.[0]) {
      const suggestion = analysisResults.erp_entity_suggestions[0]
      return { erp: suggestion.erp, entity: suggestion.entity, confidence: Math.round(suggestion.confidence * 100) }
    }
    return null
  }
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
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-sans text-xl font-bold tracking-tight text-foreground">
                  ERP Data Transformation
                </h1>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium mt-0.5"
                >
                  Convert ERP data to Common Data Frame format
                </p>
              </div>
            </div>
            {apiHealth && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                apiHealth.status === 'healthy'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-destructive/20 bg-destructive/5'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  apiHealth.status === 'healthy' ? 'bg-emerald-500' : 'bg-destructive'
                }`} />
                <span className={`text-[11px] font-medium ${
                  apiHealth.status === 'healthy' ? 'text-emerald-500' : 'text-destructive'
                }`}
                >
                  {apiHealth.status === 'healthy' ? `Connected — ${apiHealth.engine}` : 'Offline'}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Panel */}
            <div className="lg:col-span-2 space-y-5">
              {/* File Upload Zone */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4 text-primary" />
                    Upload ERP File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center transition-all cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02]"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">
                      {selectedFile ? selectedFile.name : 'Drop your file here or click to browse'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">CSV, Excel, JSON, SQL, Parquet — up to 10 MB</p>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.json,.sql,.parquet" onChange={handleFileChange} className="hidden" />
                  </div>
                  {selectedFile && (
                    <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <Button onClick={handleQuickAnalysis} size="sm" className="h-7 text-xs">
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Analyze
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Configuration */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Transformation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Mode</Label>
                      <Select value={transformMode} onValueChange={v => setTransformMode(v as 'auto' | 'manual')}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto-detect (Recommended)</SelectItem>
                          <SelectItem value="manual">Manual selection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Output Format</Label>
                      <Select value={outputFormat} onValueChange={setOutputFormat}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {supportedFormats.map(format => (
                            <SelectItem key={format} value={format}>{format.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {transformMode === 'manual' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">ERP System</Label>
                        <Select value={selectedERP} onValueChange={setSelectedERP}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select ERP" /></SelectTrigger>
                          <SelectContent>
                            {availableERPs.map(erp => (
                              <SelectItem key={erp} value={erp}>{erp}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Entity Type</Label>
                        <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select Entity" /></SelectTrigger>
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
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleTransform('json')}
                  disabled={!selectedFile || loading || (transformMode === 'manual' && (!selectedERP || !selectedEntity))}
                  className="flex-1 h-10"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Transform
                </Button>
                <Button
                  onClick={() => handleTransform('download')}
                  disabled={!selectedFile || loading || (transformMode === 'manual' && (!selectedERP || !selectedEntity))}
                  variant="outline"
                  className="flex-1 h-10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Transform & Download
                </Button>
              </div>
              {/* Processing */}
              {loading && (
                <Card className="border-primary/20 bg-primary/[0.02]">
                  <CardContent className="py-5">
                    <div className="flex items-center justify-center gap-2.5 mb-3">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <span className="text-sm font-medium text-foreground"
                      >
                        Processing...
                      </span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-center mt-2 font-mono tabular-nums">
                      {Math.round(progress)}%
                    </p>
                  </CardContent>
                </Card>
              )}
              {/* Error */}
              {error && (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-destructive">Error</h4>
                        <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            {/* Right Panel — Results */}
            <div className="space-y-5">
              {analysisResults && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    >
                      File Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                        <div className="text-lg font-bold text-primary font-mono tabular-nums">
                          {analysisResults.column_info.row_count}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium">Rows</div>
                      </div>
                      <div className="p-3 rounded-lg bg-accent/5 border border-accent/10 text-center">
                        <div className="text-lg font-bold text-accent font-mono tabular-nums">
                          {analysisResults.column_info.column_count}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-medium">Columns</div>
                      </div>
                    </div>
                    {(() => {
                      const recommendation = getRecommendation();
                      return recommendation && (
                        <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-500">Recommendation</span>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ERP</span>
                              <span className="font-medium text-foreground">{recommendation.erp}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Entity</span>
                              <span className="font-medium text-foreground">{formatEntityName(recommendation.entity)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Confidence</span>
                              <span className="font-mono tabular-nums font-semibold text-emerald-500">{recommendation.confidence}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
              {validationResults && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    >
                      Validation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`p-3 rounded-lg border ${
                      validationResults.valid
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-destructive/20 bg-destructive/5'
                    }`}>
                      <div className="flex items-center gap-2">
                        {validationResults.valid ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className={`text-xs font-semibold ${
                          validationResults.valid ? 'text-emerald-500' : 'text-destructive'
                        }`}>
                          {validationResults.valid ? 'Valid structure' : 'Issues found'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{validationResults.message}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {transformResults && (
                <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-emerald-500"
                    >
                      Transformation Complete
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center py-2">
                      <div className="text-3xl font-bold font-mono tabular-nums text-emerald-500">
                        {transformResults.row_count}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mt-1">Records Transformed</div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ERP</span>
                        <span className="font-medium text-foreground">{transformResults.detected_erp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entity</span>
                        <span className="font-medium text-foreground">{formatEntityName(transformResults.detected_entity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-mono tabular-nums text-foreground">{transformResults.processing_time_ms}ms</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {downloadUrl && (
                <Card className="border-primary/20">
                  <CardContent className="p-4">
                    <Button onClick={downloadFile} className="w-full h-9">
                      <Download className="w-4 h-4 mr-2" />
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
