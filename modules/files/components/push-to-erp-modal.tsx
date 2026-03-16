'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import quickBooksAPI from '@/modules/quickbooks/api/quickbooks-api'
import zohoBooksAPI from '@/modules/zoho/api/zoho-books-api'
import erpConnectorAPI from '@/modules/files/api/erp-connector-api'
import { useMultiEntityExport } from '@/modules/files/hooks/use-multi-entity-export'
import type { FileStatusResponse } from '@/modules/files/api/file-management-api'

interface ERPOption {
  value: string
  label: string
  description: string
  available: boolean
  multiEntity?: boolean   // true = uses new multi-entity flow
  provider?: string
}

const ERP_OPTIONS: ERPOption[] = [
  { value: 'quickbooks', label: 'QuickBooks Online', description: 'Push directly to your connected QuickBooks account', available: true, multiEntity: true },
  { value: 'zoho-books', label: 'Zoho Books', description: 'Push directly to your connected Zoho Books account', available: true, multiEntity: true },
  { value: 'netsuite', label: 'NetSuite', description: 'Push to Oracle NetSuite', available: true, provider: 'netsuite' },
  { value: 'dynamics', label: 'Microsoft Dynamics', description: 'Export to Dynamics 365', available: true, provider: 'microsoft_dynamics' },
  { value: 'oracle', label: 'Oracle Fusion', description: 'Export to Oracle ERP Cloud', available: false },
  { value: 'sap', label: 'SAP ERP', description: 'Push to SAP S/4HANA or Business One', available: false },
  { value: 'workday', label: 'Workday', description: 'Export to Workday Financial Management', available: false },
  { value: 'sage', label: 'Sage Intacct', description: 'Push to Sage Intacct Cloud ERP', available: false },
  { value: 'epicor', label: 'Epicor Kinetic', description: 'Export to Epicor ERP', available: false },
]

interface PushToERPModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileStatusResponse | null
  onSuccess?: () => void
  onError?: (error: string) => void
}

// ─── Entity progress row ────────────────────────────────────────────────────

function EntityProgressRow({
  entity,
  status,
  success,
  failed,
}: {
  entity: string
  status: 'pending' | 'running' | 'done' | 'failed'
  success: number
  failed: number
}) {
  const label = entity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
      {status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />}
      {status === 'failed' && <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
      {status === 'pending' && <span className="h-4 w-4 shrink-0" />}
      <span className={status === 'failed' ? 'text-red-700' : status === 'done' ? 'text-green-700' : 'text-muted-foreground'}>
        {label}
      </span>
      {status === 'done' && <span className="text-xs text-muted-foreground ml-auto">({success} exported)</span>}
      {status === 'running' && <span className="text-xs text-muted-foreground ml-auto">exporting…</span>}
      {status === 'failed' && <span className="text-xs text-red-600 ml-auto">({failed} failed)</span>}
      {status === 'pending' && <span className="text-xs text-muted-foreground ml-auto">waiting</span>}
    </div>
  )
}

// ─── Multi-entity summary card ──────────────────────────────────────────────

