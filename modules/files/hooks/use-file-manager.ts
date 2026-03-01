import { useState, useEffect, useCallback } from "react"

import { useToast } from "@/shared/hooks/use-toast"
import { useAuth } from "@/modules/auth"
import type { FileItem, FileStats } from "@/modules/files/types"

import { FILES_API_CONFIG, mapStatus } from "./file-manager.utils"
import { useFileDownload } from "./use-file-download"
import { useFilePolling } from "./use-file-polling"
import { useFileUpload } from "./use-file-upload"

export type { FileItem, FileStats } from "@/modules/files/types"

export function useFileManager() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 0,
    totalSize: 0,
    storageUsed: 0,
    storageLimit: 10 * 1024 * 1024 * 1024,
    uploadedToday: 0,
    downloadedToday: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const { toast } = useToast()
  const { idToken } = useAuth()

  const updateStats = useCallback((fileList: FileItem[]) => {
    const totalSize = fileList.reduce((sum, file) => sum + file.size, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const uploadedToday = fileList.filter((file) => {
      const fileDate = new Date(file.modified)
      fileDate.setHours(0, 0, 0, 0)
      return fileDate.getTime() === today.getTime()
    }).length

    setStats((prev) => ({
      ...prev,
      totalFiles: fileList.length,
      totalSize,
      storageUsed: totalSize,
      uploadedToday,
    }))
  }, [])

  const loadFiles = useCallback(async () => {
    if (!idToken) {
      setFiles([])
      updateStats([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${FILES_API_CONFIG.apiUrl}files`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`)
      }

      const data = await response.json()
      const apiFiles: FileItem[] = (data.files || []).map((item: any) => ({
        id: item.upload_id || item.key || item.name || `file_${Date.now()}`,
        name:
          item.original_filename ||
          (item.key ? item.key.split("/").pop() : null) ||
          item.name ||
          "Unknown File",
        key: item.key || item.name || "",
        size: item.size || 0,
        type: (item.key ? item.key.split(".").pop()?.toUpperCase() : null) || item.type || "FILE",
        modified: new Date(item.uploaded_at || item.lastModified || Date.now()),
        lastModified: item.uploaded_at || item.lastModified || new Date().toISOString(),
        status: mapStatus(item.status || "uploaded"),
        upload_id: item.upload_id,
        original_filename: item.original_filename,
        uploaded_at: item.uploaded_at,
        root_upload_id: item.root_upload_id || item.upload_id,
        dq_score: item.dq_score,
        rows_in: item.rows_in,
        rows_out: item.rows_out,
        rows_quarantined: item.rows_quarantined,
        dq_issues: item.dq_issues,
        last_error: item.last_error,
      }))

      // Deduplicate by version chain (root_upload_id): same root = same file lineage, keep latest version.
      // Different roots with the same filename = separate files, both shown.
      const byRoot = new Map<string, FileItem>()
      for (const file of apiFiles) {
        const key = file.root_upload_id || file.upload_id
        const existing = byRoot.get(key)
        if (!existing || new Date(file.uploaded_at || 0) > new Date(existing.uploaded_at || 0)) {
          byRoot.set(key, file)
        }
      }
      const dedupedFiles = Array.from(byRoot.values())

      setFiles(dedupedFiles)
      updateStats(dedupedFiles)

      toast({
        title: "Files loaded",
        description: `Found ${apiFiles.length} file(s)`,
      })
    } catch (error) {
      toast({
        title: "Error loading files",
        description: "Failed to load your files. Please try again.",
        variant: "destructive",
      })
      setFiles([])
      updateStats([])
    } finally {
      setIsLoading(false)
    }
  }, [idToken, toast, updateStats])

  const { uploadFile } = useFileUpload({
    idToken,
    toast,
    loadFiles,
    updateStats,
    setFiles,
    setStats,
  })

  const { processingFiles, startDQProcessing, checkProcessingStatus, monitorProcessing } = useFilePolling({
    idToken,
    toast,
    setFiles,
  })
  const { viewResults, downloadCleanData, downloadQuarantineData, downloadDQReport, downloadFileMultiFormat } =
    useFileDownload({
      idToken,
      toast,
    })

  const deleteFile = useCallback(
    async (fileId: string) => {
      setFiles((prev) => {
        const updated = prev.filter((file) => file.id !== fileId)
        updateStats(updated)
        return updated
      })

      if (selectedFile?.id === fileId) {
        setSelectedFile(null)
      }

      await loadFiles()

      toast({
        title: "File deleted",
        description: "The file has been successfully deleted.",
      })
    },
    [selectedFile, updateStats, loadFiles, toast]
  )

  const downloadFile = useCallback(
    async (_file: FileItem) => {
      toast({
        title: "Download not yet implemented",
        description: "Download functionality will be available soon.",
        variant: "destructive",
      })

      setStats((prev) => ({
        ...prev,
        downloadedToday: prev.downloadedToday + 1,
      }))
    },
    [toast]
  )

  const previewFile = useCallback((file: FileItem) => {
    setSelectedFile(file)
  }, [])

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }, [])

  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  const startAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(true)
    toast({
      title: "Auto-refresh Started",
      description: "Files will refresh automatically every 10 seconds",
    })
  }, [toast])

  const stopAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(false)
    toast({
      title: "Auto-refresh Stopped",
      description: "Automatic file refresh has been disabled",
    })
  }, [toast])

  useEffect(() => {
    if (idToken) {
      loadFiles()
    } else {
      setFiles([])
      updateStats([])
      setIsLoading(false)
    }
  }, [loadFiles, idToken, updateStats])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (autoRefreshEnabled && idToken) {
      interval = setInterval(() => {
        loadFiles()
      }, 10000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefreshEnabled, idToken, loadFiles])

  return {
    files,
    stats,
    isLoading,
    selectedFile,
    autoRefreshEnabled,
    processingFiles,
    uploadFile,
    deleteFile,
    downloadFile,
    previewFile,
    formatFileSize,
    formatDate,
    refreshFiles: loadFiles,
    startDQProcessing,
    checkProcessingStatus,
    viewResults,
    downloadCleanData,
    downloadQuarantineData,
    downloadDQReport,
    downloadFileMultiFormat,
    startAutoRefresh,
    stopAutoRefresh,
    monitorProcessing,
  }
}
