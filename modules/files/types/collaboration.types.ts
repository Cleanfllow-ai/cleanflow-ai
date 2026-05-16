/**
 * collaboration.types.ts
 *
 * Types for real-time collaborative editing via WebSocket.
 */

// ── Server → Client messages ────────────────────────────────────────────────

export interface WsUserInfo {
  id: string
  email: string
  display_name: string
  color: string
  active_cell?: string
  /** Epoch-ms of last received message from this user. Used by FE to hide
   *  stale presence pills older than PRESENCE_STALE_THRESHOLD_MS (Case 4). */
  last_seen?: number
}

/** Single lock entry returned by the lockSnapshot message (Case 5). */
export interface WsLockEntry {
  cell: string
  connection_id: string
  user_id: string
  display_name: string
  color: string
  ttl: number
}

export type WsServerMessage =
  | { type: 'presence'; users: WsUserInfo[] }
  // presenceSync: authoritative peer snapshot pushed by the server on every
  // heartbeat (every 30s). Used to self-heal missed userJoined / userLeft
  // deltas — without it, the Collaborators panel can drift permanently
  // (one user sees the other but the reverse side shows "No other users").
  | { type: 'presenceSync'; users: WsUserInfo[] }
  | { type: 'userJoined'; user: WsUserInfo }
  | { type: 'userLeft'; userId: string }
  | { type: 'cellLocked'; cell: string; user: Pick<WsUserInfo, 'id' | 'display_name' | 'color'> }
  | { type: 'cellUnlocked'; cell: string }
  | { type: 'cellChanged'; cell: string; value: string; userId: string }
  | { type: 'bulkChanged'; count: number; summary: string; userId: string }
  | { type: 'bulkLocked'; cells: string[]; user: Pick<WsUserInfo, 'id' | 'display_name' | 'color'>; operationId?: string }
  | { type: 'bulkUnlocked'; cells: string[]; operationId?: string; userId?: string }
  | { type: 'bulkLockResult'; operationId: string; acquired: boolean; cells?: string[]; conflicting?: string[]; reason?: string }
  // Lock-hole #1 fix: explicit server grant flips FE state from held-by-me-pending
  // → held-by-me. The absence of cellLockDenied was the implicit ack before.
  | { type: 'cellLockGranted'; cell: string; ttl: number }
  | { type: 'cellLockDenied'; cell: string; reason: string }
  | { type: 'rowLocked'; cell: string; reason: string }
  | { type: 'duplicate'; client_op_id: string; action: string }
  | { type: 'error'; code: string; action?: string; cell?: string; cells?: string[]; reason?: string }
  // F&R operation queue messages (collab editor architecture doc §4.3)
  | { type: 'operationQueued'; operationId: string; aheadCount: number; etaMs: number }
  | { type: 'operationGranted'; operationId: string }
  | { type: 'operationFailed'; operationId: string; reason: string; retryAfterMs?: number; conflicting?: string[] }
  | { type: 'queueAdvanced'; operationId: string }
  | { type: 'queueDrained'; drained: number; by: string }
  // Case 5 — sent by server in response to requestSnapshot action on reconnect.
  // Contains the full current lock state for the room so the FE can reconcile
  // without replaying all messages since session start.
  | { type: 'lockSnapshot'; locks: WsLockEntry[] }

// ── Client → Server messages ────────────────────────────────────────────────

export type WsClientMessage =
  | { action: 'cellFocus'; cell: string }
  | { action: 'cellBlur'; cell: string }
  | { action: 'cellUpdate'; cell: string; value: string }
  // Lock-hole #4 fix: bulkUpdate now carries bulkCells for server ownership check.
  | { action: 'bulkUpdate'; count: number; summary: string; bulkCells?: string[] }
  | { action: 'heartbeat' }
  // F&R operation queue (collab editor architecture doc §4.3)
  | { action: 'operationClaim'; operationId: string; kind?: string; cells?: string[] }
  | { action: 'operationRelease'; operationId: string }
  | { action: 'adminDrainQueue' }
  // Case 5 — sent after reconnect to receive a lockSnapshot from the server.
  | { action: 'requestSnapshot' }

// ── UI State ────────────────────────────────────────────────────────────────

export interface CollaborationUser {
  id: string
  email: string
  displayName: string
  color: string
  activeCell: string
  /** Epoch-ms of the last received message (Case 4 — stale presence filter). */
  lastSeen?: number
}

export interface CellLockInfo {
  userId: string
  displayName: string
  color: string
}

export interface ActivityEntry {
  text: string
  timestamp: Date
}
