/**
 * quarantine-editor-toolbar.tsx
 *
 * Clean, minimal toolbar — professional light theme.
 */

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardCheck, Loader2, Play, Check, Save, Search, Shield, Users, Clock, X, GitCompare } from 'lucide-react'
import type { QuarantineSession } from '@/modules/files/types'
import type { CollaborationUser } from '@/modules/files/types'
import type { ApprovalStatus } from '@/modules/auth/api/org-api'
import { QuarantinePresenceBar } from './quarantine-presence-bar'
import { QuarantineColumnToggle } from './quarantine-column-toggle'

interface QuarantineEditorToolbarProps {
  session: QuarantineSession | null
  saving: boolean
  submitting: boolean
  savedAt?: Date | null
  currentUserRole: string | null
  approvalStatus: ApprovalStatus | 'NONE'
  approvalLoading?: boolean
  onPrimaryAction: () => void | Promise<void>
  onFindReplace?: () => void
  onCompare?: () => void
  compareDisabled?: boolean
  columns?: string[]
  hiddenColumns?: Set<string>
  onToggleColumn?: (column: string) => void
  onShowAllColumns?: () => void
  onHideAllColumns?: () => void
  collabConnected?: boolean
  collabUsers?: CollaborationUser[]
  collabPanelOpen?: boolean
  onToggleCollabPanel?: () => void
}

export function QuarantineEditorToolbar({
  session,
  saving,
  submitting,
  savedAt,
  currentUserRole,
  approvalStatus,
  approvalLoading = false,
  onPrimaryAction,
  onFindReplace,
  onCompare,
  compareDisabled = false,
  columns,
  hiddenColumns,
  onToggleColumn,
  onShowAllColumns,
  onHideAllColumns,
  collabConnected,
  collabUsers,
  collabPanelOpen,
  onToggleCollabPanel,
}: QuarantineEditorToolbarProps) {
  const [showSaved, setShowSaved] = useState(false)
  const isSuperAdmin = currentUserRole === 'Super Admin'

  const primaryLabel = (() => {
    if (isSuperAdmin) return 'Reprocess'
    if (approvalLoading) return 'Checking approval...'

    switch (approvalStatus) {
      case 'APPROVED':
        return 'Approved - Reprocess'
      case 'PENDING':
        return 'Awaiting Approval'
      case 'REJECTED':
        return 'Re-request Approval'
      default:
        return 'Request Approval'
    }
  })()

  const statusBadge = (() => {
    if (isSuperAdmin) {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Shield className="h-3 w-3" />
          Super Admin
        </Badge>
      )
    }

    if (approvalLoading) {
      return (
        <Badge variant="outline" className="gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking approval
        </Badge>
      )
    }

    switch (approvalStatus) {
      case 'APPROVED':
        return (
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-1000/10 text-emerald-600 gap-1.5">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-1000/10 text-amber-600 gap-1.5">
            <Clock className="h-3 w-3" />
            Pending approval
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="outline" className="border-red-500/40 bg-red-1000/10 text-red-600 gap-1.5">
            <X className="h-3 w-3" />
            Rejected
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1.5">
            <ClipboardCheck className="h-3 w-3" />
            Approval required
          </Badge>
        )
    }
  })()

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={submitting || approvalLoading || !session}
              onClick={() => void onPrimaryAction()}
              className="h-7 text-xs font-medium px-4"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : isSuperAdmin || approvalStatus === 'APPROVED' ? (
                <Play className="w-3 h-3 mr-1.5 fill-current" />
              ) : (
                <ClipboardCheck className="w-3 h-3 mr-1.5" />
              )}
              {primaryLabel}
            </Button>
            {statusBadge}
          </div>

          {onFindReplace && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFindReplace}
              className="h-7 text-xs font-medium px-3 ml-1"
            >
              <Search className="w-3 h-3 mr-1.5" />
              Find & Replace
            </Button>
          )}

          {onCompare && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCompare}
              disabled={compareDisabled}
              className="h-7 text-xs font-medium px-3"
              title={compareDisabled ? 'Click a row in the grid first' : 'Compare original vs cleaned values for the focused row'}
            >
              <GitCompare className="w-3 h-3 mr-1.5" />
              Compare
            </Button>
          )}

          {columns && hiddenColumns && onToggleColumn && onShowAllColumns && onHideAllColumns && (
            <QuarantineColumnToggle
              columns={columns}
              hiddenColumns={hiddenColumns}
              onToggleColumn={onToggleColumn}
              onShowAll={onShowAllColumns}
              onHideAll={onHideAllColumns}
            />
          )}

          {/* Color legend */}
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
            <LegendDot color="bg-transparent border border-border" label="Clean" />
            <LegendDot color="bg-orange-1000" label="Fixed" />
            <LegendDot color="bg-red-400" label="Quarantined" />
            <LegendDot color="bg-blue-1000" label="Edited" />
          </div>
        </div>

        {/* Right: Collab + Save status + session */}
        <div className="flex items-center gap-3">
          {collabUsers && (
            <QuarantinePresenceBar users={collabUsers} connected={collabConnected ?? false} />
          )}
          {onToggleCollabPanel && (
            <Button
              variant={collabPanelOpen ? 'secondary' : 'outline'}
              size="sm"
              onClick={onToggleCollabPanel}
              className="h-7 text-xs font-medium px-3"
            >
              <Users className="w-3 h-3 mr-1.5" />
              Collab
            </Button>
          )}
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
