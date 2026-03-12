'use client'

import React, { createContext, useContext, useCallback, useRef, useState } from 'react'
import { multipartUpload, type MultipartProgress } from '@/modules/files/api/multipart-upload'

export interface ActiveUpload {
  uploadId: string | null
  fileName: string
  fileSize: number
  progress: MultipartProgress | null
  status: 'uploading' | 'completed' | 'failed'
  error?: string
}

interface UploadManagerContextType {
  activeUploads: ActiveUpload[]
  startUpload: (file: File, token: string) => Promise<string>
  getUploadForFile: (uploadIdOrName: string) => ActiveUpload | undefined
  hasActiveUploads: boolean
}

const UploadManagerContext = createContext<UploadManagerContextType>({
  activeUploads: [],
  startUpload: async () => '',
  getUploadForFile: () => undefined,
  hasActiveUploads: false,
})

export const useUploadManager = () => useContext(UploadManagerContext)

export function UploadManagerProvider({
  children,
  onUploadComplete,
}: {
  children: React.ReactNode
  onUploadComplete?: (uploadId: string, fileName: string) => void
}) {
  const uploadsRef = useRef<Map<string, ActiveUpload>>(new Map())
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([])
  const onCompleteRef = useRef(onUploadComplete)
  onCompleteRef.current = onUploadComplete

  const sync = useCallback(() => {
    setActiveUploads(Array.from(uploadsRef.current.values()))
  }, [])

  const startUpload = useCallback(async (file: File, token: string): Promise<string> => {
    const internalId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    uploadsRef.current.set(internalId, {
      uploadId: null,
      fileName: file.name,
      fileSize: file.size,
      progress: null,
      status: 'uploading',
    })
    sync()

    try {
      let resolvedUploadId: string | null = null
      const uploadId = await multipartUpload(file, token, (progress) => {
        const entry = uploadsRef.current.get(internalId)
        if (entry) {
          if (resolvedUploadId) entry.uploadId = resolvedUploadId
          entry.progress = progress
          sync()
        }
      })
      resolvedUploadId = uploadId

      // Mark completed
      const entry = uploadsRef.current.get(internalId)
      if (entry) {
        entry.uploadId = uploadId
        entry.status = 'completed'
        entry.progress = {
          loaded: file.size,
          total: file.size,
          percent: 100,
          partsComplete: 1,
          partsTotal: 1,
        }
      }
      sync()

      onCompleteRef.current?.(uploadId, file.name)

      // Auto-remove completed after 5s
      setTimeout(() => {
        uploadsRef.current.delete(internalId)
        sync()
      }, 5000)

      return uploadId
    } catch (err: any) {
      const entry = uploadsRef.current.get(internalId)
      if (entry) {
        entry.status = 'failed'
        entry.error = err?.message || 'Upload failed'
      }
      sync()

      // Auto-remove failed after 10s
      setTimeout(() => {
        uploadsRef.current.delete(internalId)
        sync()
      }, 10000)

      throw err
    }
  }, [sync])

  const getUploadForFile = useCallback((uploadIdOrName: string) => {
    for (const upload of uploadsRef.current.values()) {
      if (
        (upload.uploadId && upload.uploadId === uploadIdOrName) ||
        upload.fileName === uploadIdOrName
      ) {
        return upload
      }
    }
    return undefined
  }, [])

  const hasActiveUploads = activeUploads.some(u => u.status === 'uploading')

  return (
    <UploadManagerContext.Provider value={{
      activeUploads,
      startUpload,
      getUploadForFile,
      hasActiveUploads,
    }}>
      {children}
    </UploadManagerContext.Provider>
  )
}
