/**
 * use-collaboration.ts
 *
 * High-level collaboration hook — presence, cell locks, activity feed.
 * Wraps useWebSocket and manages all collaboration state.
 */

'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useWebSocket } from './use-websocket'
import type {
  CollaborationUser,
  CellLockInfo,
  ActivityEntry,
  WsServerMessage,
  WsUserInfo,
} from '@/modules/files/types'

const MAX_ACTIVITY_ENTRIES = 50

/**
 * PRESENCE_STALE_THRESHOLD_MS — Case 4.
 * Presence pills for users whose last message was received more than 90 s
 * ago are hidden from the UI. The server pushes presenceSync every 30 s on
 * heartbeat, so a 90 s threshold allows up to 3 missed heartbeats before a
 * user is considered stale. DDB WSConnections TTL is 15 min, so this client-
 * side filter catches disconnected-but-not-yet-reaped peers much faster.
 */
const PRESENCE_STALE_THRESHOLD_MS = 90_000

/** Server reply to a bulkLockAcquire/Release operation (#7). */
export interface BulkLockResultMessage {
  operationId: string
  acquired: boolean
  cells?: string[]
  conflicting?: string[]
  reason?: string
}

interface UseCollaborationParams {
  uploadId: string
  accessToken: string | null
  enabled: boolean
  onRemoteCellUpdate?: (column: string, rowId: string, value: string) => void
}

/**
 * resolveDisplayName — defence-in-depth fallback for the FE.
 *
 * The backend now populates display_name from OrgMembers (with email-local-part
 * and a User-XXXX fallback), so this should rarely fire. We keep the chain
 * here so a stale Lambda or a partial deploy never surfaces a literal "?":
 *   display_name → email local-part → "User-XXXX" (first 4 of id) → "User"
 */
function resolveDisplayName(u: WsUserInfo): string {
  if (u.display_name && u.display_name.trim()) return u.display_name.trim()
  if (u.email) {
    const at = u.email.indexOf('@')
    if (at > 0) return u.email.slice(0, at)
    if (u.email.trim()) return u.email
  }
  if (u.id && u.id.length >= 4) return `User-${u.id.slice(0, 4)}`
  return 'User'
}

function toCollabUser(u: WsUserInfo, now?: number): CollaborationUser {
  return {
    id: u.id,
    email: u.email || '',
    displayName: resolveDisplayName(u),
    color: u.color,
    activeCell: u.active_cell || '',
    lastSeen: u.last_seen ?? now ?? Date.now(),
  }
}

/**
 * filterStaleUsers — Case 4.
 * Removes users whose lastSeen is older than PRESENCE_STALE_THRESHOLD_MS.
 * Called before rendering the presence bar and collaboration panel.
 */
function filterStaleUsers(users: CollaborationUser[], now: number): CollaborationUser[] {
  return users.filter(
    (u) => u.lastSeen === undefined || now - u.lastSeen <= PRESENCE_STALE_THRESHOLD_MS,
  )
}

/**
 * mergePresenceSnapshot — replaces the local users list with the server
 * snapshot WITHOUT losing local-only state. Stable user identity = `id`.
 *
 * All merged users get their lastSeen stamped to `now` since the server is
 * telling us they are active (Case 4 — prevents immediate stale-filter on
 * users we've never seen a heartbeat from).
 */
