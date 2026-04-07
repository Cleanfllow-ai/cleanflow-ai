"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, File, FileJson, FileSpreadsheet, Loader2, Columns, Edit2, Check, X, Undo, ShieldX, Search } from 'lucide-react'
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
    dataType: 'raw' | 'all' | 'clean' | 'quarantine'
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
    dataType: 'raw' | 'all' | 'clean' | 'quarantine'
    columns: string[]
    columnMapping: Record<string, string>
  }) => void
  exporting: boolean
  onCancel?: () => void
  onSecondaryAction?: (options: {
    format: 'csv' | 'excel' | 'json'
    dataType: 'raw' | 'all' | 'clean' | 'quarantine'
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
  const [dataType, setDataType] = useState<'raw' | 'all' | 'clean' | 'quarantine'>('all')
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

  const [searchQuery, setSearchQuery] = useState('')
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return columns
    const q = searchQuery.toLowerCase()
    return columns.filter(col => col.toLowerCase().includes(q))
  }, [columns, searchQuery])

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
    { value: 'raw', label: 'Original Data' },
    { value: 'all', label: 'Processed (All)' },
    { value: 'clean', label: 'Clean Only' },
    { value: 'quarantine', label: 'Quarantined Only' },
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
              onValueChange={(value) => setDataType(value as 'raw' | 'all' | 'clean' | 'quarantine')}
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
          <div className="text-sm text-muted-foreground">
            {selectedColumns.length} of {columns.length} selected
            {renamedCount > 0 && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                ({renamedCount} renamed)
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={exporting} className="text-xs h-7 px-2">
              All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDeselectAll} disabled={exporting} className="text-xs h-7 px-2">
              None
            </Button>
            {dqStatusCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearDQStatus} disabled={exporting} className="text-xs h-7 px-2 gap-1">
                <ShieldX className="h-3 w-3" />
                Hide DQ
              </Button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="border rounded-md flex-1 min-h-0">
        <div className="grid grid-cols-2 gap-px bg-border p-px">
          {filteredColumns.map((col) => {
            const state = columnStates[col] || { selected: true, exportName: col, isEditing: false }
            const isRenamed = state.exportName !== col
            const isDQ = isDQStatusColumn(col, columns)

            return (
              <div
                key={col}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => !exporting && handleToggleColumn(col)}
              >
                <Checkbox
                  checked={state.selected}
                  onCheckedChange={() => handleToggleColumn(col)}
                  disabled={exporting}
                  className="shrink-0"
                />

                <div className="flex-1 min-w-0">
                  {state.isEditing ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={state.exportName}
                        onChange={(e) => handleNameChange(col, e.target.value)}
                        className="h-6 text-xs flex-1 font-mono px-1.5"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEndEdit(col)
                          if (e.key === 'Escape') handleResetName(col)
                        }}
                      />
                      <button onClick={() => handleEndEdit(col)} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Confirm">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleResetName(col)} className="p-0.5 text-muted-foreground hover:bg-muted rounded" title="Cancel">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-xs font-mono truncate ${isRenamed ? 'line-through text-muted-foreground' : isDQ ? 'text-muted-foreground/60' : state.selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {col}
                      </span>
                      {isRenamed && (
                        <>
                          <span className="text-[10px] text-muted-foreground">→</span>
                          <span className="text-xs font-mono truncate text-emerald-600 dark:text-emerald-400">{state.exportName}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {!state.isEditing && state.selected && (
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-muted rounded transition-colors"
                      onClick={() => handleStartEdit(col)}
                      disabled={exporting}
                      title="Rename"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    {isRenamed && (
                      <button
                        className="p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-muted rounded transition-colors"
                        onClick={() => handleResetName(col)}
                        disabled={exporting}
                        title="Reset name"
                      >
                        <Undo className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {filteredColumns.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No columns match &ldquo;{searchQuery}&rdquo;
          </div>
        )}
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
              className="gap-2 px-6"
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
