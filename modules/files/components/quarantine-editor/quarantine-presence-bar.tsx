/**
 * quarantine-presence-bar.tsx
 *
 * Colored avatar circles showing connected collaborators.
 */

'use client'

import type { CollaborationUser } from '@/modules/files/types'

interface QuarantinePresenceBarProps {
  users: CollaborationUser[]
  connected: boolean
}

export function QuarantinePresenceBar({ users, connected }: QuarantinePresenceBarProps) {
  if (!connected && users.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {!connected && (
        <span className="text-[10px] text-amber-600 font-medium">Reconnecting...</span>
      )}
      <div className="flex -space-x-1">
        {users.map((user) => (
          <div
            key={user.id}
            className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
            style={{ backgroundColor: user.color }}
            title={`${user.displayName}${user.activeCell ? ` — editing ${user.activeCell}` : ''}`}
          >
            {user.displayName[0]?.toUpperCase() || '?'}
          </div>
        ))}
      </div>
      {users.length > 1 && (
        <span className="text-[10px] text-muted-foreground font-medium">
          {users.length} editing
        </span>
      )}
    </div>
  )
}
