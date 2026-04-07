'use client'

import React, { createContext, useContext, useCallback, useRef, useState } from 'react'
import { multipartUpload, type MultipartProgress, type GetToken } from '@/modules/files/api/multipart-upload'

export interface ActiveUpload {
  uploadId: string | null
  fileName: string
  fileSize: number
  progress: MultipartProgress | null
  status: 'uploading' | 'completed' | 'failed' | 'cancelled'
  error?: string
}

interface UploadManagerContextType {
  activeUploads: ActiveUpload[]
  startUpload: (file: File, token: string, getToken?: GetToken) => Promise<string>
  cancelUpload: (uploadIdOrName: string) => void
  getUploadForFile: (uploadIdOrName: string) => ActiveUpload | undefined
  hasActiveUploads: boolean
}

const UploadManagerContext = createContext<UploadManagerContextType>({
  activeUploads: [],
  startUpload: async () => '',
  cancelUpload: () => {},
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
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([])
  const onCompleteRef = useRef(onUploadComplete)
  onCompleteRef.current = onUploadComplete

  const sync = useCallback(() => {
    setActiveUploads(Array.from(uploadsRef.current.values()))
  }, [])

  const startUpload = useCallback(async (file: File, token: string, getToken?: GetToken): Promise<string> => {
    const internalId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const abortController = new AbortController()

    abortControllersRef.current.set(internalId, abortController)
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
      }, getToken, abortController.signal)
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
      abortControllersRef.current.delete(internalId)

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
        const isCancelled = abortController.signal.aborted
        entry.status = isCancelled ? 'cancelled' : 'failed'
        entry.error = isCancelled ? 'Upload cancelled' : (err?.message || 'Upload failed')
      }
      sync()
      abortControllersRef.current.delete(internalId)

      // Auto-remove failed/cancelled after 5s
      setTimeout(() => {
        uploadsRef.current.delete(internalId)
        sync()
      }, 5000)

      throw err
    }
  }, [sync])

  const cancelUpload = useCallback((uploadIdOrName: string) => {
    for (const [internalId, upload] of uploadsRef.current.entries()) {
      if (
        upload.status === 'uploading' &&
        ((upload.uploadId && upload.uploadId === uploadIdOrName) ||
         upload.fileName === uploadIdOrName)
      ) {
        const controller = abortControllersRef.current.get(internalId)
        if (controller) {
          controller.abort()
        }
        return
      }
    }
  }, [])

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
      cancelUpload,
      getUploadForFile,
      hasActiveUploads,
    }}>
      {children}
    </UploadManagerContext.Provider>
  )
}
