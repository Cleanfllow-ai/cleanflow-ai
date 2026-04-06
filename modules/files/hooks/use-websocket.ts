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

interface UseWebSocketParams {
  fileId: string
  accessToken: string | null
  enabled: boolean
  onMessage: (message: WsServerMessage) => void
}

export function useWebSocket({
  fileId,
  accessToken,
  enabled,
  onMessage,
}: UseWebSocketParams) {
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const onMessageRef = useRef(onMessage)
  const [connected, setConnected] = useState(false)

  // Keep callback ref up-to-date without triggering reconnections
  onMessageRef.current = onMessage

  // Store latest values in refs so the effect doesn't re-run on every change
  const fileIdRef = useRef(fileId)
  const accessTokenRef = useRef(accessToken)
  const enabledRef = useRef(enabled)
  fileIdRef.current = fileId
  accessTokenRef.current = accessToken
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

    const url = `${AWS_CONFIG.WS_URL}?fileId=${encodeURIComponent(fId)}&token=${encodeURIComponent(token)}`
    console.log('[WS] Opening connection to:', fId)
    const ws = new WebSocket(url)

    ws.onopen = () => {
      console.log('[WS] Connected successfully')
      setConnected(true)
      reconnectAttemptsRef.current = 0

      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'heartbeat' }))
        }
      }, HEARTBEAT_INTERVAL_MS)
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

  // Connect once on mount, reconnect when fileId or enabled changes
  useEffect(() => {
    console.log('[WS] Effect triggered:', { enabled, hasToken: !!accessToken, fileId, wsState: wsRef.current?.readyState })
    if (!enabled || !accessToken) {
      cleanup()
      return
    }
    connect()
    return cleanup
  }, [fileId, enabled, !!accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return { connected, send }
}
