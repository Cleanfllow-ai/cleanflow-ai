import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

import type { FileItem } from "@/modules/files/types"

import { FILES_API_CONFIG, mapStatus } from "./file-manager.utils"

interface ToastLike {
  (args: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }): void
}

interface UseFilePollingParams {
  idToken: string | null
  toast: ToastLike
  setFiles: Dispatch<SetStateAction<FileItem[]>>
}

// P0-4: terminal statuses that stop polling and clear the seq counter
const TERMINAL_STATUSES = new Set([
  "DQ_FIXED",
  "DQ_FAILED",
  "FAILED",
  "REJECTED",
  "OPTIMIZE_FAILED",
  "IMPORT_FAILED",
  "SHARD_FAILED",
  "UPLOAD_FAILED",
])

export function useFilePolling({ idToken, toast, setFiles }: UseFilePollingParams) {
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set())
  const processingFilesRef = useRef(processingFiles)
  const timeoutIdsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // P0-4: monotonic sequence counter per upload so out-of-order poll responses
  // cannot regress a terminal status back to an in-progress one.
  const pollSeqRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    processingFilesRef.current = processingFiles
  }, [processingFiles])

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id))
      timeoutIdsRef.current.clear()
    }
  }, [])

  const checkProcessingStatus = useCallback(
    async (uploadId: string) => {
      if (!idToken) {
        throw new Error("Not authenticated")
      }

      // P0-4: stamp the sequence BEFORE the fetch so we can detect races
      const mySeq = (pollSeqRef.current.get(uploadId) ?? 0) + 1
      pollSeqRef.current.set(uploadId, mySeq)

      const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/status`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`)
      }

      const status = await response.json()

      setFiles((prev) =>
        prev.map((file) => {
          if (file.upload_id !== uploadId) return file
          // P0-4: only apply update if our seq is still the latest; drop stale responses
          const latest = pollSeqRef.current.get(uploadId) ?? mySeq
          if (mySeq < latest) return file
          return {
            ...file,
            status: mapStatus(status.status),
            dq_score: status.dq_score,
            rows_in: status.rows_in,
            rows_out: status.rows_out,
            rows_quarantined: status.rows_quarantined,
            dq_issues: status.dq_issues,
            last_error: status.last_error,
          }
        })
      )

      return status
    },
    [idToken, setFiles]
  )

  const monitorProcessing = useCallback(
    (uploadId: string) => {
      setProcessingFiles((prev) => new Set(prev).add(uploadId))

      const checkStatus = async () => {
        if (!processingFilesRef.current.has(uploadId)) {
          timeoutIdsRef.current.delete(uploadId)
          return
        }

        try {
          const status = await checkProcessingStatus(uploadId)

          if (TERMINAL_STATUSES.has(status.status)) {
            timeoutIdsRef.current.delete(uploadId)
            // P0-4: clear the seq tracker for this file once terminal
            pollSeqRef.current.delete(uploadId)
            setProcessingFiles((prev) => {
              const next = new Set(prev)
              next.delete(uploadId)
              return next
            })

            toast({
              title: "Processing Completed",
              description: `DQ processing completed for ${uploadId}: ${status.status}`,
              variant: status.status === "DQ_FIXED" ? "default" : "destructive",
            })
            return
          }

          const tid = setTimeout(checkStatus, 15000)
          timeoutIdsRef.current.set(uploadId, tid)
        } catch (error) {
          console.error(`Error monitoring ${uploadId}:`, error)
          timeoutIdsRef.current.delete(uploadId)
          setProcessingFiles((prev) => {
            const next = new Set(prev)
            next.delete(uploadId)
            return next
          })
        }
      }

      const tid = setTimeout(checkStatus, 15000)
      timeoutIdsRef.current.set(uploadId, tid)
    },
    [checkProcessingStatus, toast]
  )

  const startDQProcessing = useCallback(
    async (uploadId: string) => {
      if (!idToken) {
        throw new Error("Not authenticated")
      }

      try {
        const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/process`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to start DQ processing: ${response.status}`)
        }

        const result = await response.json()

        setFiles((prev) =>
          prev.map((file) => (file.upload_id === uploadId ? { ...file, status: "dq_running" } : file))
        )

        toast({
          title: "DQ Processing Started",
          description: `Data quality processing started for ${uploadId}`,
        })

        monitorProcessing(uploadId)

        return result
      } catch (error) {
        console.error("DQ processing start error:", error)
        toast({
          title: "DQ Processing Failed",
          description: "Could not start data quality processing. Please try again.",
          variant: "destructive",
        })
        throw error
      }
    },
    [idToken, monitorProcessing, setFiles, toast]
  )

  return {
    processingFiles,
    startDQProcessing,
    checkProcessingStatus,
    monitorProcessing,
  }
}
