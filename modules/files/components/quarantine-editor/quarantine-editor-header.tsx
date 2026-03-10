/**
 * quarantine-editor-header.tsx
 *
 * Header component for quarantine editor dialog
 * Displays file metadata and edit status
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { QuarantineManifest } from '@/modules/files/types'

interface QuarantineEditorHeaderProps {
  manifest: QuarantineManifest | null
  pendingCount: number
  compatibilityMode: boolean
}

export function QuarantineEditorHeader({
  manifest,
  pendingCount,
  compatibilityMode,
}: QuarantineEditorHeaderProps) {
  if (!manifest) {
    return (
      <DialogHeader className="px-6 py-3 border-b bg-gradient-to-r from-muted/30 to-muted/10 backdrop-blur-sm">
        <DialogTitle className="text-lg font-semibold">Quarantine Editor</DialogTitle>
      </DialogHeader>
    )
  }

  const totalColumns = manifest.columns.length
  const editableColumns = manifest.editable_columns.filter((c) => c !== 'row_id').length

  return (
    <DialogHeader className="px-6 py-3.5 border-b bg-gradient-to-r from-muted/30 to-muted/10 backdrop-blur-sm">
      <DialogTitle className="flex flex-wrap items-center gap-2.5 text-lg font-semibold">
        <span className="mr-1">Quarantine Editor</span>
        <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-medium shadow-sm">
          {manifest.row_count_quarantined.toLocaleString()} rows
        </Badge>
        <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-medium">
          {totalColumns.toLocaleString()} columns
        </Badge>
        <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-medium border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
          {editableColumns.toLocaleString()} editable
        </Badge>
        <Badge
          variant={pendingCount > 0 ? 'destructive' : 'outline'}
          className={`px-2.5 py-0.5 text-xs font-medium shadow-sm ${pendingCount > 0 ? 'animate-pulse' : ''}`}
        >
          {pendingCount > 0 ? `${pendingCount} unsaved` : '✓ saved'}
        </Badge>
        {compatibilityMode && <Badge variant="destructive" className="px-2.5 py-0.5 text-xs font-medium shadow-sm">Legacy Mode</Badge>}
      </DialogTitle>
    </DialogHeader>
  )
}
