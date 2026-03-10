"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, File, FileJson, FileSpreadsheet, Loader2, Columns, Edit2, Check, X, Undo, ShieldX } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/shared/lib/utils'

interface ColumnExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  columns: string[]
  onExport: (options: {
    format: 'csv' | 'excel' | 'json'
    dataType: 'all' | 'clean' | 'quarantine'
    columns: string[]
    columnMapping: Record<string, string>
  }) => void
  exporting: boolean
}

interface ColumnExportContentProps {
  fileName: string
  columns: string[]
  onExport: (options: {
    format: 'csv' | 'excel' | 'json'
    dataType: 'all' | 'clean' | 'quarantine'
    columns: string[]
    columnMapping: Record<string, string>
  }) => void
  exporting: boolean
  onCancel?: () => void
  onSecondaryAction?: (options: {
    format: 'csv' | 'excel' | 'json'
    dataType: 'all' | 'clean' | 'quarantine'
    columns: string[]
    columnMapping: Record<string, string>
  }) => void
  secondaryActionLabel?: string
  secondaryActionLoading?: boolean
  secondaryActionDisabled?: boolean
  primaryActionLabel?: string
  showTitle?: boolean
  showFooter?: boolean
  className?: string
}

interface ColumnState {
  selected: boolean
  exportName: string
  isEditing: boolean
}

