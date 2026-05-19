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

  // Helper: trigger a browser file download from a presigned URL or blob.
  // When the BE returns JSON {presigned_url, filename} for large files, this
  // handles both paths uniformly.
  const _triggerDownload = async (
    response: Response,
    fallbackFilename: string
  ): Promise<string> => {
    const contentType = response.headers.get("Content-Type") || ""
    if (contentType.includes("application/json")) {
      // BE returned a presigned-URL redirect (large-file streaming path)
      const json = await response.json()
      const presignedUrl: string = json.presigned_url || json.url || ""
      const filename: string = json.filename || fallbackFilename
      if (presignedUrl) {
        const a = document.createElement("a")
        a.href = presignedUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      return filename
    }
    // Normal binary blob path
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = fallbackFilename
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
    return filename
  }

  const downloadCleanData = useCallback(
    async (uploadId: string) => {
      if (!idToken) throw new Error("Not authenticated")

      try {
        const response = await fetch(`${FILES_API_CONFIG.apiUrl}files/${uploadId}/download?type=clean`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        })

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}))
          const detail = (errJson as { error?: string; message?: string }).error
            || (errJson as { error?: string; message?: string }).message
            || response.statusText
          throw new Error(`Failed to download clean data: ${response.status} — ${detail}`)
        }

        const filename = await _triggerDownload(response, "clean_data.csv")

        toast({
          title: "Download Started",
          description: `Downloading clean data: ${filename}`,
        })
      } catch (error) {
        console.error("Download clean data error:", error)
        const msg = error instanceof Error ? error.message : "Could not download clean data."
        toast({
          title: "Download Failed",
          description: msg,
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
            })
            return
          }
          const errJson = await response.json().catch(() => ({}))
          const detail = (errJson as { error?: string; message?: string }).error
            || (errJson as { error?: string; message?: string }).message
            || response.statusText
          throw new Error(`Failed to download quarantine data: ${response.status} — ${detail}`)
        }

        const filename = await _triggerDownload(response, "quarantine_data.csv")

        toast({
          title: "Download Started",
          description: `Downloading quarantine data: ${filename}`,
        })
      } catch (error) {
        console.error("Download quarantine data error:", error)
        const msg = error instanceof Error ? error.message : "Could not download quarantine data."
        toast({
          title: "Download Failed",
          description: msg,
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
        console.error("Download DQ report error:", error)
        toast({
          title: "Download Failed",
          description: "Could not download the DQ report. Please try again.",
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
            })
            return
          }
          const errJson = await response.json().catch(() => ({}))
          const detail = (errJson as { error?: string; message?: string }).error
            || (errJson as { error?: string; message?: string }).message
            || response.statusText
          throw new Error(`Failed to download ${dataType} data as ${format}: ${response.status} — ${detail}`)
        }

        const filename = await _triggerDownload(response, `${dataType}_data.${format}`)

        toast({
          title: "Download Started",
          description: `Downloading ${dataType} data as ${format.toUpperCase()}: ${filename}`,
        })
      } catch (error) {
        console.error("Download multi-format error:", error)
        const msg = error instanceof Error ? error.message : `Could not download ${dataType} data as ${format.toUpperCase()}.`
        toast({
          title: "Download Failed",
          description: msg,
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

