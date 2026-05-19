/**
 * quarantine-presence-bar.tsx
 *
 * Google-Sheets-style colored avatar circles showing connected collaborators
 * across the top of the editor. Hovering an avatar shows a richer tooltip
 * (name, email, currently-edited cell). When peers exceed the visible cap
 * we collapse the overflow into a "+N" badge.
 */

'use client'

import { useState } from 'react'
import type { CollaborationUser } from '@/modules/files/types'

interface QuarantinePresenceBarProps {
  users: CollaborationUser[]
  connected: boolean
}

const MAX_AVATARS_VISIBLE = 4

/**
 * initialFor — single-letter avatar label.
 *
 * The backend now guarantees displayName is non-empty (OrgMembers fallback
 * chain → email-local-part → "User-XXXX"). We still defend against an empty
 * string here so a stale Lambda or an unexpected message shape never renders
 * a literal "?" — that was the symptom users reported on 2026-05-09.
 */
function initialFor(user: CollaborationUser): string {
  const source = user.displayName || user.email || user.id
  const ch = source ? source.charAt(0) : 'U'
  return ch.toUpperCase()
}

function tooltipFor(user: CollaborationUser): string {
  const parts: string[] = [user.displayName || 'User']
  if (user.email && user.email !== user.displayName) parts.push(`<${user.email}>`)
  if (user.activeCell) parts.push(`— editing ${user.activeCell}`)
  return parts.join(' ')
}

export function QuarantinePresenceBar({ users, connected }: QuarantinePresenceBarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (!connected && users.length === 0) return null

  const visible = users.slice(0, MAX_AVATARS_VISIBLE)
  const overflow = users.length - visible.length

  return (
    <div className="flex items-center gap-2">
      {!connected && (
        <span className="text-[10px] font-medium text-amber-600">Reconnecting…</span>
      )}
      {connected && users.length === 0 && (
        <span className="text-[10px] font-medium text-muted-foreground">Only you</span>
      )}
      <div className="flex -space-x-1.5">
        {visible.map((user) => {
          const isActive = Boolean(user.activeCell)
          return (
            <div
              key={user.id}
              className="relative"
              onMouseEnter={() => setHoveredId(user.id)}
              onMouseLeave={() => setHoveredId((id) => (id === user.id ? null : id))}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-sm transition-transform duration-150 hover:z-10 hover:scale-110"
                style={{ backgroundColor: user.color }}
                aria-label={tooltipFor(user)}
              >
                {initialFor(user)}
              </div>
              {isActive && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white"
                  style={{ backgroundColor: user.color }}
                  aria-hidden
                />
              )}
              {hoveredId === user.id && (
                <div className="pointer-events-none absolute left-1/2 top-9 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                  <div>{user.displayName || 'User'}</div>
                  {user.email && user.email !== user.displayName && (
                    <div className="text-[9px] opacity-75">{user.email}</div>
                  )}
                  {user.activeCell && (
                    <div className="text-[9px] opacity-75">editing {user.activeCell}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {overflow > 0 && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-300 text-[10px] font-semibold text-slate-800 shadow-sm"
            title={users
              .slice(MAX_AVATARS_VISIBLE)
              .map((u) => u.displayName || u.email || u.id)
              .join(', ')}
          >
            +{overflow}
          </div>
        )}
      </div>
      {users.length > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground">
          {users.length === 1 ? '1 viewer' : `${users.length} viewers`}
        </span>
      )}
    </div>
  )
}
