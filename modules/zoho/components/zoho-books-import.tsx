'use client'

import {
  Network,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'

import { useZohoImport, type UseZohoImportProps } from './use-zoho-import'
import { getMappingFields, autoMapColumns, validateMapping } from './zoho-mapping-utils'

// ─── Component ────────────────────────────────────────────────────
export default function ZohoBooksImport(props: UseZohoImportProps) {
  const { mode } = props
  const z = useZohoImport(props)

  return (
    <div className="space-y-4">
      {/* ── Connection card ── */}
      <div className="rounded-lg border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted p-2 rounded-full">
              <Network className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Zoho Books</h3>
              <p className="text-sm text-muted-foreground">
                Connect your Zoho Books account to {mode === 'destination' ? 'export' : 'import'} data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {z.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : z.connected ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Not Connected
              </span>
            )}
          </div>
        </div>

        {!z.connected ? (
          <div className="mt-4">
            <Button onClick={z.connectZoho} size="lg" className="px-6 py-5 text-sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Zoho Books
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={z.disconnectZoho}>
              <Trash2 className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
            {z.connectionInfo?.zoho_accounts_user_id && (
              <span className="text-xs text-muted-foreground self-center">
                Zoho Accounts User ID: {z.connectionInfo.zoho_accounts_user_id}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Org ID</Label>
              <Input
                className="h-8 w-48 text-xs bg-muted/50 cursor-default"
                value={z.orgIdInput}
                readOnly
                disabled
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Config card ── */}
      <div className="rounded-lg border p-4 bg-card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Entity</Label>
            <Select
              value={z.config.entity}
              onValueChange={(value) =>
                z.setConfig((prev) => ({ ...prev, entity: value as typeof prev.entity }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contacts">Contacts</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="vendors">Vendors</SelectItem>
                <SelectItem value="items">Items</SelectItem>
                <SelectItem value="invoices">Invoices</SelectItem>
                <SelectItem value="sales_orders">Sales Orders</SelectItem>
                <SelectItem value="purchase_orders">Purchase Orders</SelectItem>
                <SelectItem value="inventory_items">Inventory Items</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'destination' ? (
            <div className="space-y-2">
              <Label>File to export</Label>
              <Select value={z.selectedFile?.upload_id || ''} onValueChange={z.handleFileSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select file" />
                </SelectTrigger>
                <SelectContent>
                  {[...z.files]
                    .sort((a, b) => {
                      const dateA = new Date(a.updated_at || a.status_timestamp || 0).getTime()
                      const dateB = new Date(b.updated_at || b.status_timestamp || 0).getTime()
                      return dateB - dateA
                    })
                    .map((file) => (
                      <SelectItem key={file.upload_id} value={file.upload_id}>
                        {file.original_filename || file.filename}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Limit</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={z.config.limit}
                onChange={(e) =>
                  z.setConfig((prev) => ({ ...prev, limit: Number(e.target.value) }))
                }
              />
            </div>
          )}
        </div>

        {mode !== 'destination' && z.config.entity === 'invoices' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={z.config.dateFrom}
                onChange={(e) => z.setConfig((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={z.config.dateTo}
                onChange={(e) => z.setConfig((prev) => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>
        )}

        {mode !== 'destination' && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="zoho-fetch-all"
              checked={z.config.fetchAll}
              onCheckedChange={(checked) =>
                z.setConfig((prev) => ({ ...prev, fetchAll: Boolean(checked) }))
              }
            />
            <Label htmlFor="zoho-fetch-all" className="text-sm">
              Fetch all pages (may take longer)
            </Label>
          </div>
        )}

        {z.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{z.error}</AlertDescription>
          </Alert>
        )}

        {z.importResult && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              Imported {z.importResult.records_imported} records to file {z.importResult.filename}
            </AlertDescription>
          </Alert>
        )}

        {z.exportSummary && (
          <Alert className="border-blue-200 bg-blue-50">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              Exported {z.exportSummary.success_count}/{z.exportSummary.total_records} records.
              {z.exportSummary.failed_count > 0 && (
                <span className="block mt-2 text-xs text-blue-900">
                  Failed: {z.exportSummary.failed_count}.{' '}
                  {z.exportSummary.errors.length > 0 ? 'First errors:' : ''}
                  {z.exportSummary.errors.length > 0 && (
                    <ul className="list-disc pl-4 mt-1">
                      {z.exportSummary.errors.map((err, idx) => (
                        <li key={`${err}-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  )}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          {mode === 'destination' ? (
            <Button
              onClick={z.exportToZoho}
              disabled={z.isExporting || !z.connected}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {z.isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export to Zoho Books
            </Button>
          ) : (
            <Button
              onClick={z.importFromZoho}
              disabled={z.isImporting || !z.connected}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {z.isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Import from Zoho Books
            </Button>
          )}
          {mode === 'destination' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => z.setMappingOpen(true)}
              disabled={!z.selectedFile}
            >
              Mapping
            </Button>
          )}
        </div>
      </div>

      {/* ── Column selection dialog ── */}
      <AlertDialog open={z.columnModalOpen} onOpenChange={z.setColumnModalOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Choose columns to export</AlertDialogTitle>
            <AlertDialogDescription>
              Select which columns should be used for the Zoho Books export.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {z.columnsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading columns...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="zoho-select-all"
                    checked={
                      z.selectedColumns.size === z.availableColumns.length &&
                      z.availableColumns.length > 0
                    }
                    onCheckedChange={(checked) => z.handleToggleAllColumns(Boolean(checked))}
                  />
                  <Label htmlFor="zoho-select-all">Select all</Label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto border rounded-md p-3">
                  {z.availableColumns.map((col) => (
                    <label key={col} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={z.selectedColumns.has(col)}
                        onCheckedChange={(checked) => z.handleToggleColumn(col, Boolean(checked))}
                      />
                      {col}
                    </label>
                  ))}
                </div>

                {z.columnsError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{z.columnsError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => z.setColumnModalOpen(false)}
              disabled={z.columnsLoading}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Mapping dialog ── */}
      <Dialog open={z.mappingOpen} onOpenChange={z.setMappingOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Map columns for Zoho Books</DialogTitle>
            <DialogDescription>
              Map your file columns to Zoho Books fields before export.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-2">
            {getMappingFields(z.config.entity).map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)_minmax(0,220px)] gap-3 items-center"
              >
                <div className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                <Select
                  value={z.columnMapping[field.key] || ''}
                  onValueChange={(value) =>
                    z.setColumnMapping((prev) => ({ ...prev, [field.key]: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {z.availableColumns.map((col) => (
                      <SelectItem key={`${field.key}-${col}`} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                z.setColumnMapping(autoMapColumns(z.config.entity, z.availableColumns))
              }}
            >
              Auto map
            </Button>
            <Button
              onClick={() => {
                const validation = validateMapping(
                  z.config.entity,
                  z.columnMapping,
                  z.availableColumns
                )
                if (!validation.valid) {
                  z.setError(validation.message)
                  return
                }
                z.setMappingOpen(false)
              }}
            >
              Save mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