function mergePresenceSnapshot(snapshot: WsUserInfo[], now?: number): CollaborationUser[] {
  const ts = now ?? Date.now()
  const seen = new Set<string>()
  const out: CollaborationUser[] = []
  for (const u of snapshot) {
    if (!u.id || seen.has(u.id)) continue
    seen.add(u.id)
    out.push(toCollabUser(u, ts))
  }
  return out
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

  // Lock-hole #1 fix: track cells confirmed by cellLockGranted from the server.
  // The editable predicate uses this to distinguish "I hold this lock" from
  // "someone holds this lock" and from "no lock yet (race window)".
  // - pending: sent cellFocus, waiting for server ack
  // - granted: server replied cellLockGranted — I own this cell
  const pendingLockCellsRef = useRef<Set<string>>(new Set())
  const myGrantedCellsRef = useRef<Set<string>>(new Set())

  const usersRef = useRef<CollaborationUser[]>([])

  // ── Bulk lock resolution registry (#7) ───────────────────────────────
  // Each acquireBulkLocks call registers its operationId and waits on a
  // Promise that resolves when the matching `bulkLockResult` message
  // arrives from the server. Timeout-safe: caller can race against a
  // setTimeout if the WS layer hangs.
  const bulkLockResolversRef = useRef<
    Map<string, (m: BulkLockResultMessage) => void>
  >(new Map())

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
          const now = Date.now()
          const mapped = mergePresenceSnapshot(message.users, now)
          setUsers(mapped)
          usersRef.current = mapped
        }
        break

      case 'presenceSync':
        {
          // Server-authoritative peer list pushed every heartbeat (~30s).
          // Replaces local state to self-heal any missed userJoined/userLeft
          // deltas. We diff against the previous list to surface join/leave
          // activity even when the original delta was lost in flight.
          const now = Date.now()
          const incoming = mergePresenceSnapshot(message.users, now)
          const prev = usersRef.current
          const prevIds = new Set(prev.map((u) => u.id))
          const nextIds = new Set(incoming.map((u) => u.id))
          for (const u of incoming) {
            if (!prevIds.has(u.id)) addActivity(`${u.displayName} joined`)
          }
          for (const u of prev) {
            if (!nextIds.has(u.id)) addActivity(`${u.displayName} left`)
          }
          setUsers(incoming)
          usersRef.current = incoming
          // Drop cell locks belonging to peers no longer in the room.
          setCellLocks((locks) => {
            let mutated = false
            const next = new Map(locks)
            for (const [key, lock] of next) {
              if (!nextIds.has(lock.userId)) {
                next.delete(key)
                mutated = true
              }
            }
            if (mutated) cellLocksRef.current = next
            return mutated ? next : locks
          })
        }
        break

      case 'lockSnapshot':
        {
          // Case 5 — reconnect lock reconciliation.
          // Replace local cell-lock state with the server's authoritative
          // snapshot. Called immediately after a successful reconnect in
          // response to the requestSnapshot action we send from onConnect.
          // This avoids replaying all messages since session start.
          setCellLocks(() => {
            const next = new Map<string, CellLockInfo>()
            for (const entry of message.locks) {
              next.set(entry.cell, {
                userId: entry.user_id,
                displayName: entry.display_name,
                color: entry.color,
              })
            }
            cellLocksRef.current = next
            return next
          })
        }
        break

      case 'userJoined':
        {
          const joining = toCollabUser(message.user, Date.now())
          setUsers((prev) => {
            const next = [...prev.filter((u) => u.id !== joining.id), joining]
            usersRef.current = next
            return next
          })
          addActivity(`${joining.displayName} joined`)
        }
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
        {
          // Use the FE fallback chain for the lock badge label so peers whose
          // display_name didn't propagate render with a meaningful initial
          // (e.g. "U" from "User-abcd") instead of "?".
          const lockedName = resolveDisplayName({
            id: message.user.id,
            email: '',
            display_name: message.user.display_name,
            color: message.user.color,
          })
          setCellLocks((prev) => {
            const next = new Map(prev)
            next.set(message.cell, {
              userId: message.user.id,
              displayName: lockedName,
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
        }
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

      case 'cellLockGranted':
        // Lock-hole #1 fix: server explicitly confirms we own the lock.
        // Move the cell from pending → granted so the editable predicate
        // can flip from held-by-me-pending → held-by-me.
        pendingLockCellsRef.current.delete(message.cell)
        myGrantedCellsRef.current.add(message.cell)
        break

      case 'cellLockDenied':
        // Lock-hole #1 fix: remove from pending — we lost the race.
        pendingLockCellsRef.current.delete(message.cell)
        // Signal page to cancel in-progress cell edit
        setLockDeniedCell(message.cell)
        addActivity(`Cell ${message.cell} is locked by another user`)
        // Auto-clear after 100ms (just a signal pulse)
        setTimeout(() => setLockDeniedCell(null), 100)
        break

      // ── Bulk lock messages (#7) ─────────────────────────────────────
      case 'bulkLocked':
        {
          // Peer acquired a bulk lockset (e.g. find-and-replace). Show
          // lock badges on each cell in their colour.
          const bulkName = resolveDisplayName({
            id: message.user.id,
            email: '',
            display_name: message.user.display_name,
            color: message.user.color,
          })
          setCellLocks((prev) => {
            const next = new Map(prev)
            for (const cell of (message.cells || [])) {
              next.set(cell, {
                userId: message.user.id,
                displayName: bulkName,
                color: message.user.color,
              })
            }
            cellLocksRef.current = next
            return next
          })
          if (Array.isArray(message.cells)) {
            addActivity(
              `${bulkName} locked ${message.cells.length} cells for find/replace`,
            )
          }
        }
        break

      case 'bulkUnlocked':
        setCellLocks((prev) => {
          const next = new Map(prev)
          for (const cell of (message.cells || [])) {
            next.delete(cell)
          }
          cellLocksRef.current = next
          return next
        })
        break

      case 'bulkLockResult':
        // Forwarded to the find/replace caller via a Promise registered
        // when acquireBulkLocks was invoked.
        // (See _resolveBulkLock below.)
        const resolver = bulkLockResolversRef.current.get(message.operationId)
        if (resolver) {
          resolver(message)
          bulkLockResolversRef.current.delete(message.operationId)
        }
        break
    }
  }, [addActivity, getUserName])

  // sendRef: a stable ref so handleConnect (defined after useWebSocket) can
  // call send() without being in the dependency array of useWebSocket.
  const sendRef = useRef<(msg: Record<string, unknown>) => void>(() => {})

  const { connected, send } = useWebSocket({
    fileId: uploadId,
    accessToken,
    enabled,
    onMessage: handleMessage,
    // Case 5 + Case 4: on reconnect, clear stale lock/presence state and
    // request a fresh snapshot from the server.
    onConnect: useCallback((isReconnect: boolean) => {
      if (!isReconnect) return
      // Clear cell locks — repopulated by lockSnapshot response.
      setCellLocks(() => {
        const empty = new Map<string, CellLockInfo>()
        cellLocksRef.current = empty
        return empty
      })
      // Clear our own pending/granted lock tracking — tied to old connection_id.
      pendingLockCellsRef.current.clear()
      myGrantedCellsRef.current.clear()
      // Request lock snapshot from server (Case 5).
      // send() is safe here: onConnect fires inside ws.onopen when socket is OPEN.
      sendRef.current({ action: 'requestSnapshot' })
      addActivity('Reconnected — state refreshed')
    }, [addActivity]),
  })

  // Keep sendRef current so the onConnect callback can always call the latest send.
  sendRef.current = send

  const focusCell = useCallback((column: string, rowId: string) => {
    const cell = `${column}:${rowId}`
    // Lock-hole #1: mark pending before the server acks so the editable
    // predicate knows we've started the acquisition race.
    pendingLockCellsRef.current.add(cell)
    send({ action: 'cellFocus', cell })
  }, [send])

  const blurCell = useCallback((column: string, rowId: string) => {
    const cell = `${column}:${rowId}`
    // Release our tracking regardless of grant state.
    pendingLockCellsRef.current.delete(cell)
    myGrantedCellsRef.current.delete(cell)
    send({ action: 'cellBlur', cell })
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

  // ── Bulk lock acquire/release (#7) ───────────────────────────────────
  // Used by find-and-replace before applying changes to N cells. The
  // server tries to lock all of them under our connection_id; if any
  // is already held by another peer it rolls back and returns the
  // conflict so the caller can abort with a clear message.
  const acquireBulkLocks = useCallback(
    async (
      cells: string[],
      timeoutMs: number = 5000,
    ): Promise<BulkLockResultMessage> => {
      if (!connected || cells.length === 0) {
        return { operationId: 'noop', acquired: cells.length === 0 }
      }
      const operationId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const result = new Promise<BulkLockResultMessage>((resolve) => {
        bulkLockResolversRef.current.set(operationId, resolve)
      })
      send({ action: 'bulkLockAcquire', cells, operationId })
      // Race against timeout — never let the F&R caller hang.
      const timeout = new Promise<BulkLockResultMessage>((resolve) => {
        setTimeout(() => {
          if (bulkLockResolversRef.current.has(operationId)) {
            bulkLockResolversRef.current.delete(operationId)
            resolve({
              operationId,
              acquired: false,
              reason: 'Timed out waiting for server response',
              conflicting: [],
            })
          }
        }, timeoutMs)
      })
      return Promise.race([result, timeout])
    },
    [connected, send],
  )

  const releaseBulkLocks = useCallback(
    (cells: string[], operationId?: string) => {
      if (!connected || cells.length === 0) return
      send({
        action: 'bulkLockRelease',
        cells,
        operationId: operationId || `release-${Date.now()}`,
      })
    },
    [connected, send],
  )

  // Case 4: filter stale presence pills before returning to consumers.
  // Users who have not been seen in PRESENCE_STALE_THRESHOLD_MS are hidden.
  // The server self-heals via presenceSync every ~30 s, so this is a belt-
  // and-suspenders guard for the window between heartbeats.
  //
  // Wrapped in useMemo so the returned array is a stable reference when
  // `users` hasn't changed — avoids prop-inequality churn on every render
  // (and prevents any consumer effect with `collab.users` in its deps from
  // re-running unnecessarily).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeUsers = useMemo(() => filterStaleUsers(users, Date.now()), [users])

  return {
    connected,
    users: activeUsers,
    cellLocks,
    cellLocksRef,
    // Lock-hole #1 fix: expose my cell ownership state for the AG-Grid
    // editable predicate and cell styling.
    myGrantedCellsRef,
    pendingLockCellsRef,
    lockDeniedCell,
    activity,
    panelOpen,
    setPanelOpen,
    focusCell,
    blurCell,
    broadcastCellUpdate,
    broadcastBulkUpdate,
    isCellLockedByOther,
    acquireBulkLocks,
    releaseBulkLocks,
  }
}
