/**
 * quarantine-editor-toolbar.tsx
 *
 * Clean, minimal toolbar — professional light theme.
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
    <div className="px-5 py-2 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={submitting || !session}
            onClick={onReprocess}
            className="h-7 text-xs font-medium px-4"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3 h-3 mr-1.5 fill-current" />
            )}
            Reprocess
          </Button>

          {/* Color legend */}
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
            <LegendDot color="bg-transparent border border-border" label="Clean" />
            <LegendDot color="bg-orange-500" label="Fixed" />
            <LegendDot color="bg-red-400" label="Quarantined" />
            <LegendDot color="bg-blue-500" label="Edited" />
          </div>
        </div>

        {/* Right: Save status + session */}
        <div className="flex items-center gap-3">
          {saving ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Save className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[11px] font-medium">Saving...</span>
            </div>
          ) : showSaved ? (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Check className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">Saved</span>
            </div>
          ) : null}
          {session && (
            <span className="text-[10px] text-muted-foreground/60 font-mono tabular-nums">
              {session.session_id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <p className="mt-1.5 mb-0.5 text-[10.5px] text-muted-foreground flex items-center gap-1.5">
        <kbd className="inline-flex items-center justify-center h-4 px-1 rounded bg-muted border border-border text-[9px] font-mono text-muted-foreground">
          Click
        </kbd>
        <span>to edit</span>
        <kbd className="inline-flex items-center justify-center h-4 px-1 rounded bg-muted border border-border text-[9px] font-mono text-muted-foreground">
          Enter
        </kbd>
        <span>to save</span>
        <kbd className="inline-flex items-center justify-center h-4 px-1 rounded bg-muted border border-border text-[9px] font-mono text-muted-foreground">
          Esc
        </kbd>
        <span>to cancel</span>
        <span className="text-border mx-0.5">|</span>
        <span>Auto-saves in background</span>
      </p>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  )
}
