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

  onMessageRef.current = onMessage

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
    if (!accessToken || !fileId || !enabled || !AWS_CONFIG.WS_URL) return

    cleanup()

    const url = `${AWS_CONFIG.WS_URL}?fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(accessToken)}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
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
        onMessageRef.current(message)
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }

      if (enabled && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
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
  }, [fileId, accessToken, enabled, cleanup])

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    connect()
    return cleanup
  }, [connect, cleanup])

  return { connected, send }
}