export function ColumnExportContent({
  fileName,
  columns,
  onExport,
  exporting,
  onCancel,
  onSecondaryAction,
  secondaryActionLabel = 'Secondary Action',
  secondaryActionLoading = false,
  secondaryActionDisabled = false,
  primaryActionLabel,
  showTitle = true,
  showFooter = true,
  className
}: ColumnExportContentProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json'>('csv')
  const [dataType, setDataType] = useState<'all' | 'clean' | 'quarantine'>('all')
  const [columnStates, setColumnStates] = useState<Record<string, ColumnState>>({})

  // DQ suffixes that are added to original column names by the DQ engine
  // Pattern: {column_name}_dq_{type} e.g., CUSTOMER_ID_dq_status
  const DQ_SUFFIXES = [
    '_dq_status', '_dq_fixed', '_dq_quarantined', '_dq_clean', '_dq_violations',
    '_status', '_clean', '_quarantine', '_fixed', '_violations', '_fixes_applied',
    '_issues', '_flagged', '_severity'
  ]

  // Standalone DQ columns (not tied to a base column)
  const STANDALONE_DQ_COLUMNS = ['fixes_applied', 'dq_summary', 'dq_score', 'violations_count']

  // Check if a column is a DQ-generated column
  const isDQStatusColumn = (col: string, allColumns: string[]) => {
    const lowerCol = col.toLowerCase()

    // Check for standalone DQ columns
    if (STANDALONE_DQ_COLUMNS.some(standalone => lowerCol === standalone.toLowerCase())) {
      return true
    }

    // Check if this column ends with a DQ suffix AND the base column exists
    for (const suffix of DQ_SUFFIXES) {
      if (lowerCol.endsWith(suffix.toLowerCase())) {
        // Extract base column name
        const baseCol = col.slice(0, col.length - suffix.length)
        if (baseCol.length === 0) continue
        // Check if base column exists (case-insensitive)
        const baseExists = allColumns.some(c => c.toLowerCase() === baseCol.toLowerCase())
        if (baseExists) {
          return true
        }
      }
    }

    // Also check for explicit DQ prefixes
    if (lowerCol.startsWith('dq_') || lowerCol.startsWith('__dq')) {
      return true
    }

    return false
  }

  useEffect(() => {
    const initialState: Record<string, ColumnState> = {}
    columns.forEach(col => {
      // By default, deselect DQ status columns
      const isDQCol = isDQStatusColumn(col, columns)
      initialState[col] = {
        selected: !isDQCol,
        exportName: col,
        isEditing: false
      }
    })
    setColumnStates(initialState)
  }, [columns])

  const selectedColumns = useMemo(() => {
    return Object.entries(columnStates)
      .filter(([, state]) => state.selected)
      .map(([col]) => col)
  }, [columnStates])

  const columnMapping = useMemo(() => {
    const mapping: Record<string, string> = {}
    Object.entries(columnStates).forEach(([col, state]) => {
      if (state.selected && state.exportName !== col) {
        mapping[col] = state.exportName
      }
    })
    return mapping
  }, [columnStates])

  const handleToggleColumn = (col: string) => {
    setColumnStates(prev => ({
      ...prev,
      [col]: { ...prev[col], selected: !prev[col]?.selected }
    }))
  }

  const handleStartEdit = (col: string) => {
    setColumnStates(prev => ({
      ...prev,
      [col]: { ...prev[col], isEditing: true }
    }))
  }

  const handleEndEdit = (col: string) => {
    setColumnStates(prev => ({
      ...prev,
      [col]: { ...prev[col], isEditing: false }
    }))
  }

  const handleNameChange = (col: string, newName: string) => {
    setColumnStates(prev => ({
      ...prev,
      [col]: { ...prev[col], exportName: newName }
    }))
  }

  const handleResetName = (col: string) => {
    setColumnStates(prev => ({
      ...prev,
      [col]: { ...prev[col], exportName: col, isEditing: false }
    }))
  }

  const handleSelectAll = () => {
    setColumnStates(prev => {
      const newState = { ...prev }
      Object.keys(newState).forEach(col => {
        newState[col] = { ...newState[col], selected: true }
      })
      return newState
    })
  }

  const handleDeselectAll = () => {
    setColumnStates(prev => {
      const newState = { ...prev }
      Object.keys(newState).forEach(col => {
        newState[col] = { ...newState[col], selected: false }
      })
      return newState
    })
  }

  const handleClearDQStatus = () => {
    setColumnStates(prev => {
      const newState = { ...prev }
      Object.keys(newState).forEach(col => {
        if (isDQStatusColumn(col, columns)) {
          newState[col] = { ...newState[col], selected: false }
        }
      })
      return newState
    })
  }

  const dqStatusCount = columns.filter(col => isDQStatusColumn(col, columns)).length
  const dqStatusSelected = Object.entries(columnStates)
    .filter(([col, state]) => isDQStatusColumn(col, columns) && state.selected)
    .length

  const handleExport = () => {
    onExport({
      format: selectedFormat,
      dataType,
      columns: selectedColumns,
      columnMapping
    })
  }

  const handleSecondaryAction = () => {
    if (!onSecondaryAction) return
    onSecondaryAction({
      format: selectedFormat,
      dataType,
      columns: selectedColumns,
      columnMapping
    })
  }

  const formatOptions = [
    { value: 'csv', label: 'CSV', icon: File, description: 'Comma-separated values' },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel (.xlsx)' },
    { value: 'json', label: 'JSON', icon: FileJson, description: 'JavaScript Object Notation' }
  ] as const

  const dataTypeOptions = [
    { value: 'all', label: 'All Data' },
    { value: 'clean', label: 'Clean Only' },
    { value: 'quarantine', label: 'Quarantined' }
  ] as const

  const renamedCount = Object.keys(columnMapping).length

  return (
    <div className={cn('space-y-5 flex-1 min-h-0 flex flex-col overflow-hidden', className)}>
      {showTitle && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Columns className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Select Columns for Export
          </div>
          <p className="text-xs text-muted-foreground">
            Choose columns for Download, then pick clean, quarantined, or all data in CSV, Excel, or JSON.
          </p>
          <div className="text-xs mt-2 p-2 rounded bg-muted text-muted-foreground">
            File: <span className="font-mono font-medium text-foreground">{fileName}</span>
          </div>
        </div>
      )}

      <div className="space-y-3 shrink-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Export Settings</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <Select
              value={selectedFormat}
              onValueChange={(value) => setSelectedFormat(value as 'csv' | 'excel' | 'json')}
              disabled={exporting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Data</Label>
            <Select
              value={dataType}
              onValueChange={(value) => setDataType(value as 'all' | 'clean' | 'quarantine')}
              disabled={exporting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                {dataTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Column Selection</div>
            <div className="text-sm font-medium mt-2">
              {selectedColumns.length} of {columns.length} columns selected
              {renamedCount > 0 && (
                <span className="ml-3 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  ({renamedCount} renamed)
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={exporting} className="text-xs h-8">
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll} disabled={exporting} className="text-xs h-8">
              Clear All
            </Button>
            {dqStatusCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDQStatus}
                disabled={exporting}
                className="text-xs h-8 gap-1.5"
              >
                <ShieldX className="h-3.5 w-3.5" />
                Clear DQ Status
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="border rounded-lg bg-muted/30 flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {columns.map((col) => {
            const state = columnStates[col] || { selected: true, exportName: col, isEditing: false }
            const isRenamed = state.exportName !== col

            return (
              <div
                key={col}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${state.selected
                    ? 'bg-blue-100/60 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700/50 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 shadow-sm'
                    : 'bg-muted/30 border-muted/50 hover:bg-muted/50'
                  }`}
                onClick={() => !exporting && handleToggleColumn(col)}
              >
                <Checkbox
                  checked={state.selected}
                  onCheckedChange={() => handleToggleColumn(col)}
                  disabled={exporting}
                />

                <div className="flex-1 min-w-0">
                  {state.isEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={state.exportName}
                        onChange={(e) => handleNameChange(col, e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEndEdit(col)
                          if (e.key === 'Escape') handleResetName(col)
                        }}
                      />
                      {state.exportName !== col && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                          onClick={() => handleEndEdit(col)}
                          title="Confirm"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleResetName(col)}
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${state.selected
                          ? isRenamed ? 'text-blue-700 dark:text-blue-300 line-through' : 'text-blue-900 dark:text-blue-100 font-semibold'
                          : isRenamed ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}>
                        {col}
                      </span>
                      {isRenamed && (
                        <>
                          <span className={`text-xs font-medium ${state.selected ? 'text-blue-600 dark:text-blue-300' : 'text-muted-foreground'
                            }`}>→</span>
                          <span className={`text-sm font-medium truncate px-2 py-0.5 rounded ${state.selected
                              ? 'text-green-700 dark:text-green-200 bg-green-200/50 dark:bg-green-900/50'
                              : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20'
                            }`}>
                            {state.exportName}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {!state.isEditing && state.selected && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartEdit(col)
                      }}
                      disabled={exporting}
                      title="Rename"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {isRenamed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResetName(col)
                        }}
                        disabled={exporting}
                        title="Reset"
                      >
                        <Undo className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {showFooter && (
        <div className="flex justify-between gap-3 shrink-0 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={exporting}
            className="px-6"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {onSecondaryAction && (
              <Button
                variant="outline"
                onClick={handleSecondaryAction}
                disabled={
                  exporting ||
                  secondaryActionLoading ||
                  secondaryActionDisabled ||
                  selectedColumns.length === 0
                }
                className="gap-2 px-6"
              >
                {secondaryActionLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {secondaryActionLabel}
              </Button>
            )}
            <Button
              onClick={handleExport}
              disabled={exporting || selectedColumns.length === 0}
              className="gap-2 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {primaryActionLabel || `Export ${selectedFormat.toUpperCase()}`}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ColumnExportDialog({
  open,
  onOpenChange,
  fileName,
  columns,
  onExport,
  exporting
}: ColumnExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Columns className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Select Columns for Export
          </DialogTitle>
          <DialogDescription className="text-sm mt-2">
            Choose columns for Download, then pick clean, quarantined, or all data in CSV, Excel, or JSON.
          </DialogDescription>
          <div className="text-xs mt-3 p-2 rounded bg-muted text-muted-foreground">
            File: <span className="font-mono font-medium text-foreground">{fileName}</span>
          </div>
        </DialogHeader>

        <div className="py-4 flex-1 min-h-0 flex flex-col overflow-hidden">
          <ColumnExportContent
            fileName={fileName}
            columns={columns}
            onExport={onExport}
            exporting={exporting}
            onCancel={() => onOpenChange(false)}
            showTitle={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
