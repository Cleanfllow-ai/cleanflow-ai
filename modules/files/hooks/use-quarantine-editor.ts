/**
 * use-quarantine-editor.ts
 *
 * Main orchestrator hook for quarantine editor
 * Composes all sub-hooks and provides unified interface
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import {
  saveQuarantineEditsBatch,
  submitQuarantineReprocess,
  reprocessQuarantinedLegacy,
  submitCompatibilityReprocessViaUpload,
} from '@/modules/files/api'
import { useQuarantineConfig } from './use-quarantine-config'
import { useQuarantineSession } from './use-quarantine-session'
import { useQuarantineRows } from './use-quarantine-rows'
import { useQuarantineEdits } from './use-quarantine-edits'
import { useQuarantineAutosave } from './use-quarantine-autosave'
import type { SaveSummary, FileStatusResponse } from '@/modules/files/types'

interface UseQuarantineEditorParams {
  file: Pick<FileStatusResponse, 'upload_id' | 'filename' | 'original_filename'> | null
  authToken: string | null
  open: boolean
}

/**
 * Main quarantine editor hook
 * Orchestrates all sub-hooks and provides unified state management
 *
 * @param params - File, auth token, and open state
 * @returns Complete quarantine editor state and operations
 */
export function useQuarantineEditor({ file, authToken, open }: UseQuarantineEditorParams) {
  const { toast } = useToast()
  const config = useQuarantineConfig()

  // Sub-hooks
  const session = useQuarantineSession()
  const rows = useQuarantineRows(config)
  const edits = useQuarantineEdits()

  // Local state
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastSaveSummary, setLastSaveSummary] = useState<SaveSummary | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [showLineage, setShowLineage] = useState(false)

  // Derived state
  const columns = useMemo(() => {
    if (!session.manifest) return []
    const declared = [...(session.manifest.columns || [])]
    if (!declared.length) {
      return ['row_id', ...(session.manifest.editable_columns || []).filter((c) => c !== 'row_id')]
    }
    const withoutRowId = declared.filter((c) => c !== 'row_id')
    return ['row_id', ...withoutRowId]
  }, [session.manifest])

  const lineage = useMemo(() => {
    return [...session.versions].sort((a, b) => (a.version_number || 0) - (b.version_number || 0))
  }, [session.versions])

  const latestVersion = useMemo(() => {
    if (!lineage.length) return null
    return lineage.find((v) => v.is_latest) || lineage[lineage.length - 1]
  }, [lineage])

  // Full reset when file changes — clears savedEditsMap so green indicators
  // from a previous file don't bleed into a different file's editor.
  const prevUploadIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (file?.upload_id && file.upload_id !== prevUploadIdRef.current) {
      edits.reset()
      prevUploadIdRef.current = file.upload_id
    }
  }, [file?.upload_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize on open
  useEffect(() => {
    if (!open || !file || !authToken) return

    const init = async () => {
      // Reset session/rows fully; only clear pending edits so the savedEditsMap
      // (green "saved" indicators) survives a close-and-reopen of the same file.
      session.reset()
      rows.reset()
      edits.clearPending()
      setLastSaveSummary(null)
      setShowLineage(false)

      try {
        // Initialize session
        const sessionResult = await session.initialize(file.upload_id, authToken)

        // Initialize rows
        if ('compatibilityMode' in sessionResult && sessionResult.compatibilityMode && 'rows' in sessionResult) {
          // Compatibility mode: rows already loaded
          rows.setRows(sessionResult.rows as any)
        } else if ('session' in sessionResult && sessionResult.session) {
          // Modern mode: fetch first page
          await rows.initialize(
            file.upload_id,
            authToken,
            sessionResult.session.session_id,
            sessionResult.manifest.upload_id
          )
        }
      } catch (error) {
        // Error already toasted in sub-hooks
        console.error('Failed to initialize quarantine editor:', error)
      }
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.upload_id, authToken])

  // Autosave edits
  const saveEdits = useCallback(async () => {
    if (!file || !authToken || !session.session || edits.pendingCount === 0) return

    // Compatibility mode: edits are saved locally
    if (session.compatibilityMode) {
      setLastSaveSummary({ accepted: edits.pendingCount, rejected: 0 })
      // Don't clear edits in compatibility mode - they're needed for reprocess
      toast({
        title: 'Edits staged locally',
        description: 'Legacy mode stores edits locally and applies them on reprocess submit.',
      })
      return
    }

    setSaving(true)
    try {
      const editEntries = edits.getEditsBatch()
      let nextEtag = session.etag
      let acceptedTotal = 0
      let rejectedTotal = 0

      // Send edits in batches
      for (let i = 0; i < editEntries.length; i += config.maxEditsPerBatch) {
        const chunk = editEntries.slice(i, i + config.maxEditsPerBatch)

        const response = await saveQuarantineEditsBatch(file.upload_id, authToken, {
          session_id: session.session.session_id,
          if_match_etag: nextEtag,
          edits: chunk,
        })

        nextEtag = response.next_etag
        acceptedTotal += response.accepted || 0
        rejectedTotal += (response.rejected || []).length
      }

      // Update etag
      session.updateEtag(nextEtag)

      // Mark pending edits as saved (clears pending map, populates savedEditsMap)
      edits.markAsSaved()

      // Update summary + timestamp
      setLastSaveSummary({ accepted: acceptedTotal, rejected: rejectedTotal })
      setLastSavedAt(new Date())
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error?.message || 'Unable to save edits',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [file, authToken, session, edits, config.maxEditsPerBatch, toast])

  // Autosave hook
  useQuarantineAutosave(
    saveEdits,
    edits.pendingCount,
    config.autosaveDebounceMs,
    open && !saving && !submitting
  )

  // Submit reprocess
  const submitReprocess = useCallback(
    async (patchNotes?: string) => {
      if (!file || !authToken) return

      setSubmitting(true)
      try {
        // Save any pending edits first
        if (edits.pendingCount > 0) {
          await saveEdits()
        }

        // Compatibility mode
        if (session.compatibilityMode) {
          try {
            // Try legacy endpoint first
            const editedRows = edits.getEditedRows(rows.rows).map((row) => {
              const copy = { ...row }
              delete copy.row_id
              return copy
            })

            const result = await reprocessQuarantinedLegacy(file.upload_id, authToken, {
              edited_rows: editedRows,
              patch_notes: patchNotes || 'Quarantine remediation from editor (legacy mode)',
            })

            toast({
              title: 'Reprocess submitted',
              description: result.execution_arn || result.new_upload_id || result.status,
            })

            return result
          } catch (legacyError: any) {
            // Try compatibility upload as last resort
            const compatResult = await submitCompatibilityReprocessViaUpload(authToken, {
              rows: rows.rows,
              originalFilename: file.original_filename || file.filename,
            })

            toast({
              title: 'Reprocess submitted (compatibility)',
              description: compatResult.execution_arn || compatResult.new_upload_id || compatResult.status,
            })

            return compatResult
          }
        }

        // Modern mode
        if (!session.session || !session.manifest) {
          throw new Error('Session not initialized')
        }

        const result = await submitQuarantineReprocess(file.upload_id, authToken, {
          session_id: session.session.session_id,
          if_match_base_upload_id: session.manifest.upload_id,
          patch_notes: patchNotes || 'Quarantine remediation from editor',
          submit_token: `${session.session.session_id}:${session.manifest.upload_id}`,
        })

        toast({
          title: 'Reprocess submitted',
          description: result.execution_arn || result.new_upload_id || result.status,
        })

        return result
      } catch (error: any) {
        toast({
          title: 'Reprocess failed',
          description: error?.message || 'Unable to submit reprocess',
          variant: 'destructive',
        })
        throw error
      } finally {
        setSubmitting(false)
      }
    },
    [file, authToken, session, edits, rows, saveEdits, toast]
  )

  // Refresh session + rows after a server-side operation (e.g. AI Fix Apply to All)
  const refreshSession = useCallback(async () => {
    if (!file || !authToken) return
    rows.reset()
    edits.clearPending()
    try {
      const sessionResult = await session.initialize(file.upload_id, authToken)
      if ('compatibilityMode' in sessionResult && sessionResult.compatibilityMode && 'rows' in sessionResult) {
        rows.setRows(sessionResult.rows as any)
      } else if ('session' in sessionResult && sessionResult.session) {
        await rows.initialize(
          file.upload_id,
          authToken,
          sessionResult.session.session_id,
          (sessionResult as any).manifest?.upload_id || file.upload_id
        )
      }
    } catch (error) {
      console.error('Failed to refresh quarantine session:', error)
    }
  }, [file, authToken, session, rows, edits]) // eslint-disable-line react-hooks/exhaustive-deps

  // AG Grid scroll-end callback — fires when user scrolls near the bottom
  const handleBodyScrollEnd = useCallback(() => {
    if (!open || rows.loading || !rows.hasMore || session.compatibilityMode) return
    if (!file || !authToken || !session.session || !session.manifest) return

    void rows.fetchNext(
      file.upload_id,
      authToken,
      session.session.session_id,
      session.manifest.upload_id
    )
  }, [open, rows, session, file, authToken])

  // Cell edit handler
  const handleCellEdit = useCallback(
    (rowId: string, column: string, value: string) => {
      edits.editCell(rowId, column, value)
      // Track the dq_status flip so the patch persists the 'edited' state to S3.
      // On reload, query_quarantine_rows merges this into the row via patch_map,
      // so {col}_dq_status comes back as 'edited' instead of 'quarantined',
      // enabling the persistent ag-cell-saved (green) indicator without in-memory state.
      edits.editCell(rowId, `${column}_dq_status`, 'edited')
      rows.updateRow(rowId, { [column]: value, [`${column}_dq_status`]: 'edited' })
    },
    [edits, rows]
  )

  return {
    // Session state
    manifest: session.manifest,
    sessionInfo: session.session,
    versions: session.versions,
    compatibilityMode: session.compatibilityMode,
    loading: session.loading,

    // Data state
    rows: rows.rows,
    columns,
    hasMore: rows.hasMore,
    rowsLoading: rows.loading,

    // Edit state
    editsMap: edits.editsMap,
    activeCell: edits.activeCell,
    pendingCount: edits.pendingCount,
    getCellValue: edits.getCellValue,
    isCellEdited: edits.isCellEdited,
    isCellSaved: edits.isCellSaved,
    isRowEdited: edits.isRowEdited,

    // Actions
    handleCellEdit,
    setActiveCell: edits.setActiveCell,
    saveEdits,
    submitReprocess,
    refreshSession,

    // UI state
    saving,
    submitting,
    lastSaveSummary,
    lastSavedAt,
    showLineage,
    setShowLineage,
    lineage,
    latestVersion,

    // AG Grid infinite scroll callback
    handleBodyScrollEnd,
  }
}
