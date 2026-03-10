"use client"

import React, { createContext, useContext, ReactNode, useState } from 'react'
import { useFileManager } from '@/modules/files/hooks/use-file-manager'

interface FileManagerContextType {
  files: ReturnType<typeof useFileManager>['files']
  stats: ReturnType<typeof useFileManager>['stats']
  isLoading: ReturnType<typeof useFileManager>['isLoading']
  selectedFile: ReturnType<typeof useFileManager>['selectedFile']
  autoRefreshEnabled: ReturnType<typeof useFileManager>['autoRefreshEnabled']
  processingFiles: ReturnType<typeof useFileManager>['processingFiles']
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedFileId: string | null
  setSelectedFileId: (id: string | null) => void
  uploadFile: ReturnType<typeof useFileManager>['uploadFile']
  deleteFile: ReturnType<typeof useFileManager>['deleteFile']
  downloadFile: ReturnType<typeof useFileManager>['downloadFile']
  previewFile: ReturnType<typeof useFileManager>['previewFile']
  formatFileSize: ReturnType<typeof useFileManager>['formatFileSize']
  formatDate: ReturnType<typeof useFileManager>['formatDate']
  refreshFiles: ReturnType<typeof useFileManager>['refreshFiles']
  startDQProcessing: ReturnType<typeof useFileManager>['startDQProcessing']
  checkProcessingStatus: ReturnType<typeof useFileManager>['checkProcessingStatus']
  viewResults: ReturnType<typeof useFileManager>['viewResults']
  downloadCleanData: ReturnType<typeof useFileManager>['downloadCleanData']
  downloadQuarantineData: ReturnType<typeof useFileManager>['downloadQuarantineData']
  downloadDQReport: ReturnType<typeof useFileManager>['downloadDQReport']
  downloadFileMultiFormat: ReturnType<typeof useFileManager>['downloadFileMultiFormat']
  startAutoRefresh: ReturnType<typeof useFileManager>['startAutoRefresh']
  stopAutoRefresh: ReturnType<typeof useFileManager>['stopAutoRefresh']
  monitorProcessing: ReturnType<typeof useFileManager>['monitorProcessing']
}

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined)

export function FileManagerProvider({ children }: { children: ReactNode }) {
  const fileManager = useFileManager()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  return (
    <FileManagerContext.Provider value={{
      ...fileManager,
      searchQuery,
      setSearchQuery,
      selectedFileId,
      setSelectedFileId
    }}>
      {children}
    </FileManagerContext.Provider>
  )
}

export function useFileManagerContext() {
  const context = useContext(FileManagerContext)
  if (context === undefined) {
    throw new Error('useFileManagerContext must be used within a FileManagerProvider')
  }
  return context
}

