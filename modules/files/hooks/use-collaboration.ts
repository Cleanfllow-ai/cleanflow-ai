/**
 * use-collaboration.ts
 *
 * High-level collaboration hook — presence, cell locks, activity feed.
 * Wraps useWebSocket and manages all collaboration state.
 */

'use client'

import { useCallback, useRef, useState } from 'react'
import { useWebSocket } from './use-websocket'
import type {
  CollaborationUser,
  CellLockInfo,
  ActivityEntry,
  WsServerMessage,
  WsUserInfo,
} from '@/modules/files/types'

const MAX_ACTIVITY_ENTRIES = 50

interface UseCollaborationParams {
  uploadId: string
  accessToken: string | null
  enabled: boolean
  onRemoteCellUpdate?: (column: string, rowId: string, value: string) => void
}

function toCollabUser(u: WsUserInfo): CollaborationUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    color: u.color,
    activeCell: u.active_cell || '',
  }
}

export function useCollaboration({
  uploadId,
  accessToken,
  enabled,
  onRemoteCellUpdate,
}: UseCollaborationParams) {
  const [users, setUsers] = useState<CollaborationUser[]>([])
  const [cellLocks, setCellLocks] = useState<Map<string, CellLockInfo>>(new Map())
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [lockDeniedCell, setLockDeniedCell] = useState<string | null>(null)

  // Ref for cell locks — used by AG Grid cellClass callback
  const cellLocksRef = useRef<Map<string, CellLockInfo>>(new Map())

  const usersRef = useRef<CollaborationUser[]>([])

  // Stable ref for remote cell update callback to avoid re-creating WebSocket
  const onRemoteCellUpdateRef = useRef(onRemoteCellUpdate)
  onRemoteCellUpdateRef.current = onRemoteCellUpdate

  const addActivity = useCallback((text: string) => {
    setActivity((prev) => [{ text, timestamp: new Date() }, ...prev].slice(0, MAX_ACTIVITY_ENTRIES))
  }, [])

  const getUserName = useCallback((userId: string) => {
    return usersRef.current.find((u) => u.id === userId)?.displayName || 'Someone'
  }, [])

  const handleMessage = useCallback((message: WsServerMessage) => {
    switch (message.type) {
      case 'presence':
        {
          const mapped = message.users.map(toCollabUser)
          setUsers(mapped)
          usersRef.current = mapped
        }
        break

      case 'userJoined':
        setUsers((prev) => {
          const next = [...prev.filter((u) => u.id !== message.user.id), toCollabUser(message.user)]
          usersRef.current = next
          return next
        })
        addActivity(`${message.user.display_name} joined`)
        break

      case 'userLeft':
        {
          const departingName = getUserName(message.userId)
          setUsers((prev) => {
            const next = prev.filter((u) => u.id !== message.userId)
            usersRef.current = next
            return next
          })
          setCellLocks((prev) => {
            const next = new Map(prev)
            for (const [key, lock] of next) {
              if (lock.userId === message.userId) next.delete(key)
            }
            cellLocksRef.current = next
            return next
          })
          addActivity(`${departingName} left`)
        }
        break

      case 'cellLocked':
        setCellLocks((prev) => {
          const next = new Map(prev)
          next.set(message.cell, {
            userId: message.user.id,
            displayName: message.user.display_name,
            color: message.user.color,
          })
          cellLocksRef.current = next
          return next
        })
        // Update user's active cell
        setUsers((prev) => {
          const next = prev.map((u) =>
            u.id === message.user.id ? { ...u, activeCell: message.cell } : u,
          )
          usersRef.current = next
          return next
        })
        break

      case 'cellUnlocked':
        setCellLocks((prev) => {
          const next = new Map(prev)
          next.delete(message.cell)
          cellLocksRef.current = next
          return next
        })
        break

      case 'cellChanged':
        addActivity(`${getUserName(message.userId)} edited ${message.cell}`)
        console.log('[Collab] cellChanged received:', { cell: message.cell, value: message.value, hasCallback: !!onRemoteCellUpdateRef.current })
        if (onRemoteCellUpdateRef.current && message.cell && message.value !== undefined) {
          const [column, ...rowParts] = message.cell.split(':')
          const rowId = rowParts.join(':')
          console.log('[Collab] Dispatching remote update:', { column, rowId, value: message.value })
          if (column && rowId) {
            onRemoteCellUpdateRef.current(column, rowId, message.value)
          }
        }
        break

      case 'bulkChanged':
        addActivity(message.summary)
        break

      case 'cellLockDenied':
        // Signal page to cancel in-progress cell edit
        setLockDeniedCell(message.cell)
        addActivity(`Cell ${message.cell} is locked by another user`)
        // Auto-clear after 100ms (just a signal pulse)
        setTimeout(() => setLockDeniedCell(null), 100)
        break
    }
  }, [addActivity, getUserName])

  const { connected, send } = useWebSocket({
    fileId: uploadId,
    accessToken,
    enabled,
    onMessage: handleMessage,
  })

  const focusCell = useCallback((column: string, rowId: string) => {
    send({ action: 'cellFocus', cell: `${column}:${rowId}` })
  }, [send])

  const blurCell = useCallback((column: string, rowId: string) => {
    send({ action: 'cellBlur', cell: `${column}:${rowId}` })
  }, [send])

  const broadcastCellUpdate = useCallback((column: string, rowId: string, value: string) => {
    send({ action: 'cellUpdate', cell: `${column}:${rowId}`, value })
  }, [send])

  const broadcastBulkUpdate = useCallback((count: number, summary: string) => {
    send({ action: 'bulkUpdate', count, summary })
  }, [send])

  const isCellLockedByOther = useCallback((column: string, rowId: string): CellLockInfo | null => {
    return cellLocksRef.current.get(`${column}:${rowId}`) || null
  }, [])

  return {
    connected,
    users,
    cellLocks,
    cellLocksRef,
    lockDeniedCell,
    activity,
    panelOpen,
    setPanelOpen,
    focusCell,
    blurCell,
    broadcastCellUpdate,
    broadcastBulkUpdate,
    isCellLockedByOther,
  }
}
