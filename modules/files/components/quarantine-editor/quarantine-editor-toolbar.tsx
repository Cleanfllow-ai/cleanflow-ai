/**
 * quarantine-editor-toolbar.tsx
 *
 * Action toolbar with reprocess button, save status, color legend,
 * and editing instructions — "Data Command Center" aesthetic.
 */

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Play, Check, Save } from 'lucide-react'
import type { QuarantineSession } from '@/modules/files/types'

interface QuarantineEditorToolbarProps {
  session: QuarantineSession | null
  saving: boolean
  submitting: boolean
  savedAt?: Date | null
  onReprocess: () => void
  onOpenCustomRule?: () => void
}

export function QuarantineEditorToolbar({
  session,
  saving,
  submitting,
  savedAt,
  onReprocess,
}: QuarantineEditorToolbarProps) {
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setShowSaved(true)
    const timer = setTimeout(() => setShowSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [savedAt])

  return (
    <div
      className="px-5 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white"
      style={{ fontFamily: "'DM Sans', var(--font-sans, system-ui, sans-serif)" }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={submitting || !session}
            onClick={onReprocess}
            className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm px-4 h-7 text-xs font-semibold tracking-wide"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3 h-3 mr-1.5 fill-current" />
            )}
            Reprocess
          </Button>

          {/* Color legend */}
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200">
            <LegendDot color="bg-emerald-400" label="Clean" />
            <LegendDot color="bg-amber-400" label="Fixed" />
            <LegendDot color="bg-rose-400" label="Quarantined" />
            <LegendDot color="bg-indigo-400" label="Edited" />
          </div>
        </div>

        {/* Right: Save status + session */}
        <div className="flex items-center gap-3">
          {saving ? (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Save className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[11px] font-medium">Saving...</span>
            </div>
          ) : showSaved ? (
            <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in duration-300">
              <Check className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Saved</span>
            </div>
          ) : null}
          {session && (
            <span className="text-[10px] text-slate-400 font-mono tabular-nums">
              {session.session_id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <p className="mt-1.5 mb-0.5 text-[10.5px] text-slate-400 flex items-center gap-1.5">
        <kbd className="inline-flex items-center justify-center h-4 px-1 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-500">
          Click
        </kbd>
        <span>to edit</span>
        <kbd className="inline-flex items-center justify-center h-4 px-1 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-500">
          Enter
        </kbd>
        <span>to save</span>
        <kbd className="inline-flex items-center justify-center h-4 px-1 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-500">
          Esc
        </kbd>
        <span>to cancel</span>
        <span className="text-slate-300 mx-0.5">|</span>
        <span>Auto-saves in background</span>
      </p>
    </div>
  )
}

/* ─── Legend Dot ────────────────────────────────────────────────────────────── */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
    </div>
  )
}
