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
  | { type: 'cellLockDenied'; cell: string; reason: string }
  | { type: 'rowLocked'; cell: string; reason: string }
  | { type: 'duplicate'; client_op_id: string; action: string }
  | { type: 'error'; code: string; action?: string }

// ── Client → Server messages ────────────────────────────────────────────────

export type WsClientMessage =
  | { action: 'cellFocus'; cell: string }
  | { action: 'cellBlur'; cell: string }
  | { action: 'cellUpdate'; cell: string; value: string }
  | { action: 'bulkUpdate'; count: number; summary: string }
  | { action: 'heartbeat' }

// ── UI State ────────────────────────────────────────────────────────────────

export interface CollaborationUser {
  id: string
  email: string
  displayName: string
  color: string
  activeCell: string
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
