/**
 * quarantine-collaboration-panel.tsx
 *
 * Right sidebar showing collaborators and activity feed.
 */

'use client'

import { X } from 'lucide-react'
import type { CollaborationUser, ActivityEntry } from '@/modules/files/types'

interface QuarantineCollaborationPanelProps {
  users: CollaborationUser[]
  activity: ActivityEntry[]
  connected: boolean
  onClose: () => void
}

export function QuarantineCollaborationPanel({
  users,
  activity,
  connected,
  onClose,
}: QuarantineCollaborationPanelProps) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Collaborators</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Connection status */}
      {!connected && (
        <div className="border-b border-border bg-amber-50 px-3 py-1.5">
          <span className="text-[10px] font-medium text-amber-700">Reconnecting...</span>
        </div>
      )}

      {/* User list */}
      <div className="flex-shrink-0 overflow-auto border-b border-border">
        {users.length === 0 ? (
          <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
            No other users connected
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50"
            >
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.displayName[0]?.toUpperCase() || '?'}
              </div>
              <span className="flex-1 truncate text-xs font-medium">{user.displayName}</span>
              <span className="text-[10px] text-muted-foreground">
                {user.activeCell || 'idle'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Activity feed */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </span>
        </div>
        <div className="flex-1 overflow-auto px-3">
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
