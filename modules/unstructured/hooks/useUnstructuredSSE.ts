/**
 * useUnstructuredSSE — EventSource wrapper for the unstructured-import live log.
 *
 * Behaviour:
 *   - Opens an EventSource against `GET /unstructured/jobs/{jobId}/log`
 *     (auth token passed via query param — EventSource cannot set headers).
 *   - Buffers parsed events in component state.
 *   - On disconnect/error: reconnects every 3 s, up to 10 retries, then
 *     surfaces `state: "lost"` so the UI can prompt the user to refresh.
 *   - Cleanly closes the connection on unmount or when `jobId` changes.
 *
 * Event shape on the wire (one of):
 *   - Default `message` event → JSON-encoded UnstructuredLogEvent
 *   - Named events: `state`, `file`, `error`, `done` — same payload shape,
 *     `kind` is overridden by the event name when missing.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { unstructuredApi } from "../api/unstructured-api"
import type { UnstructuredLogEvent } from "../types/unstructured.types"

const MAX_RETRIES = 10
const RETRY_DELAY_MS = 3000

export type SSEConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "lost"
  | "closed"

export interface UseUnstructuredSSEResult {
  events: UnstructuredLogEvent[]
  state: SSEConnectionState
  /** number of automatic reconnects attempted so far */
  retryCount: number
  /** force-close (used by parent when job hits a terminal state) */
  close: () => void
  /** clear the buffered events (used by "Clear log" UX) */
  clear: () => void
}

function parseEvent(
  raw: string,
  fallbackKind: UnstructuredLogEvent["kind"] = "info",
): UnstructuredLogEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<UnstructuredLogEvent>
    if (!parsed || typeof parsed !== "object") return null
    return {
      ts: parsed.ts || new Date().toISOString(),
      kind: parsed.kind || fallbackKind,
      message: parsed.message || "",
      file_id: parsed.file_id,
      file_name: parsed.file_name,
      file_status: parsed.file_status,
      stage: parsed.stage,
      meta: parsed.meta,
    }
  } catch {
    // Non-JSON line — treat the raw text as the message.
    return {
      ts: new Date().toISOString(),
      kind: fallbackKind,
      message: raw,
    }
  }
}

export function useUnstructuredSSE(
  jobId: string | null | undefined,
  options: { enabled?: boolean } = {},
): UseUnstructuredSSEResult {
  const enabled = options.enabled !== false && Boolean(jobId)
  const [events, setEvents] = useState<UnstructuredLogEvent[]>([])
  const [state, setState] = useState<SSEConnectionState>(
    enabled ? "connecting" : "closed",
  )
  const [retryCount, setRetryCount] = useState(0)

  const esRef = useRef<EventSource | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)

  const cleanup = useCallback(() => {
    if (esRef.current) {
      try {
        esRef.current.close()
      } catch {
        /* noop */
      }
      esRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    stoppedRef.current = true
    cleanup()
    setState("closed")
  }, [cleanup])

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  useEffect(() => {
    if (!enabled || !jobId) {
      cleanup()
      setState("closed")
      return
    }

    stoppedRef.current = false
    let currentRetry = 0

    const connect = () => {
      if (stoppedRef.current) return
      cleanup()
      setState(currentRetry === 0 ? "connecting" : "reconnecting")

      const url = unstructuredApi.buildLogStreamUrl(jobId)
      let es: EventSource
      try {
        es = new EventSource(url, { withCredentials: false })
      } catch (err) {
        console.error("[useUnstructuredSSE] EventSource construct failed", err)
        scheduleRetry()
        return
      }
      esRef.current = es

      es.onopen = () => {
        currentRetry = 0
        setRetryCount(0)
        setState("open")
      }

      const pushEvent = (
        raw: string,
        fallbackKind: UnstructuredLogEvent["kind"],
      ) => {
        const ev = parseEvent(raw, fallbackKind)
        if (ev) {
          setEvents((prev) => {
            // Cap buffer at 5000 events to avoid pathological memory growth on
            // very long jobs; older lines roll off the top.
            const next = [...prev, ev]
            return next.length > 5000 ? next.slice(next.length - 5000) : next
          })
          if (ev.kind === "done") {
            // Terminal — close gracefully.
            stoppedRef.current = true
            cleanup()
            setState("closed")
          }
        }
      }

      es.onmessage = (e) => pushEvent(e.data, "info")
      es.addEventListener("state", (e) =>
        pushEvent((e as MessageEvent).data, "state_transition"),
      )
      es.addEventListener("file", (e) =>
        pushEvent((e as MessageEvent).data, "file_event"),
      )
      es.addEventListener("warning", (e) =>
        pushEvent((e as MessageEvent).data, "warning"),
      )
      es.addEventListener("error", (e) =>
        pushEvent((e as MessageEvent).data, "error"),
      )
      es.addEventListener("done", (e) =>
        pushEvent((e as MessageEvent).data, "done"),
      )

      es.onerror = () => {
        if (stoppedRef.current) return
        // EventSource auto-reconnects internally, but the BE may have closed
        // the stream intentionally (auth, completion). Treat any error after
        // a successful open as a reconnection attempt.
        cleanup()
        scheduleRetry()
      }
    }

    const scheduleRetry = () => {
      if (stoppedRef.current) return
      if (currentRetry >= MAX_RETRIES) {
        setState("lost")
        return
      }
      currentRetry += 1
      setRetryCount(currentRetry)
      retryTimerRef.current = setTimeout(connect, RETRY_DELAY_MS)
    }

    connect()

    return () => {
      stoppedRef.current = true
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, enabled])

  return { events, state, retryCount, close, clear }
}
