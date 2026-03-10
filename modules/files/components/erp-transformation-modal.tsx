import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Download, Loader2, Database, CheckCircle, AlertTriangle, FileStack } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ERPTransformationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (targetErp: string | null, dataType: 'clean' | 'quarantine' | 'all') => void
  downloading: boolean
  filename: string
  // Optional: DQ stats to show counts
  dqStats?: {
    cleanRows?: number
    fixedRows?: number
    quarantinedRows?: number
    totalRows?: number
  }
}

const SUPPORTED_ERPS = [
  "Oracle Fusion",
  "SAP ERP",
  "Microsoft Dynamics",
  "NetSuite",
  "Workday",
  "Zoho Books",
  "Infor M3",
  "Infor LN",
  "Epicor Kinetic",
  "QAD ERP",
  "IFS Cloud",
  "Sage Intacct",
  "Custom ERP"
]

// Data type options
const DATA_TYPE_OPTIONS = [
  {
    id: 'clean' as const,
    label: 'Clean + Fixed Data',
    description: 'Only rows that passed DQ checks or were auto-fixed',
    icon: CheckCircle,
    color: 'emerald',
    gradient: 'from-emerald-500/10 to-green-500/10',
    border: 'border-emerald-500',
    borderHover: 'hover:border-emerald-500/50',
    dot: 'bg-emerald-500',
  },
  {
    id: 'quarantine' as const,
    label: 'Quarantined Data',
    description: 'Only rows that failed DQ checks and need review',
    icon: AlertTriangle,
    color: 'amber',
    gradient: 'from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500',
    borderHover: 'hover:border-amber-500/50',
    dot: 'bg-amber-500',
  },
  {
    id: 'all' as const,
    label: 'Full Data (All Rows)',
    description: 'All rows including clean, fixed, and quarantined with DQ status',
    icon: FileStack,
    color: 'blue',
    gradient: 'from-blue-500/10 to-indigo-500/10',
    border: 'border-blue-500',
    borderHover: 'hover:border-blue-500/50',
    dot: 'bg-blue-500',
  },
]

export function ERPTransformationModal({
  open,
  onOpenChange,
  onDownload,
  downloading,
  filename,
  dqStats
}: ERPTransformationModalProps) {
  const [selectedErp, setSelectedErp] = useState<string | null>(null)
  const [noTransformation, setNoTransformation] = useState(true)
  const [selectedDataType, setSelectedDataType] = useState<'clean' | 'quarantine' | 'all'>('clean')

  const handleDownload = () => {
    if (noTransformation) {
      onDownload(null, selectedDataType)
    } else if (selectedErp) {
      onDownload(selectedErp, selectedDataType)
    }
  }

  const handleClose = () => {
    if (!downloading) {
      onOpenChange(false)
      // Reset state when closing
      setNoTransformation(true)
      setSelectedErp(null)
      setSelectedDataType('clean')
    }
  }

  // Helper to get row count for a data type
  const getRowCount = (dataType: 'clean' | 'quarantine' | 'all') => {
    if (!dqStats) return null
    switch (dataType) {
      case 'clean':
        return (dqStats.cleanRows || 0) + (dqStats.fixedRows || 0)
      case 'quarantine':
        return dqStats.quarantinedRows || 0
      case 'all':
        return dqStats.totalRows || 0
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download Options
          </DialogTitle>
          <DialogDescription>
            Choose which data to download and optional ERP transformation
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              File: <span className="font-semibold text-foreground">{filename}</span>
            </p>
          </div>

          {/* Step 1: Data Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Select Data Type
            </Label>
            
            <div className="space-y-2">
              {DATA_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon
                const rowCount = getRowCount(option.id)
                const isSelected = selectedDataType === option.id
                
                return (
                  <div
                    key={option.id}
                    className={cn(
                      "border-2 rounded-lg p-3 cursor-pointer transition-all",
                      isSelected
                        ? `${option.border} bg-gradient-to-r ${option.gradient}`
                        : `border-border ${option.borderHover}`
                    )}
                    onClick={() => setSelectedDataType(option.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        isSelected ? option.border : "border-muted-foreground/50"
                      )}>
                        {isSelected && (
                          <div className={cn("w-2 h-2 rounded-full", option.dot)} />
                        )}
                      </div>
                      <Icon className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isSelected ? `text-${option.color}-500` : "text-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{option.label}</span>
                          {rowCount !== null && (
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              isSelected ? "bg-background/50" : "bg-muted"
                            )}>
                              {rowCount.toLocaleString()} rows
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Step 2: ERP Transformation */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              ERP Transformation (Optional)
            </Label>

            {/* No Transformation Option */}
            <div
              className={cn(
                "border-2 rounded-lg p-3 cursor-pointer transition-all",
                noTransformation
                  ? "border-primary bg-gradient-to-r from-primary/10 to-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => {
                setNoTransformation(true)
                setSelectedErp(null)
              }}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  noTransformation ? "border-primary" : "border-muted-foreground/50"
                )}>
                  {noTransformation && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Original Format (CSV)</div>
                  <p className="text-xs text-muted-foreground">
                    Download without ERP column transformation
                  </p>
                </div>
              </div>
            </div>

            {/* ERP Transformation Option */}
            <div
              className={cn(
                "border-2 rounded-lg p-3 cursor-pointer transition-all",
                !noTransformation
                  ? "border-purple-500 bg-gradient-to-r from-purple-500/10 to-pink-500/10"
                  : "border-border hover:border-purple-500/50"
              )}
              onClick={() => setNoTransformation(false)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  !noTransformation ? "border-purple-500" : "border-muted-foreground/50"
                )}>
                  {!noTransformation && (
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                  )}
                </div>
                <Database className={cn(
                  "w-5 h-5",
                  !noTransformation ? "text-purple-500" : "text-muted-foreground"
                )} />
                <div className="flex-1">
                  <div className="font-medium text-sm">Transform for ERP System</div>
                  <p className="text-xs text-muted-foreground">
                    Convert column names and formats for your target ERP
                  </p>
                </div>
              </div>
            </div>

            {/* ERP Selection */}
            {!noTransformation && (
              <div className="pl-7 space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs font-medium text-muted-foreground">Select Target ERP</Label>
                <RadioGroup value={selectedErp || ''} onValueChange={setSelectedErp}>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                    {SUPPORTED_ERPS.map((erp) => (
                      <div
                        key={erp}
                        className={cn(
                          "flex items-center space-x-2 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                          selectedErp === erp
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-border hover:border-purple-500/50"
                        )}
                        onClick={() => setSelectedErp(erp)}
                      >
                        <RadioGroupItem value={erp} id={erp} />
                        <Label htmlFor={erp} className="text-xs cursor-pointer flex-1">
                          {erp}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={downloading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={downloading || (!noTransformation && !selectedErp)}
            className="min-w-[120px]"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
