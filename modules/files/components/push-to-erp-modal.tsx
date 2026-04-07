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
import { connectorsAPI, erpConnectorsAPI } from '@/modules/connectors'
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
  columns?: string[]
  onSuccess?: () => void
  onError?: (error: string) => void
}

/** Standalone content (no Dialog wrapper) for embedding in ExportDialog */
export interface PushToERPContentProps {
  file: FileStatusResponse | null
  columns?: string[]
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

// ─── Shared core logic hook ─────────────────────────────────────────────────

function useERPPushCore({
  file,
  columns,
  active,
  onSuccess,
  onError,
}: {
  file: FileStatusResponse | null
  columns?: string[]
  active: boolean
  onSuccess?: () => void
  onError?: (error: string) => void
}) {
  const [selectedERP, setSelectedERP] = useState<string>('quickbooks')
  const [connectionChecked, setConnectionChecked] = useState<Record<string, boolean | null>>({})
  const [mappingOpen, setMappingOpen] = useState(false)
  const [legacyPushing, setLegacyPushing] = useState(false)
  const [legacyResult, setLegacyResult] = useState<{ success: boolean; message: string } | null>(null)
  const [legacyError, setLegacyError] = useState<string | null>(null)
  const [legacyStatus, setLegacyStatus] = useState<string>('')

  const selectedOption = ERP_OPTIONS.find(o => o.value === selectedERP)
  const isMultiEntity = selectedOption?.multiEntity === true
  const fileColumns: string[] = columns || []

  const multiExport = useMultiEntityExport({
    uploadId: file?.upload_id ?? null,
    columns: fileColumns,
    provider: selectedERP,
  })

  useEffect(() => {
    if (!active || !isMultiEntity || !fileColumns.length) return
    if (multiExport.exportState === 'idle') {
      multiExport.detectEntities()
    }
  }, [active, selectedERP, isMultiEntity]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return
    if (!selectedOption?.available) return
    if (connectionChecked[selectedERP] !== undefined) return
    const check = async () => {
      try {
        let connected = false
        const provider = selectedOption?.provider || selectedERP
        connected = (await connectorsAPI.getConnectionStatus(provider)).connected
        setConnectionChecked(prev => ({ ...prev, [selectedERP]: connected }))
      } catch {
        setConnectionChecked(prev => ({ ...prev, [selectedERP]: false }))
      }
    }
    check()
  }, [active, selectedERP]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleERPChange = (value: string) => {
    setSelectedERP(value)
    multiExport.reset()
    setLegacyResult(null)
    setLegacyError(null)
  }

  const handleLegacyPush = async () => {
    if (!file || !selectedOption?.provider) return
    setLegacyPushing(true)
    setLegacyError(null)
    setLegacyResult(null)
    try {
      const provider = selectedOption.provider || selectedERP
      setLegacyStatus(`Checking ${selectedOption.label} connection...`)
      const connStatus = await connectorsAPI.getConnectionStatus(provider)
      if (!connStatus.connected) {
        const msg = `${selectedOption.label} is not connected.`
        setLegacyError(msg)
        onError?.(msg)
        return
      }
      setLegacyStatus(`Exporting to ${selectedOption.label}...`)
      const resp = await erpConnectorsAPI.exportData(provider, file.upload_id, file.detected_entity)
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

  const resetAll = () => {
    multiExport.reset()
    setLegacyResult(null)
    setLegacyError(null)
    setLegacyStatus('')
    setConnectionChecked({})
  }

  const isConnected = connectionChecked[selectedERP] === true
  const isExporting = isMultiEntity ? multiExport.exportState === 'exporting' : legacyPushing
  const isDone = isMultiEntity ? multiExport.exportState === 'done' : legacyResult?.success === true

  return {
    selectedERP, selectedOption, isMultiEntity, fileColumns,
    connectionChecked, mappingOpen, setMappingOpen,
    multiExport, legacyPushing, legacyResult, legacyError, legacyStatus,
    isConnected, isExporting, isDone,
    handleERPChange, handleLegacyPush, resetAll,
  }
}

// ─── Connection badge ───────────────────────────────────────────────────────

function ConnectionBadge({ opt, checked }: { opt: ERPOption; checked: boolean | null | undefined }) {
  if (!opt.available) {
    return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Coming Soon</span>
  }
  if (checked === undefined) {
    return <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">Available</span>
  }
  return checked
    ? <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Connected</span>
    : <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Not Connected</span>
}

// ─── Shared ERP push UI (used by both modal and inline content) ─────────────

function ERPPushBody({
  file,
  core,
}: {
  file: FileStatusResponse | null
  core: ReturnType<typeof useERPPushCore>
}) {
  const {
    selectedERP, selectedOption, isMultiEntity, fileColumns,
    connectionChecked, multiExport, legacyStatus, legacyError, legacyResult,
    isExporting, isDone, handleERPChange, handleLegacyPush,
  } = core

  const filename = file?.original_filename || file?.filename || 'selected file'

  return (
    <div className="space-y-4">
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
              <RadioGroupItem value={option.value} id={`erp-${option.value}`} disabled={!option.available} />
              <Label htmlFor={`erp-${option.value}`} className={`flex-1 ${option.available ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{option.label}</p>
                  <ConnectionBadge opt={option} checked={connectionChecked[option.value]} />
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
          {multiExport.exportState === 'detecting' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Detecting entities from file…
            </div>
          )}

          {(multiExport.exportState === 'detected' || multiExport.exportState === 'exporting' || multiExport.exportState === 'done' || multiExport.exportState === 'error') && multiExport.entities.length > 0 && (
            <MultiEntitySummaryCard
              entities={multiExport.entities}
              mappedCount={multiExport.mappedCount}
              unmappedColumns={multiExport.unmappedColumns}
              onViewMapping={() => core.setMappingOpen(true)}
            />
          )}

          {(multiExport.exportState === 'exporting' || multiExport.exportState === 'done' || multiExport.exportState === 'error') && (
            <div className="space-y-1 rounded-lg border p-3 bg-muted/20">
              {multiExport.entityProgress.map(ep => (
                <EntityProgressRow key={ep.entity} {...ep} />
              ))}
            </div>
          )}

          {multiExport.exportState === 'idle' && !fileColumns.length && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Column information not available for this file. Select a file that has been processed.
              </AlertDescription>
            </Alert>
          )}

          {multiExport.exportState === 'error' && multiExport.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{multiExport.error}</AlertDescription>
            </Alert>
          )}

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

      {/* Action button */}
      {!isDone && (
        <Button
          onClick={isMultiEntity ? multiExport.startExport : handleLegacyPush}
          disabled={
            isExporting ||
            !file ||
            !selectedOption?.available ||
            (isMultiEntity && (multiExport.exportState === 'detecting' || multiExport.exportState === 'idle')) ||
            (!isMultiEntity && !core.isConnected)
          }
          className="gap-2 w-full"
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
    </div>
  )
}

// ─── Standalone content component (for embedding in ExportDialog) ───────────

export function PushToERPContent({
  file,
  columns,
  onSuccess,
  onError,
}: PushToERPContentProps) {
  const core = useERPPushCore({ file, columns, active: true, onSuccess, onError })

  return (
    <>
      <ERPPushBody file={file} core={core} />
      <ViewMappingDrawer
        open={core.mappingOpen}
        onOpenChange={core.setMappingOpen}
        resolutions={core.multiExport.resolutions}
        unmappedColumns={core.multiExport.unmappedColumns}
      />
    </>
  )
}

// ─── Modal wrapper (standalone dialog, used in files-page-dialogs) ──────────

export function PushToERPModal({
  open,
  onOpenChange,
  file,
  columns,
  onSuccess,
  onError,
}: PushToERPModalProps) {
  const core = useERPPushCore({ file, columns, active: open, onSuccess, onError })

  const handleClose = () => {
    core.resetAll()
    onOpenChange(false)
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

          <div className="py-4">
            <ERPPushBody file={file} core={core} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {core.isDone ? 'Close' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewMappingDrawer
        open={core.mappingOpen}
        onOpenChange={core.setMappingOpen}
        resolutions={core.multiExport.resolutions}
        unmappedColumns={core.multiExport.unmappedColumns}
      />
    </>
  )
}
