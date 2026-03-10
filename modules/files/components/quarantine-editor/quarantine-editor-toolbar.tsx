/**
 * quarantine-editor-toolbar.tsx
 *
 * Toolbar component with action buttons for quarantine editor
 */

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Play, CloudUpload, Wand2 } from 'lucide-react'
import type { QuarantineSession } from '@/modules/files/types'

interface QuarantineEditorToolbarProps {
  session: QuarantineSession | null
  saving: boolean
  submitting: boolean
  savedAt?: Date | null
  onReprocess: () => void
  onOpenCustomRule: () => void
}

export function QuarantineEditorToolbar({
  session,
  saving,
  submitting,
  savedAt,
  onReprocess,
  onOpenCustomRule,
}: QuarantineEditorToolbarProps) {
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setShowSaved(true)
    const timer = setTimeout(() => setShowSaved(false), 3000)
    return () => clearTimeout(timer)
  }, [savedAt])

  return (
    <div className="px-6 py-3 border-b bg-muted/5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" disabled={submitting || !session} onClick={onReprocess}>
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1.5" />
            )}
            Reprocess
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!session}
            onClick={onOpenCustomRule}
            className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300"
          >
            <Wand2 className="w-4 h-4 mr-1" />
            AI Fix
          </Button>
        </div>

        {/* Right: Autosave status + session */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving…
            </span>
          ) : showSaved ? (
            <span className="flex items-center gap-1 text-green-600 transition-opacity duration-500">
              <CloudUpload className="w-3.5 h-3.5" />
              Saved
            </span>
          ) : null}
          {session && <span className="text-xs opacity-50">Session {session.session_id.slice(0, 8)}</span>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-1 h-1 rounded-full bg-blue-500" />
          Click a cell to edit · auto-saves in the background
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {[
            { key: "Enter", label: "confirm" },
            { key: "Esc", label: "cancel" },
            { key: "Tab", label: "next cell" },
            { key: "↑↓", label: "navigate" },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                {key}
              </kbd>
              <span className="opacity-60">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
