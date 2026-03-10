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

export function useFilePolling({ idToken, toast, setFiles }: UseFilePollingParams) {
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set())
  const processingFilesRef = useRef(processingFiles)

  useEffect(() => {
    processingFilesRef.current = processingFiles
  }, [processingFiles])

  const checkProcessingStatus = useCallback(
    async (uploadId: string) => {
      if (!idToken) {
        throw new Error("Not authenticated")
      }

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
        prev.map((file) =>
          file.upload_id === uploadId
            ? {
                ...file,
                status: mapStatus(status.status),
                dq_score: status.dq_score,
                rows_in: status.rows_in,
                rows_out: status.rows_out,
                rows_quarantined: status.rows_quarantined,
                dq_issues: status.dq_issues,
                last_error: status.last_error,
              }
            : file
        )
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
          return
        }

        try {
          const status = await checkProcessingStatus(uploadId)

          if (status.status === "DQ_FIXED" || status.status === "DQ_FAILED" || status.status === "FAILED") {
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

          setTimeout(checkStatus, 15000)
        } catch (error) {
          console.error(`Error monitoring ${uploadId}:`, error)
          setProcessingFiles((prev) => {
            const next = new Set(prev)
            next.delete(uploadId)
            return next
          })
        }
      }

      setTimeout(checkStatus, 15000)
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
        toast({
          title: "DQ Processing Failed",
          description: error instanceof Error ? error.message : "Failed to start DQ processing",
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
