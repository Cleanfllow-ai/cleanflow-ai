/**
 * quarantine-editor-toolbar.tsx
 *
 * Clean, minimal toolbar — professional light theme.
 */

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardCheck, Loader2, Play, Check, Save, Search, Shield, Users, Clock, X, GitCompare, CheckSquare, Wand2 } from 'lucide-react'
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
  /** Bug 21 (Bulk Fix UI): count of currently-selected rows.  When > 0
   *  the bulk-actions sub-toolbar is rendered.  Owned by the parent so
   *  the page can drive a server-side batch edit + close the dialog. */
  bulkSelectedCount?: number
  onBulkApplyValue?: () => void
  onBulkMarkFixed?: () => void
  onBulkClearSelection?: () => void
  bulkApplying?: boolean
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
  bulkSelectedCount = 0,
  onBulkApplyValue,
  onBulkMarkFixed,
  onBulkClearSelection,
  bulkApplying = false,
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
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 gap-1.5">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 gap-1.5">
            <Clock className="h-3 w-3" />
            Pending approval
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 gap-1.5">
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
            <LegendDot color="bg-orange-500" label="Fixed" />
            <LegendDot color="bg-red-400" label="Quarantined" />
            <LegendDot color="bg-blue-500" label="Edited" />
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

      {/* Bug 21: Bulk Actions sub-toolbar — renders only when at least one
          row is selected via the leftmost checkbox column.  Uses the same
          button styling as Find & Replace / Compare so it visually matches
          the existing toolbar.  Wired up by the page component. */}
      {bulkSelectedCount > 0 && (
        <div
          data-testid="bulk-actions-toolbar"
          className="mt-2 flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-1.5"
        >
          <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
          <span
            data-testid="bulk-actions-selected-count"
            className="text-xs font-medium text-blue-800"
          >
            {bulkSelectedCount.toLocaleString()} row{bulkSelectedCount === 1 ? '' : 's'} selected
          </span>
          <div className="ml-2 flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onBulkApplyValue}
              disabled={bulkApplying || !onBulkApplyValue}
              data-testid="bulk-apply-value-button"
              className="h-7 text-xs font-medium px-3"
            >
              {bulkApplying ? (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3 mr-1.5" />
              )}
              Apply value to all
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkMarkFixed}
              disabled={bulkApplying || !onBulkMarkFixed}
              data-testid="bulk-mark-fixed-button"
              className="h-7 text-xs font-medium px-3"
            >
              <Check className="w-3 h-3 mr-1.5" />
              Mark as fixed
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBulkClearSelection}
              disabled={bulkApplying}
              data-testid="bulk-clear-selection-button"
              className="h-7 text-xs font-medium px-3"
            >
              <X className="w-3 h-3 mr-1.5" />
              Clear selection
            </Button>
          </div>
        </div>
      )}

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
