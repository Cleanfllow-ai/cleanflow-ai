"use client"

import {
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

import { useERPImport, type UseERPImportProps } from "./use-erp-import"
import { validateMapping } from "./erp-mapping-utils"

// ─── Component ────────────────────────────────────────────────────

export default function ERPImport(props: UseERPImportProps) {
  const { mode } = props
  const q = useERPImport(props)

  if (q.loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] py-8 sm:py-12 lg:py-16">
        <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-4 sm:p-6 lg:p-8">
      {/* Error Alert */}
      {q.error && (
        <Alert variant="destructive" className="py-2 sm:py-3">
          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          <AlertDescription className="text-sm sm:text-base">{q.error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {q.importResult && (
        <Alert className="border-green-200 bg-green-50 py-2 sm:py-3">
          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          <AlertDescription className="text-sm sm:text-base text-green-900 whitespace-pre-line">
            {q.importResult.message || `Imported ${q.importResult.records_imported || 0} records`}
          </AlertDescription>
        </Alert>
      )}

      {/* Export polling indicator */}
      {q.exportPolling && (
        <Alert className="border-blue-200 bg-blue-50 py-2 sm:py-3">
          <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 animate-spin" />
          <AlertDescription className="text-sm sm:text-base text-blue-900 ml-2">
            Export in progress... This may take a moment.
          </AlertDescription>
        </Alert>
      )}

      {/* Import Form — Source Mode */}
      {mode === "source" && (
            <div className="grid gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">Entity</Label>
                  <Select
                    value={q.config.entity}
                    onValueChange={(value) =>
                      q.setConfig((prev) => ({ ...prev, entity: value }))
                    }
                  >
                    <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue
                        placeholder={q.entitiesLoading ? "Loading entities..." : "Select entity"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {q.entitiesLoading ? (
                        <SelectItem value="__loading" disabled>
                          Loading entities...
                        </SelectItem>
                      ) : (
                        q.discoveredEntities.map((e) => (
                          <SelectItem key={e.entity} value={e.entity} disabled={!e.available}>
                            {e.label}
                            {!e.available && " — not available"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">Max Records</Label>
                  <Input
                    type="number"
                    value={q.config.limit}
                    onChange={(e) =>
                      q.setConfig((prev) => ({
                        ...prev,
                        limit: parseInt(e.target.value) || 1000,
                      }))
                    }
                    min={1}
                    max={10000}
                    className="h-9 sm:h-10 text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">
                    From Date <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={q.config.dateFrom}
                    onChange={(e) =>
                      q.setConfig((prev) => ({ ...prev, dateFrom: e.target.value }))
                    }
                    className="h-9 sm:h-10 text-sm sm:text-base"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">
                    To Date <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={q.config.dateTo}
                    onChange={(e) =>
                      q.setConfig((prev) => ({ ...prev, dateTo: e.target.value }))
                    }
                    className="h-9 sm:h-10 text-sm sm:text-base"
                  />
                </div>
              </div>

              <Button
                onClick={q.importFromProvider}
                disabled={q.isImporting}
                className="w-full bg-green-600 hover:bg-green-700 h-10 sm:h-12 text-sm sm:text-base"
              >
                {q.isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Import from {q.providerDisplayName}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Export Form — Destination Mode */}
          {mode === "destination" && (
            <div className="grid gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">
                  Select File to Export
                </Label>
                {q.files && q.files.length > 0 ? (
                  <Select
                    value={q.selectedFile?.upload_id || ""}
                    onValueChange={q.handleFileSelect}
                  >
                    <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue placeholder="Choose a file to export" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...q.files]
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
                ) : (
                  <div className="w-full h-9 sm:h-10 flex items-center px-3 border border-input rounded-md bg-muted text-sm text-muted-foreground">
                    No files available. Please upload and process files first.
                  </div>
                )}
              </div>

              {q.selectedFile && (
                <Alert className="border-blue-200 bg-blue-50 py-2 sm:py-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <AlertDescription className="text-sm sm:text-base text-blue-900 ml-2">
                    {q.selectedFile.original_filename || q.selectedFile.filename} • Status:{" "}
                    {q.selectedFile.status}
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <Label className="text-xs sm:text-sm mb-1.5 sm:mb-2 block">
                  Destination Entity
                </Label>
                <Select
                  value={q.config.entity}
                  onValueChange={(value) =>
                    q.setConfig((prev) => ({ ...prev, entity: value }))
                  }
                >
                  <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                    <SelectValue
                      placeholder={q.entitiesLoading ? "Loading entities..." : "Select entity"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {q.entitiesLoading ? (
                      <SelectItem value="__loading" disabled>
                        Loading entities...
                      </SelectItem>
                    ) : (
                      q.discoveredEntities.map((e) => (
                        <SelectItem key={e.entity} value={e.entity} disabled={!e.available}>
                          {e.label}
                          {!e.available && " — not available"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => q.setMappingOpen(true)}
                  disabled={!q.selectedFile}
                  className="h-10 sm:h-12 text-sm sm:text-base"
                >
                  Mapping
                </Button>
                <Button
                  onClick={q.exportToProvider}
                  disabled={q.isExporting || !q.selectedFile}
                  className="flex-1 bg-green-600 hover:bg-green-700 h-10 sm:h-12 text-sm sm:text-base"
                >
                  {q.isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Export to {q.providerDisplayName}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

      {/* Column Selection Dialog */}
      <AlertDialog open={q.columnModalOpen} onOpenChange={q.setColumnModalOpen}>
        <AlertDialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Select Columns to Export</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which columns from{" "}
              {q.selectedFile?.original_filename || q.selectedFile?.filename} should be exported to{" "}
              {q.providerDisplayName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {q.columnsLoading ? (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading columns...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-2 py-2 border-b">
                  <Checkbox
                    id="select-all-columns"
                    checked={
                      q.selectedColumns.size === q.availableColumns.length &&
                      q.availableColumns.length > 0
                    }
                    onCheckedChange={(checked) => q.handleToggleAllColumns(checked === true)}
                  />
                  <label htmlFor="select-all-columns" className="text-sm font-medium cursor-pointer">
                    Select All
                  </label>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                  {q.availableColumns.length > 0 ? (
                    q.availableColumns.map((col) => (
                      <div key={col} className="flex items-center space-x-2">
                        <Checkbox
                          id={`col-${col}`}
                          checked={q.selectedColumns.has(col)}
                          onCheckedChange={(checked) =>
                            q.handleToggleColumn(col, checked === true)
                          }
                        />
                        <label
                          htmlFor={`col-${col}`}
                          className="text-sm cursor-pointer truncate flex-1"
                        >
                          {col}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No columns available</p>
                  )}
                </div>
                {q.columnsError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs ml-2">{q.columnsError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={q.selectedColumns.size === 0 || q.isExporting}
              onClick={() => q.setColumnModalOpen(false)}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Column Mapping Dialog */}
      <Dialog open={q.mappingOpen} onOpenChange={q.setMappingOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Map columns for {q.providerDisplayName}</DialogTitle>
            <DialogDescription>
              Map your file columns to {q.providerDisplayName} fields before export.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-2">
            {q.entityFields.map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-3 items-start"
              >
                <div>
                  <div className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{field.help}</div>
                </div>
                <Select
                  value={q.columnMapping[field.key] || ""}
                  onValueChange={(value) =>
                    q.setColumnMapping((prev) => ({ ...prev, [field.key]: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {q.availableColumns.map((col) => (
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
            <Button variant="outline" onClick={() => q.aiAutoMap()} disabled={q.autoMapLoading}>
              {q.autoMapLoading ? "Mapping..." : "Auto map"}
            </Button>
            <Button
              onClick={() => {
                const validation = validateMapping(
                  q.columnMapping,
                  q.availableColumns,
                  q.entityFields,
                )
                if (!validation.valid) {
                  q.setError(validation.message)
                  return
                }
                q.setMappingOpen(false)
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
