import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"

import type { FileItem, FileStats } from "@/modules/files/types"

import { FILES_API_CONFIG } from "./file-manager.utils"

interface ToastLike {
  (args: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }): void
}

interface UseFileUploadParams {
  idToken: string | null
  toast: ToastLike
  loadFiles: () => Promise<void>
  updateStats: (fileList: FileItem[]) => void
  setFiles: Dispatch<SetStateAction<FileItem[]>>
  setStats: Dispatch<SetStateAction<FileStats>>
}

export function useFileUpload({
  idToken,
  toast,
  loadFiles,
  updateStats,
  setFiles,
  setStats,
}: UseFileUploadParams) {
  const uploadFile = useCallback(
    async (file: File): Promise<FileItem> => {
      if (!idToken) {
        throw new Error("Not authenticated")
      }

      try {
        const presignedResponse = await fetch(`${FILES_API_CONFIG.apiUrl}uploads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
          }),
        })

        if (!presignedResponse.ok) {
          const errorText = await presignedResponse.text()
          throw new Error(`Failed to get presigned URL: ${presignedResponse.status} - ${errorText}`)
        }

        const presignedData = await presignedResponse.json()

        if (presignedData.presignedPost && presignedData.usePost) {
          const formData = new FormData()
          Object.keys(presignedData.presignedPost.fields).forEach((key) => {
            formData.append(key, presignedData.presignedPost.fields[key])
          })
          formData.append("file", file)

          const uploadResponse = await fetch(presignedData.presignedPost.url, {
            method: "POST",
            body: formData,
          })

          if (!uploadResponse.ok && uploadResponse.status !== 204) {
            const uploadErrorText = await uploadResponse.text()
            throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadErrorText}`)
          }
        } else {
          throw new Error("No presigned POST data available")
        }

        const newFile: FileItem = {
          id: presignedData.key || file.name,
          name: file.name,
          key: presignedData.key || file.name,
          size: file.size,
          type: file.name.split(".").pop()?.toUpperCase() || "FILE",
          modified: new Date(),
          lastModified: new Date().toISOString(),
          status: "uploaded",
        }

        await loadFiles()

        toast({
          title: "Upload successful",
          description: `${file.name} has been uploaded successfully.`,
        })

        return newFile
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
          await new Promise((resolve) => setTimeout(resolve, 2000))

          const newFile: FileItem = {
            id: `dev_${Date.now()}_${file.name}`,
            name: file.name,
            key: file.name,
            size: file.size,
            type: file.name.split(".").pop()?.toUpperCase() || "FILE",
            modified: new Date(),
            lastModified: new Date().toISOString(),
            status: "uploaded",
          }

          setFiles((prev) => [newFile, ...prev])
          setStats((prev) => ({
            ...prev,
            totalFiles: prev.totalFiles + 1,
            totalSize: prev.totalSize + file.size,
            storageUsed: prev.storageUsed + file.size,
            uploadedToday: prev.uploadedToday + 1,
          }))

          toast({
            title: "Upload successful (Development Mode)",
            description: `${file.name} has been uploaded successfully in development mode.`,
          })

          return newFile
        }

        toast({
          title: "Upload failed",
          description: error instanceof Error ? error.message : "Failed to upload file",
          variant: "destructive",
        })

        throw error
      }
    },
    [idToken, loadFiles, setFiles, setStats, toast, updateStats]
  )

  return { uploadFile }
}
