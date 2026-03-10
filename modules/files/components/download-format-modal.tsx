"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, File, FileCheck, FileJson, FileSpreadsheet, FileWarning, Loader2 } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { Button } from '@/components/ui/button'
import { FileStatusResponse } from '@/modules/files/api/file-management-api'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

interface DownloadFormatModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileStatusResponse | null
  onDownload: (format: 'csv' | 'excel' | 'json', dataType: 'original' | 'clean') => void
  downloading: boolean
}

interface DownloadFormatContentProps {
  file: FileStatusResponse | null
  onDownload: (format: 'csv' | 'excel' | 'json', dataType: 'original' | 'clean') => void
  downloading: boolean
  onCancel?: () => void
  showTitle?: boolean
  showFooter?: boolean
  className?: string
}

export function DownloadFormatContent({
  file,
  onDownload,
  downloading,
  onCancel,
  showTitle = true,
  showFooter = true,
  className
}: DownloadFormatContentProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'json'>('csv')
  const [dataType, setDataType] = useState<'original' | 'clean'>('clean')

  const handleDownload = () => {
    onDownload(selectedFormat, dataType)
  }

  const formatOptions = [
    { value: 'csv', label: 'CSV', icon: File, description: 'Comma-separated values' },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel (.xlsx)' },
    { value: 'json', label: 'JSON', icon: FileJson, description: 'JavaScript Object Notation' }
  ] as const

  return (
    <div className={cn('space-y-6', className)}>
      {showTitle && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">Download File</p>
          <p className="text-xs text-muted-foreground">
            Choose the format and data type for {file?.original_filename || file?.filename || 'this file'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-sm font-medium">Data Type</Label>
        <RadioGroup value={dataType} onValueChange={(value) => setDataType(value as 'original' | 'clean')} disabled={downloading}>
          <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent cursor-pointer">
            <RadioGroupItem value="clean" id="clean" />
            <Label htmlFor="clean" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">Cleaned Data</p>
                  <p className="text-xs text-muted-foreground">Processed and quality-checked data</p>
                </div>
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent cursor-pointer">
            <RadioGroupItem value="original" id="original" />
            <Label htmlFor="original" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="font-medium">Original Data</p>
                  <p className="text-xs text-muted-foreground">Raw uploaded data without processing</p>
                </div>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label htmlFor="format-select" className="text-sm font-medium">
          File Format
        </Label>
        <Select
          value={selectedFormat}
          onValueChange={(value) => setSelectedFormat(value as 'csv' | 'excel' | 'json')}
          disabled={downloading}
        >
          <SelectTrigger id="format-select" className="w-full">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            {formatOptions.map((option) => {
              const Icon = option.icon
              return (
                <SelectItem key={option.value} value={option.value} className="py-2">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          {(() => {
            const SelectedIcon = formatOptions.find(o => o.value === selectedFormat)?.icon || File
            return <SelectedIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
          })()}
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              {dataType === 'clean' ? 'Cleaned' : 'Original'} • {formatOptions.find(o => o.value === selectedFormat)?.label} Format
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedFormat === 'csv' && 'Plain text format, compatible with all spreadsheet applications'}
              {selectedFormat === 'excel' && 'Native Excel format with formatting and formulas support'}
              {selectedFormat === 'json' && 'Structured data format, ideal for API integration and data processing'}
            </p>
          </div>
        </div>
      </div>

      {showFooter && (
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={downloading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download {selectedFormat.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export function DownloadFormatModal({
  open,
  onOpenChange,
  file,
  onDownload,
  downloading
}: DownloadFormatModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download File</DialogTitle>
          <DialogDescription>
            Choose the format and data type for {file?.original_filename || file?.filename || 'this file'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <DownloadFormatContent
            file={file}
            onDownload={onDownload}
            downloading={downloading}
            onCancel={() => onOpenChange(false)}
            showTitle={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

