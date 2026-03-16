/**
 * quarantine-editor-header.tsx
 *
 * "Data Command Center" header — dark slate gradient with
 * precision status indicators and file metadata.
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
      <DialogHeader className="px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <DialogTitle className="text-sm font-semibold text-slate-200 tracking-wide"
          style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
        >
          Quarantine Editor
        </DialogTitle>
      </DialogHeader>
    )
  }

  const totalColumns = manifest.columns.length
  const editableColumns = manifest.editable_columns.filter((c) => c !== 'row_id').length

  return (
    <DialogHeader className="px-5 py-0 border-b border-slate-700/50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
      <DialogTitle className="flex items-center gap-0 py-0">
        {/* Title */}
        <div className="flex items-center gap-2 pr-5 py-2.5 border-r border-slate-700/50">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span
            className="text-[13px] font-semibold text-slate-100 tracking-wide"
            style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
          >
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
            accent="slate"
          />
          <StatPill
            icon={<Pencil className="w-3 h-3" />}
            value={editableColumns.toLocaleString()}
            label="editable"
            accent="sky"
          />
        </div>

        {/* Save status — right-aligned */}
        <div className="ml-auto flex items-center gap-2 pl-4">
          {pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/25">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
              <span className="text-[11px] font-medium text-amber-300 tabular-nums"
                style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
              >
                {pendingCount} unsaved
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-400"
                style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
              >
                saved
              </span>
            </div>
          )}
          {compatibilityMode && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/15 border border-red-500/25">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-medium text-red-300 uppercase tracking-wider"
                style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
              >
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
  accent: 'rose' | 'slate' | 'sky'
}) {
  const colors = {
    rose: 'text-rose-400',
    slate: 'text-slate-400',
    sky: 'text-sky-400',
  }

  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-r border-slate-700/50 last:border-r-0">
      <span className={colors[accent]}>{icon}</span>
      <span className="text-[12px] font-semibold text-slate-200 tabular-nums"
        style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
      >
        {value}
      </span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider"
        style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
      >
        {label}
      </span>
    </div>
  )
}
