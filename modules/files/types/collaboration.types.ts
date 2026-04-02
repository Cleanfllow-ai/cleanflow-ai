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
  | { type: 'userJoined'; user: WsUserInfo }
  | { type: 'userLeft'; userId: string }
  | { type: 'cellLocked'; cell: string; user: Pick<WsUserInfo, 'id' | 'display_name' | 'color'> }
  | { type: 'cellUnlocked'; cell: string }
  | { type: 'cellChanged'; cell: string; value: string; userId: string }
  | { type: 'bulkChanged'; count: number; summary: string; userId: string }
  | { type: 'cellLockDenied'; cell: string; reason: string }

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
