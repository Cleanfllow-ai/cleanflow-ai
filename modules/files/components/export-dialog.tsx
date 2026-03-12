'use client'

/**
 * export-dialog.tsx
 *
 * Unified Export dialog — two tabs:
 *   1. Download  — select columns/format and save locally (CSV, Excel, JSON)
 *   2. Push to ERP — send clean data directly to a connected ERP system
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Download,
  Loader2,
  Upload,
} from 'lucide-react'
import { ColumnExportContent } from '@/modules/files/components/column-export-dialog'
import quickBooksAPI from '@/modules/quickbooks/api/quickbooks-api'
import zohoBooksAPI from '@/modules/zoho/api/zoho-books-api'
import erpConnectorAPI from '@/modules/files/api/erp-connector-api'
import type { FileStatusResponse } from '@/modules/files/api/file-management-api'

// ── ERP options ──────────────────────────────────────────────────────────────

interface ERPOption {
  value: string
  label: string
  description: string
  available: boolean
  provider?: string
}

const ERP_OPTIONS: ERPOption[] = [
  { value: 'quickbooks', label: 'QuickBooks Online', description: 'Push directly to your connected QuickBooks account', available: true },
  { value: 'zoho-books', label: 'Zoho Books', description: 'Push directly to your connected Zoho Books account', available: true },
  { value: 'netsuite', label: 'NetSuite', description: 'Push to Oracle NetSuite', available: true, provider: 'netsuite' },
  { value: 'dynamics', label: 'Microsoft Dynamics 365', description: 'Export to Dynamics 365', available: true, provider: 'microsoft_dynamics' },
  { value: 'oracle', label: 'Oracle Fusion Cloud', description: 'Export to Oracle ERP Cloud', available: false },
  { value: 'sap', label: 'SAP S/4HANA', description: 'Push to SAP S/4HANA or Business One', available: false },
  { value: 'workday', label: 'Workday', description: 'Export to Workday Financial Management', available: false },
  { value: 'sage', label: 'Sage Intacct', description: 'Push to Sage Intacct Cloud ERP', available: false },
]

// ── Component ────────────────────────────────────────────────────────────────

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileStatusResponse | null
  columns: string[]
  isLoadingColumns: boolean
  onDownload: (options: {
    format: 'csv' | 'excel' | 'json'
    dataType: 'all' | 'clean' | 'quarantine'
    columns: string[]
    columnMapping: Record<string, string>
  }) => void
  downloading: boolean
}

export function ExportDialog({
  open,
  onOpenChange,
  file,
  columns,
  isLoadingColumns,
  onDownload,
  downloading,
}: ExportDialogProps) {
  // ERP push state (local — self-contained)
  const [selectedERP, setSelectedERP] = useState('quickbooks')
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState('')
  const [connectionChecked, setConnectionChecked] = useState<Record<string, boolean | null>>({})

  // Reset ERP state when dialog closes
  useEffect(() => {
    if (!open) {
      setPushResult(null)
      setPushError(null)
      setPushStatus('')
      setConnectionChecked({})
    }
  }, [open])

  // Check connection when ERP selection changes
  useEffect(() => {
    if (!open) return
    const opt = ERP_OPTIONS.find(o => o.value === selectedERP)
    if (!opt?.available || connectionChecked[selectedERP] !== undefined) return

    const check = async () => {
      try {
        let connected = false
        if (selectedERP === 'quickbooks') {
          connected = (await quickBooksAPI.getConnectionStatus()).connected
        } else if (selectedERP === 'zoho-books') {
          connected = (await zohoBooksAPI.getConnectionStatus()).connected
        } else if (opt.provider) {
          connected = (await erpConnectorAPI.getConnectionStatus(opt.provider)).connected
        }
        setConnectionChecked(prev => ({ ...prev, [selectedERP]: connected }))
      } catch {
        setConnectionChecked(prev => ({ ...prev, [selectedERP]: false }))
      }
    }
    check()
  }, [open, selectedERP, connectionChecked])

  const handlePush = async () => {
    if (!file) return
    const opt = ERP_OPTIONS.find(o => o.value === selectedERP)
    if (!opt?.available) {
      setPushError(`${opt?.label || 'This ERP'} integration is coming soon.`)
      return
    }

    setPushing(true)
    setPushError(null)
    setPushResult(null)

    try {
      if (selectedERP === 'quickbooks') {
        setPushStatus('Checking QuickBooks connection…')
        const conn = await quickBooksAPI.getConnectionStatus()
        if (!conn.connected) { setPushError('QuickBooks is not connected. Connect your account in Settings first.'); setPushing(false); return }
        setPushStatus('Exporting to QuickBooks…')
        const res = await quickBooksAPI.exportToQuickBooks(file.upload_id)
        setPushResult({ success: res.success, message: res.message || `Exported ${res.records_exported || 0} records` })

      } else if (selectedERP === 'zoho-books') {
        setPushStatus('Checking Zoho Books connection…')
        const conn = await zohoBooksAPI.getConnectionStatus()
        if (!conn.connected) { setPushError('Zoho Books is not connected. Connect your account in Settings first.'); setPushing(false); return }
        setPushStatus('Exporting to Zoho Books…')
        const res = await zohoBooksAPI.exportToZoho(file.upload_id)
        const n = res.success_count || 0
        setPushResult({ success: n > 0, message: `Exported ${n} records to Zoho Books` })

      } else if (opt.provider) {
        setPushStatus(`Checking ${opt.label} connection…`)
        const conn = await erpConnectorAPI.getConnectionStatus(opt.provider)
        if (!conn.connected) { setPushError(`${opt.label} is not connected. Connect your account in Settings first.`); setPushing(false); return }
        setPushStatus(`Exporting to ${opt.label}…`)
        const res = await erpConnectorAPI.exportToERP(opt.provider, file.upload_id)
        const n = (res.records_created || 0) + (res.records_updated || 0)
        setPushResult({ success: n > 0 || res.success === true, message: res.message || `Exported ${n} records` })
      }
    } catch (err: any) {
      let msg = err?.message || 'Export failed'
      if (msg.includes('AbortError') || msg.includes('timed out')) msg = 'The export timed out. Check your network and try again.'
      else if (msg.includes('NoSuchKey') || msg.includes('does not exist')) msg = 'Cleaned data file not found. Please reprocess the file and try again.'
      else if (msg.includes('not yet implemented') || msg.includes('NotImplementedError')) msg = `${opt?.label} export is not fully implemented yet.`
      setPushError(msg)
    } finally {
      setPushing(false)
      setPushStatus('')
    }
  }

  const getConnectionBadge = (opt: ERPOption) => {
    if (!opt.available) return <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
    const checked = connectionChecked[opt.value]
    if (checked === undefined) return <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Available</Badge>
    return checked
      ? <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50">Connected</Badge>
      : <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50">Not Connected</Badge>
  }

  const selectedOpt = ERP_OPTIONS.find(o => o.value === selectedERP)
  const filename = file?.original_filename || file?.filename || 'file'
  const cleanRows = file?.rows_clean ?? file?.rows_out ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            Export Data
          </DialogTitle>
          <DialogDescription>
            Download a copy or push your clean data directly to a connected system.
          </DialogDescription>
          {file && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground truncate max-w-[260px]">{filename}</span>
              <span className="shrink-0">{cleanRows.toLocaleString()} clean rows</span>
            </div>
          )}
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="download" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-0 shrink-0 w-fit">
            <TabsTrigger value="download" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Download
            </TabsTrigger>
            <TabsTrigger value="push-erp" className="gap-1.5">
              <CloudUpload className="h-3.5 w-3.5" />
              Push to ERP
            </TabsTrigger>
          </TabsList>

          {/* ── Download tab ── */}
          <TabsContent value="download" className="flex-1 min-h-0 overflow-hidden mt-0 px-6 pb-6">
            {isLoadingColumns ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading columns…
              </div>
            ) : (
              <ColumnExportContent
                fileName={filename}
                columns={columns}
                onExport={onDownload}
                primaryActionLabel="Download"
                exporting={downloading}
                showTitle={false}
                className="h-full"
              />
            )}
          </TabsContent>

          {/* ── Push to ERP tab ── */}
          <TabsContent value="push-erp" className="flex-1 min-h-0 overflow-y-auto mt-0 px-6 pb-6 pt-4 space-y-4">
            {/* ERP list */}
            <RadioGroup
              value={selectedERP}
              onValueChange={(v) => { setSelectedERP(v); setPushResult(null); setPushError(null) }}
              disabled={pushing || !!pushResult?.success}
              className="space-y-2"
            >
              {ERP_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedERP === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                  } ${opt.available ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                >
                  <RadioGroupItem value={opt.value} id={`erp-${opt.value}`} disabled={!opt.available} />
                  <Label htmlFor={`erp-${opt.value}`} className={`flex-1 ${opt.available ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{opt.label}</span>
                          {getConnectionBadge(opt)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Status / Result / Error */}
            {pushStatus && (
              <Alert className="border-blue-200 bg-blue-50">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-900 ml-2">{pushStatus}</AlertDescription>
              </Alert>
            )}
            {pushError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{pushError}</AlertDescription>
              </Alert>
            )}
            {pushResult && (
              <Alert className={pushResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                {pushResult.success
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <AlertCircle className="h-4 w-4 text-red-600" />
                }
                <AlertDescription className={pushResult.success ? 'text-green-900 ml-2' : 'text-red-900 ml-2'}>
                  {pushResult.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Action */}
            {!pushResult?.success && (
              <Button
                onClick={handlePush}
                disabled={pushing || !file || !selectedOpt?.available}
                className="gap-2 w-full"
              >
                {pushing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Pushing…</>
                ) : (
                  <><CloudUpload className="h-4 w-4" />Push to {selectedOpt?.label || 'ERP'}</>
                )}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
