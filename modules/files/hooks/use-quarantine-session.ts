/**
 * use-quarantine-session.ts
 *
 * Hook for managing quarantine editor session lifecycle
 * Handles manifest fetching, session initialization, and compatibility mode
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import {
  getQuarantineManifest,
  startQuarantineSession,
  backfillQuarantineReadModel,
  getFileVersions,
  downloadQuarantineFile,
  isAuthorizerMismatchError,
  shouldUseLegacyFallback,
} from '@/modules/files/api'
import { parseLegacyCsv } from '@/modules/files/utils'
import type {
  QuarantineManifest,
  QuarantineSession,
  FileVersionSummary,
} from '@/modules/files/types'

interface SessionState {
  manifest: QuarantineManifest | null
  session: QuarantineSession | null
  versions: FileVersionSummary[]
  etag: string
  loading: boolean
  compatibilityMode: boolean
}

/**
 * Hook for quarantine session management
 * Initializes manifest, session, and handles fallback to compatibility mode
 *
 * @returns Session state and initialization function
 */
export function useQuarantineSession() {
  const { toast } = useToast()
  const [state, setState] = useState<SessionState>({
    manifest: null,
    session: null,
    versions: [],
    etag: '',
    loading: false,
    compatibilityMode: false,
  })

  /**
   * Initialize session in legacy compatibility mode
   * Downloads CSV, parses locally, and sets up mock manifest
   */
  const initializeLegacy = useCallback(
    async (uploadId: string, authToken: string) => {
      // Fetch versions for metadata
      const versionsResp = await getFileVersions(uploadId, authToken).catch(() => ({
        versions: [],
        count: 0,
      }))

      // Download quarantined CSV
      const blob = await downloadQuarantineFile(uploadId, 'csv', 'quarantine', authToken)
      const csvText = await blob.text()
      const parsed = parseLegacyCsv(csvText)

      // Create mock manifest from parsed data
      const editableColumns = parsed.columns.filter((col) => col !== 'row_id')

      const mockManifest: QuarantineManifest = {
        upload_id: uploadId,
        root_upload_id: versionsResp.versions?.[0]?.root_upload_id || uploadId,
        row_count_quarantined: parsed.rows.length,
        columns: parsed.columns,
        editable_columns: editableColumns,
        shard_count: 1,
        etag: 'legacy',
      }

      const mockSession: QuarantineSession = {
        session_id: `legacy-${Date.now()}`,
        base_upload_id: uploadId,
        session_etag: 'legacy',
      }

      setState({
        manifest: mockManifest,
        session: mockSession,
        versions: versionsResp.versions || [],
        etag: 'legacy',
        loading: false,
        compatibilityMode: true,
      })

      return {
        manifest: mockManifest,
        session: mockSession,
        rows: parsed.rows,
        compatibilityMode: true,
      }
    },
    [toast]
  )

  /**
   * Initialize session in modern mode (with backend session support)
   */
  const initializeModern = useCallback(
    async (uploadId: string, authToken: string) => {
      // Step 1: Get manifest
      let manifestResp: QuarantineManifest
      try {
        manifestResp = await getQuarantineManifest(uploadId, authToken, 'latest')
      } catch (manifestError: any) {
        // If authorizer mismatch, immediately throw (can't recover)
        if (isAuthorizerMismatchError(manifestError)) {
          throw manifestError
        }

        // Check if error is due to missing read model
        const msg = String(manifestError?.message || '').toLowerCase()
        if (
          msg.includes('not enabled') ||
          msg.includes('permission') ||
          msg.includes('unauthorized') ||
          msg.includes('forbidden')
        ) {
          throw manifestError
        }

        // Try to backfill read model
        await backfillQuarantineReadModel(uploadId, authToken, 'latest')
        manifestResp = await getQuarantineManifest(uploadId, authToken, 'latest')
      }

      // Step 2: Get versions
      const versionsResp = await getFileVersions(uploadId, authToken)

      // Step 3: Start session
      const sessionResp = await startQuarantineSession(uploadId, authToken, manifestResp.upload_id)

      setState({
        manifest: manifestResp,
        session: sessionResp,
        versions: versionsResp.versions || [],
        etag: sessionResp.session_etag || manifestResp.etag || '',
        loading: false,
        compatibilityMode: false,
      })

      return {
        manifest: manifestResp,
        session: sessionResp,
        etag: sessionResp.session_etag || manifestResp.etag || '',
      }
    },
    [toast]
  )

  /**
   * Initialize quarantine session
   * Tries modern mode first, falls back to legacy on failure
   */
  const initialize = useCallback(
    async (uploadId: string, authToken: string) => {
      setState((prev) => ({ ...prev, loading: true }))

      try {
        // Try modern mode first
        const result = await initializeModern(uploadId, authToken)
        return result
      } catch (error: any) {
        // Check if should fallback to legacy mode
        if (shouldUseLegacyFallback(error)) {
          try {
            const legacyResult = await initializeLegacy(uploadId, authToken)
            toast({
              title: 'Running in compatibility mode',
              description: 'New quarantine APIs are unavailable. Using legacy remediation flow.',
            })
            return legacyResult
          } catch (legacyError: any) {
            setState((prev) => ({ ...prev, loading: false }))
            toast({
              title: 'Failed to initialize quarantine editor',
              description: legacyError?.message || 'Legacy compatibility initialization failed',
              variant: 'destructive',
            })
            throw legacyError
          }
        }

        // Other errors
        setState((prev) => ({ ...prev, loading: false }))
        toast({
          title: 'Failed to initialize quarantine editor',
          description: error?.message || 'Unknown error',
          variant: 'destructive',
        })
        throw error
      }
    },
    [initializeModern, initializeLegacy, toast]
  )

  /**
   * Reset session state
   */
  const reset = useCallback(() => {
    setState({
      manifest: null,
      session: null,
      versions: [],
      etag: '',
      loading: false,
      compatibilityMode: false,
    })
  }, [])

  /**
   * Update etag (after save operations)
   */
  const updateEtag = useCallback((newEtag: string) => {
    setState((prev) => ({ ...prev, etag: newEtag }))
  }, [])

  return {
    ...state,
    initialize,
    reset,
    updateEtag,
  }
}
