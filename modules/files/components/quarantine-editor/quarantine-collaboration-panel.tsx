/**
 * quarantine-collaboration-panel.tsx
 *
 * Right sidebar showing collaborators (Google-Sheets-style) and activity feed.
 * The current user is rendered first as "You", peers below sorted by who is
 * actively editing a cell.
 */

'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { CollaborationUser, ActivityEntry } from '@/modules/files/types'

interface QuarantineCollaborationPanelProps {
  users: CollaborationUser[]
  activity: ActivityEntry[]
  connected: boolean
  onClose: () => void
  /** Cognito sub of the current user — rendered as "You" if found in users[]. */
  currentUserId?: string
}

/**
 * initialFor — same defensive fallback as the presence bar.
 * The literal "?" rendering on 2026-05-09 was traced to empty display_name
 * in the WSConnections row (Cognito access tokens carry no email claim).
 * Backend is now fixed but we keep the defence here too.
 */
function initialFor(user: CollaborationUser): string {
  const source = user.displayName || user.email || user.id
  return source ? source.charAt(0).toUpperCase() : 'U'
}

export function QuarantineCollaborationPanel({
  users,
  activity,
  connected,
  onClose,
  currentUserId,
}: QuarantineCollaborationPanelProps) {
  // Sort: current user first, then editors with active_cell, then idle by name.
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aSelf = currentUserId && a.id === currentUserId ? 0 : 1
      const bSelf = currentUserId && b.id === currentUserId ? 0 : 1
      if (aSelf !== bSelf) return aSelf - bSelf
      const aActive = a.activeCell ? 0 : 1
      const bActive = b.activeCell ? 0 : 1
      if (aActive !== bActive) return aActive - bActive
      return (a.displayName || '').localeCompare(b.displayName || '')
    })
  }, [users, currentUserId])

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Collaborators</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {users.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          aria-label="Close collaborators panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Connection status */}
      {!connected && (
        <div className="border-b border-border bg-amber-100 px-3 py-1.5">
          <span className="text-[10px] font-medium text-amber-800">Reconnecting…</span>
        </div>
      )}

      {/* User list */}
      <div className="flex-shrink-0 overflow-auto border-b border-border">
        {sortedUsers.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
            {connected ? 'You are the only one here' : 'Waiting for connection…'}
          </div>
        ) : (
          sortedUsers.map((user) => {
            const isSelf = currentUserId && user.id === currentUserId
            return (
              <div
                key={user.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50"
              >
                <div className="relative shrink-0">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: user.color }}
                  >
                    {initialFor(user)}
                  </div>
                  {user.activeCell && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white"
                      style={{ backgroundColor: user.color }}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">
                      {user.displayName || 'User'}
                    </span>
                    {isSelf && (
                      <span className="rounded bg-muted px-1 text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
                        you
                      </span>
                    )}
                  </div>
                  {user.email && user.email !== user.displayName && (
                    <div className="truncate text-[9px] text-muted-foreground">{user.email}</div>
                  )}
                </div>
                <span className="text-[9px] font-medium text-muted-foreground">
                  {user.activeCell ? `editing ${user.activeCell}` : 'idle'}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Activity feed */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </span>
        </div>
        <div className="flex-1 overflow-auto px-3 pb-2">
          {activity.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">No activity yet</span>
          ) : (
            activity.map((entry, i) => (
              <div key={i} className="py-0.5 text-[10px] text-muted-foreground">
                <span>{entry.text}</span>
                <span className="ml-1.5 opacity-50">
                  {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
