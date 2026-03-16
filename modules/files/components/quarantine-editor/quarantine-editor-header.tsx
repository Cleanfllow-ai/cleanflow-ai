/**
 * quarantine-editor-header.tsx
 *
 * Clean light header for the quarantine editor.
 * Professional, minimal — matches the B2B light theme.
 */

'use client'

import { ShieldAlert, Columns3, Pencil, CircleDot, AlertTriangle } from 'lucide-react'
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
      <DialogHeader className="px-5 py-3 border-b border-border bg-card">
        <DialogTitle className="text-sm font-semibold text-foreground">
          Quarantine Editor
        </DialogTitle>
      </DialogHeader>
    )
  }

  const totalColumns = manifest.columns.length
  const editableColumns = manifest.editable_columns.filter((c) => c !== 'row_id').length

  return (
    <DialogHeader className="px-5 py-0 border-b border-border bg-card">
      <DialogTitle className="flex items-center gap-0 py-0">
        {/* Title */}
        <div className="flex items-center gap-2 pr-5 py-2.5 border-r border-border">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <span className="text-[13px] font-semibold text-foreground tracking-tight">
            Quarantine Editor
          </span>
        </div>

        {/* Stat pills */}
        <div className="flex items-center">
          <StatPill
            icon={<CircleDot className="w-3 h-3" />}
            value={manifest.row_count_quarantined.toLocaleString()}
            label="rows"
            accent="rose"
          />
          <StatPill
            icon={<Columns3 className="w-3 h-3" />}
            value={totalColumns.toLocaleString()}
            label="cols"
            accent="gray"
          />
          <StatPill
            icon={<Pencil className="w-3 h-3" />}
            value={editableColumns.toLocaleString()}
            label="editable"
            accent="blue"
          />
        </div>

        {/* Save status — pr-12 to clear the dialog close (X) button at top-4 right-4 */}
        <div className="ml-auto flex items-center gap-2 pl-4 pr-12">
          {pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 tabular-nums font-mono">
                {pendingCount} unsaved
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20">
              <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                Saved
              </span>
            </div>
          )}
          {compatibilityMode && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
              <AlertTriangle className="w-3 h-3 text-destructive" />
              <span className="text-[10px] font-medium text-destructive uppercase tracking-wider">
                Legacy
              </span>
            </div>
          )}
        </div>
      </DialogTitle>
    </DialogHeader>
  )
}

/* ─── Stat Pill ─────────────────────────────────────────────────────────────── */

function StatPill({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode
  value: string
  label: string
  accent: 'rose' | 'gray' | 'blue'
}) {
  const colors = {
    rose: 'text-destructive',
    gray: 'text-muted-foreground',
    blue: 'text-primary',
  }

  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-r border-border last:border-r-0">
      <span className={colors[accent]}>{icon}</span>
      <span className="text-[12px] font-semibold text-foreground tabular-nums font-mono">
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}
