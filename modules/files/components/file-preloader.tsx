"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/modules/auth"
import { useAppDispatch, useAppSelector } from "@/shared/store/store"
import { fetchFiles, enrichFiles, selectFiles, selectFilesStatus } from "@/modules/files/store/filesSlice"

// Routes that never render the sidebar / files UI — no need to preload files there.
const SKIP_PREFIXES = ["/auth"]
const shouldSkipPreload = (pathname: string | null) => {
  if (!pathname || pathname === "/") return true
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function FilePreloader() {
  const { isAuthenticated, idToken, permissionsLoaded, permissionsError, hasPermission } = useAuth()
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const files = useAppSelector(selectFiles)
  const status = useAppSelector(selectFilesStatus)

  // 1. Initial Fetch on Login
  useEffect(() => {
    if (shouldSkipPreload(pathname)) return
    if (!isAuthenticated || !idToken || status !== "idle") return
    // Avoid preloading before org context is ready (prevents membership-required noise).
    // P0-1 (2026-05-19): permissionsError → permissions={} but BE may still
    // authorise. Fall through to BE so user data still loads when /org/me flaked.
    if (!permissionsLoaded) return
    if (!permissionsError && !hasPermission("files")) return
    dispatch(fetchFiles(idToken))
  }, [pathname, isAuthenticated, idToken, status, dispatch, permissionsLoaded, permissionsError, hasPermission])

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
