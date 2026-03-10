import { useCallback } from "react"

import { FILES_API_CONFIG } from "./file-manager.utils"

interface ToastLike {
  (args: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }): void
}

interface UseFileDownloadParams {
  idToken: string | null
  toast: ToastLike
}

export function useFileDownload({ idToken, toast }: UseFileDownloadParams) {
  const viewResults = useCallback(
    async (uploadId: string) => {
      if (!idToken) throw new Error("Not authenticated")

      const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/preview`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to get preview: ${response.status}`)
      }

      return response.json()
    },
    [idToken]
  )

  const downloadCleanData = useCallback(
    async (uploadId: string) => {
      if (!idToken) throw new Error("Not authenticated")

      try {
        const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/download?type=clean`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        })

        if (!response.ok) {
          throw new Error(`Failed to download clean data: ${response.status}`)
        }

        const contentDisposition = response.headers.get("Content-Disposition")
        let filename = "clean_data.parquet"
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/)
          if (filenameMatch) filename = filenameMatch[1]
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Download Started",
          description: `Downloading clean data: ${filename}`,
        })
      } catch (error) {
        toast({
          title: "Download Failed",
          description: error instanceof Error ? error.message : "Failed to download clean data",
          variant: "destructive",
        })
        throw error
      }
    },
    [idToken, toast]
  )

  const downloadQuarantineData = useCallback(
    async (uploadId: string) => {
      if (!idToken) throw new Error("Not authenticated")

      try {
        const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/download?type=quarantine`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        })

        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: "No Quarantine Data",
              description: "No quarantined data available for this file",
              variant: "destructive",
            })
            return
          }
          throw new Error(`Failed to download quarantine data: ${response.status}`)
        }

        const contentDisposition = response.headers.get("Content-Disposition")
        let filename = "quarantine_data.parquet"
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/)
          if (filenameMatch) filename = filenameMatch[1]
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Download Started",
          description: `Downloading quarantine data: ${filename}`,
        })
      } catch (error) {
        toast({
          title: "Download Failed",
          description: error instanceof Error ? error.message : "Failed to download quarantine data",
          variant: "destructive",
        })
        throw error
      }
    },
    [idToken, toast]
  )

  const downloadDQReport = useCallback(
    async (uploadId: string) => {
      if (!idToken) throw new Error("Not authenticated")

      try {
        const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/download?type=report`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        })

        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: "No Report Available",
              description: "No DQ report available for this file",
              variant: "destructive",
            })
            return
          }
          throw new Error(`Failed to download DQ report: ${response.status}`)
        }

        const contentDisposition = response.headers.get("Content-Disposition")
        let filename = "dq_report.json"
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/)
          if (filenameMatch) filename = filenameMatch[1]
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Download Started",
          description: `Downloading DQ report: ${filename}`,
        })
      } catch (error) {
        toast({
          title: "Download Failed",
          description: error instanceof Error ? error.message : "Failed to download DQ report",
          variant: "destructive",
        })
        throw error
      }
    },
    [idToken, toast]
  )

  const downloadFileMultiFormat = useCallback(
    async (uploadId: string, format: "csv" | "excel" | "json", dataType: "clean" | "quarantine") => {
      if (!idToken) throw new Error("Not authenticated")

      try {
        const response = await fetch(
          `${FILES_API_CONFIG.apiUrl}files/${uploadId}/export?type=${format}&data=${dataType}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${idToken}` },
          }
        )

        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: "No Data Available",
              description: `No ${dataType} data available for this file`,
              variant: "destructive",
            })
            return
          }
          throw new Error(`Failed to download ${dataType} data as ${format}: ${response.status}`)
        }

        const contentDisposition = response.headers.get("Content-Disposition")
        let filename = `${dataType}_data.${format}`
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/)
          if (filenameMatch) filename = filenameMatch[1]
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Download Started",
          description: `Downloading ${dataType} data as ${format.toUpperCase()}: ${filename}`,
        })
      } catch (error) {
        toast({
          title: "Download Failed",
          description: error instanceof Error ? error.message : `Failed to download ${dataType} data as ${format}`,
          variant: "destructive",
        })
        throw error
      }
    },
    [idToken, toast]
  )

  return {
    viewResults,
    downloadCleanData,
    downloadQuarantineData,
    downloadDQReport,
    downloadFileMultiFormat,
  }
}

