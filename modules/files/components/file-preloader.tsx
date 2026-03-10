"use client"

import { useEffect } from "react"
import { useAuth } from "@/modules/auth"
import { useAppDispatch, useAppSelector } from "@/shared/store/store"
import { fetchFiles, enrichFiles, selectFiles, selectFilesStatus } from "@/modules/files/store/filesSlice"

export function FilePreloader() {
  const { isAuthenticated, idToken, permissionsLoaded, hasPermission } = useAuth()
  const dispatch = useAppDispatch()
  const files = useAppSelector(selectFiles)
  const status = useAppSelector(selectFilesStatus)

  // 1. Initial Fetch on Login
  useEffect(() => {
    if (!isAuthenticated || !idToken || status !== "idle") return
    // Avoid preloading before org context is ready (prevents membership-required noise).
    if (!permissionsLoaded || !hasPermission("files")) return
    dispatch(fetchFiles(idToken))
  }, [isAuthenticated, idToken, status, dispatch, permissionsLoaded, hasPermission])

  // 2. Background Enrichment for Processing Times
  useEffect(() => {
    if (status === "succeeded" && files.length > 0 && idToken) {
      const filesNeedingTime = files.filter(
        (f) =>
          (f.status === "COMPLETED" || f.status === "DQ_FIXED") &&
          !f.processing_time &&
          !f.processing_time_seconds
      )

      if (filesNeedingTime.length > 0) {
        // Dispatch enrichment without blocking UI
        dispatch(enrichFiles({ files: filesNeedingTime, authToken: idToken }))
      }
    }
  }, [status, files, idToken, dispatch])

  return null // Headless component
}
