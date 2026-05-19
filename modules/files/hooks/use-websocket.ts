/**
 * use-websocket.ts
 *
 * Low-level WebSocket connection hook — lifecycle, heartbeat, reconnection.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AWS_CONFIG } from '@/shared/config/aws-config'
import type { WsServerMessage } from '@/modules/files/types'

const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 10

/**
 * Extracts custom:org_id claim from a Cognito access token (or id_token).
 *
 * SOC2-P0 (server: WS_REQUIRE_ORG_ID=true, see remediation/cdk/stack.py:881):
 * the WS `$connect` handler rejects with HTTP 400 when `orgId` query param is
 * missing. Without this helper the URL is `?fileId=X&token=Y` and every connect
 * fails with code 400 (root cause of QE-01/Q6/Q9 in _qe_concurrent_report.json:
 * 0/10 WSConnections registered).
 *
 * Returns "" if the token has no org_id claim — caller must still send the
 * empty value so the URL shape stays consistent (server returns 400 anyway).
 */
function extractOrgIdFromToken(token: string | null): string {
  if (!token) return ''
  const parts = token.split('.')
  if (parts.length < 2) return ''
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 ? padded + '='.repeat(4 - (padded.length % 4)) : padded
    const payload = JSON.parse(atob(pad))
    return typeof payload['custom:org_id'] === 'string' ? payload['custom:org_id'] : ''
  } catch {
    return ''
  }
}

interface UseWebSocketParams {
  fileId: string
  accessToken: string | null
  /**
   * idToken is used to extract the `custom:org_id` claim that Cognito ONLY
   * populates on id_tokens (access tokens carry client_id, not org_id).
   * The WS server's `$connect` handler reads `orgId` from the query string —
   * see contexts/remediation/ws_go/cmd/handler/main.go handleConnect.
   *
   * Optional for unit-test convenience; in production callers MUST pass it or
   * the server returns HTTP 400 (WS_REQUIRE_ORG_ID=true).
   */
  idToken?: string | null
  enabled: boolean
  onMessage: (message: WsServerMessage) => void
  /**
   * Called each time a WebSocket connection is successfully established.
   * The `isReconnect` flag is true for every connection after the first.
   * Used by `use-collaboration` to send `requestSnapshot` on reconnect so
   * the FE reconciles lock state without replaying all prior messages (Case 5).
   */
  onConnect?: (isReconnect: boolean) => void
}

export function useWebSocket({
  fileId,
  accessToken,
  idToken = null,
  enabled,
  onMessage,
  onConnect,
}: UseWebSocketParams) {
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const [connected, setConnected] = useState(false)

  // Keep callback refs up-to-date without triggering reconnections
  onMessageRef.current = onMessage
  onConnectRef.current = onConnect

  // Store latest values in refs so the effect doesn't re-run on every change
  const fileIdRef = useRef(fileId)
  const accessTokenRef = useRef(accessToken)
  const idTokenRef = useRef(idToken)
  const enabledRef = useRef(enabled)
  fileIdRef.current = fileId
  accessTokenRef.current = accessToken
  idTokenRef.current = idToken
  enabledRef.current = enabled

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.onclose = null // Prevent reconnect on intentional close
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
  }, [])

  const connect = useCallback(() => {
    const token = accessTokenRef.current
    const fId = fileIdRef.current
    const isEnabled = enabledRef.current

    if (!token || !fId || !isEnabled || !AWS_CONFIG.WS_URL) return

    // Don't close and reopen if already connected to the same file
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    cleanup()

    // SOC2-P0: WS handler rejects $connect with HTTP 400 when orgId is missing
    // (WS_REQUIRE_ORG_ID=true, see remediation/cdk/stack.py:881). Extract from
    // the id_token's custom:org_id claim — access tokens don't carry it.
    const orgId = extractOrgIdFromToken(idTokenRef.current)
    const url = `${AWS_CONFIG.WS_URL}?fileId=${encodeURIComponent(fId)}&token=${encodeURIComponent(token)}&orgId=${encodeURIComponent(orgId)}`
    console.log('[WS] Opening connection to:', fId, { hasOrgId: !!orgId })
    const ws = new WebSocket(url)

    ws.onopen = () => {
      const isReconnect = reconnectAttemptsRef.current > 0
      console.log('[WS] Connected successfully', { isReconnect })
      setConnected(true)
      reconnectAttemptsRef.current = 0

      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'heartbeat' }))
        }
      }, HEARTBEAT_INTERVAL_MS)

      // Notify collaboration layer so it can re-subscribe and request lock
      // snapshot (Case 5). Called AFTER heartbeat is set up so any sends inside
      // onConnect fire on an open, non-null socket.
      onConnectRef.current?.(isReconnect)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WsServerMessage
        console.log('[WS] Message received:', message.type, message)
        onMessageRef.current(message)
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = (event) => {
      console.log('[WS] Connection closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean })
      setConnected(false)
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }

      if (enabledRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30_000)
        reconnectRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, delay)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror — reconnection handled there
    }

    wsRef.current = ws
  }, [cleanup])

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Sending:', message)
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('[WS] Cannot send, ws not open. readyState:', wsRef.current?.readyState)
    }
  }, [])

  // Connect once on mount, reconnect when fileId, enabled, or accessToken changes.
  // P1-7: use the FULL accessToken string (not !!accessToken boolean) as the dep
  // so token rotation on silent refresh triggers a reconnect with the new token.
  // SOC2-P0: also depend on idToken so a refresh with a different custom:org_id
  // forces reconnect with the correct orgId in the URL. idToken absence does NOT
  // gate the connect attempt — the server returns 400 if orgId is empty and the
  // FE reconnect loop surfaces that to the user (no silent stall).
  useEffect(() => {
    console.log('[WS] Effect triggered:', { enabled, hasToken: !!accessToken, hasIdToken: !!idToken, fileId, wsState: wsRef.current?.readyState })
    if (!enabled || !accessToken) {
      cleanup()
      return
    }
    connect()
    return cleanup
  }, [fileId, enabled, accessToken, idToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return { connected, send }
}