function MultiEntitySummaryCard({
  entities,
  mappedCount,
  unmappedColumns,
  onViewMapping,
}: {
  entities: string[]
  mappedCount: number
  unmappedColumns: string[]
  onViewMapping: () => void
}) {
  const chain = entities
    .map(e => e.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
    .join(' → ')

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
      <p className="text-sm font-medium text-muted-foreground">{chain}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="gap-1 text-green-700 bg-green-50">
          <CheckCircle2 className="h-3 w-3" />
          {mappedCount} mapped
        </Badge>
        {unmappedColumns.length > 0 && (
          <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-50">
            <AlertCircle className="h-3 w-3" />
            {unmappedColumns.length} unmapped
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-6 px-2 ml-auto"
          onClick={onViewMapping}
        >
          <Eye className="h-3 w-3 mr-1" />
          View Mapping
        </Button>
      </div>
    </div>
  )
}

// ─── View Mapping drawer ────────────────────────────────────────────────────

function ViewMappingDrawer({
  open,
  onOpenChange,
  resolutions,
  unmappedColumns,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  resolutions: Array<{ column: string; entity: string; cdf_field: string }>
  unmappedColumns: string[]
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Column Mapping</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          {resolutions.map(r => (
            <div key={r.column} className="grid grid-cols-2 gap-2 text-sm py-1 border-b last:border-0">
              <span className="text-muted-foreground truncate">{r.column}</span>
              <span className="font-medium truncate">
                {r.entity}.{r.cdf_field}
              </span>
            </div>
          ))}
          {unmappedColumns.map(col => (
            <div key={col} className="grid grid-cols-2 gap-2 text-sm py-1 border-b last:border-0">
              <span className="text-amber-600 truncate">{col}</span>
              <span className="text-muted-foreground italic text-xs">unmapped</span>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function PushToERPModal({
  open,
  onOpenChange,
  file,
  onSuccess,
  onError,
}: PushToERPModalProps) {
  const [selectedERP, setSelectedERP] = useState<string>('quickbooks')
  const [connectionChecked, setConnectionChecked] = useState<Record<string, boolean | null>>({})
  const [mappingOpen, setMappingOpen] = useState(false)

  // Legacy single-entity path for non-multi-entity ERPs
  const [legacyPushing, setLegacyPushing] = useState(false)
  const [legacyResult, setLegacyResult] = useState<{ success: boolean; message: string } | null>(null)
  const [legacyError, setLegacyError] = useState<string | null>(null)
  const [legacyStatus, setLegacyStatus] = useState<string>('')

  const selectedOption = ERP_OPTIONS.find(o => o.value === selectedERP)
  const isMultiEntity = selectedOption?.multiEntity === true

  // File columns — ideally from file.columns, else empty
  const fileColumns: string[] = (file as any)?.columns || []

  const multiExport = useMultiEntityExport({
    uploadId: file?.upload_id ?? null,
    columns: fileColumns,
    provider: selectedERP,
  })

  // Detect entities when ERP changes and modal is open (multi-entity path only)
  useEffect(() => {
    if (!open || !isMultiEntity || !fileColumns.length) return
    if (multiExport.exportState === 'idle') {
      multiExport.detectEntities()
    }
  }, [open, selectedERP, isMultiEntity]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check connection when ERP changes
  useEffect(() => {
    if (!open) return
    if (!selectedOption?.available) return
    if (connectionChecked[selectedERP] !== undefined) return

    const check = async () => {
      try {
        let connected = false
        if (selectedERP === 'quickbooks') {
          connected = (await quickBooksAPI.getConnectionStatus()).connected
        } else if (selectedERP === 'zoho-books') {
          connected = (await zohoBooksAPI.getConnectionStatus()).connected
        } else if (selectedOption?.provider) {
          connected = (await erpConnectorAPI.getConnectionStatus(selectedOption.provider)).connected
        }
        setConnectionChecked(prev => ({ ...prev, [selectedERP]: connected }))
      } catch {
        setConnectionChecked(prev => ({ ...prev, [selectedERP]: false }))
      }
    }
    check()
  }, [open, selectedERP]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleERPChange = (value: string) => {
    setSelectedERP(value)
    multiExport.reset()
    setLegacyResult(null)
    setLegacyError(null)
  }

  // Legacy push for non-multi-entity ERPs
  const handleLegacyPush = async () => {
    if (!file || !selectedOption?.provider) return
    setLegacyPushing(true)
    setLegacyError(null)
    setLegacyResult(null)
    try {
      setLegacyStatus(`Checking ${selectedOption.label} connection...`)
      const connStatus = await erpConnectorAPI.getConnectionStatus(selectedOption.provider)
      if (!connStatus.connected) {
        const msg = `${selectedOption.label} is not connected.`
        setLegacyError(msg)
        onError?.(msg)
        return
      }
      setLegacyStatus(`Exporting to ${selectedOption.label}...`)
      const resp = await erpConnectorAPI.exportToERP(selectedOption.provider, file.upload_id, file.detected_entity)
      const exported = (resp.records_created || 0) + (resp.records_updated || 0)
      setLegacyResult({
        success: exported > 0 || resp.success === true,
        message: resp.message || `Exported ${exported} records to ${selectedOption.label}`,
      })
      onSuccess?.()
    } catch (err) {
      const msg = (err as Error).message || 'Export failed'
      setLegacyError(msg)
      onError?.(msg)
    } finally {
      setLegacyPushing(false)
      setLegacyStatus('')
    }
  }

  const handleClose = () => {
    multiExport.reset()
    setLegacyResult(null)
    setLegacyError(null)
    setLegacyStatus('')
    setConnectionChecked({})
    onOpenChange(false)
  }

  const filename = file?.original_filename || file?.filename || 'selected file'
  const isConnected = connectionChecked[selectedERP] === true
  const isExporting =
    isMultiEntity
      ? multiExport.exportState === 'exporting'
      : legacyPushing
  const isDone =
    isMultiEntity
      ? multiExport.exportState === 'done'
      : legacyResult?.success === true

  const getConnectionBadge = (opt: ERPOption) => {
    if (!opt.available) {
      return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Coming Soon</span>
    }
    const checked = connectionChecked[opt.value]
    if (checked === undefined) {
      return <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">Available</span>
    }
    return checked
      ? <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Connected</span>
      : <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Not Connected</span>
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudUpload className="h-5 w-5 text-primary" />
              Push to your ERP Tool
            </DialogTitle>
            <DialogDescription>
              Export your cleaned data directly to your connected ERP system.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* File Info */}
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium">{filename}</p>
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {file.rows_clean || file.rows_out || 0} clean rows ready to export
                </p>
              )}
            </div>

            {/* ERP Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select ERP Tool</Label>
              <RadioGroup
                value={selectedERP}
                onValueChange={handleERPChange}
                disabled={isExporting || isDone}
                className="space-y-2 max-h-[200px] overflow-y-auto pr-2"
              >
                {ERP_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-center space-x-3 rounded-lg border p-3 transition-colors ${
                      selectedERP === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    } ${option.available ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
                  >
                    <RadioGroupItem value={option.value} id={option.value} disabled={!option.available} />
                    <Label htmlFor={option.value} className={`flex-1 ${option.available ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{option.label}</p>
                        {getConnectionBadge(option)}
                      </div>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* ── Multi-entity flow (QB + Zoho) ── */}
            {isMultiEntity && (
              <div className="space-y-3">
                {/* Detecting spinner */}
                {multiExport.exportState === 'detecting' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Detecting entities from file…
                  </div>
                )}

                {/* Detected — summary card */}
                {(multiExport.exportState === 'detected' || multiExport.exportState === 'exporting' || multiExport.exportState === 'done' || multiExport.exportState === 'error') && multiExport.entities.length > 0 && (
                  <MultiEntitySummaryCard
                    entities={multiExport.entities}
                    mappedCount={multiExport.mappedCount}
                    unmappedColumns={multiExport.unmappedColumns}
                    onViewMapping={() => setMappingOpen(true)}
                  />
                )}

                {/* Per-entity progress */}
                {(multiExport.exportState === 'exporting' || multiExport.exportState === 'done' || multiExport.exportState === 'error') && (
                  <div className="space-y-1 rounded-lg border p-3 bg-muted/20">
                    {multiExport.entityProgress.map(ep => (
                      <EntityProgressRow key={ep.entity} {...ep} />
                    ))}
                  </div>
                )}

                {/* No columns warning */}
                {multiExport.exportState === 'idle' && !fileColumns.length && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Column information not available for this file. Select a file that has been processed.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Error */}
                {multiExport.exportState === 'error' && multiExport.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{multiExport.error}</AlertDescription>
                  </Alert>
                )}

                {/* Done success */}
                {multiExport.exportState === 'done' && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-900">
                      Export complete —{' '}
                      {multiExport.finalResults.reduce((sum, r) => sum + r.success_count, 0)} records exported
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* ── Legacy single-entity flow (other ERPs) ── */}
            {!isMultiEntity && (
              <>
                {legacyStatus && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <AlertDescription className="text-blue-900 ml-2">{legacyStatus}</AlertDescription>
                  </Alert>
                )}
                {legacyError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{legacyError}</AlertDescription>
                  </Alert>
                )}
                {legacyResult && (
                  <Alert className={legacyResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {legacyResult.success
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <AlertCircle className="h-4 w-4 text-red-600" />}
                    <AlertDescription className={legacyResult.success ? 'text-green-900' : 'text-red-900'}>
                      {legacyResult.message}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={handleClose}>
              {isDone ? 'Close' : 'Cancel'}
            </Button>
            {!isDone && (
              <Button
                onClick={isMultiEntity ? multiExport.startExport : handleLegacyPush}
                disabled={
                  isExporting ||
                  !file ||
                  !selectedOption?.available ||
                  (isMultiEntity && (multiExport.exportState === 'detecting' || multiExport.exportState === 'idle')) ||
                  (!isMultiEntity && !isConnected)
                }
                className="gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4" />
                    Export to {selectedOption?.label || 'ERP'}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Mapping drawer */}
      <ViewMappingDrawer
        open={mappingOpen}
        onOpenChange={setMappingOpen}
        resolutions={multiExport.resolutions}
        unmappedColumns={multiExport.unmappedColumns}
      />
    </>
  )
}
