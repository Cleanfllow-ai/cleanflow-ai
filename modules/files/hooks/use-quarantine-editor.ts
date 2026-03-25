/**
 * use-quarantine-editor.ts
 *
 * Main orchestrator hook for quarantine editor
 * Composes all sub-hooks and provides unified interface
 */

import { useState, useCallback, useEffect, useMemo, useRef, startTransition } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import {
  saveQuarantineEditsBatch,
  submitQuarantineReprocess,
  reprocessQuarantinedLegacy,
  submitCompatibilityReprocessViaUpload,
  queryQuarantinedRows,
} from '@/modules/files/api'
import { useQuarantineConfig } from './use-quarantine-config'
import { useQuarantineSession } from './use-quarantine-session'
import { useQuarantineRows } from './use-quarantine-rows'
import { useQuarantineEdits } from './use-quarantine-edits'
import { useQuarantineAutosave } from './use-quarantine-autosave'
import type { SaveSummary, FileStatusResponse, QuarantineRow } from '@/modules/files/types'

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
  const [dataVersion, setDataVersion] = useState(0)

  // Derived state
  const columns = useMemo(() => {
    if (!session.manifest) return []
    const META_EXACT = new Set(['dq_status', 'dq_violations', 'fixes_applied', 'dq_cell_status', '_user_id', '_upload_id', '_normalized_at'])
    const isMetaCol = (c: string) =>
      META_EXACT.has(c) ||
      c.startsWith('_') ||
      c.endsWith('_dq_status') || c.endsWith('_dq_fixed') || c.endsWith('_dq_quarantined')
    const declared = (session.manifest.columns || []).filter((c) => !isMetaCol(c))
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
  const activeUploadId = session.manifest?.upload_id || file?.upload_id || ''

  // Full reset when file changes — clears savedEditsMap so green indicators
  // from a previous file don't bleed into a different file's editor.
  const prevUploadIdRef = useRef<string | null>(null)
  const staleEtagRetryCountRef = useRef(0)
  useEffect(() => {
    if (file?.upload_id && file.upload_id !== prevUploadIdRef.current) {
      edits.reset()
      staleEtagRetryCountRef.current = 0
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
      setDataVersion(0)

      try {
        // Initialize session
        const sessionResult = await session.initialize(file.upload_id, authToken)

        // Initialize rows
        if ('compatibilityMode' in sessionResult && sessionResult.compatibilityMode && 'rows' in sessionResult) {
          // Compatibility mode: rows already loaded
          rows.setRows(sessionResult.rows as any)
        } else if ('session' in sessionResult && sessionResult.session) {
          // Modern mode: let AG Grid request the first block on demand.
          startTransition(() => {
            setDataVersion((prev) => prev + 1)
          })
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
  const saveEdits = useCallback(async (): Promise<boolean> => {
    if (edits.pendingCount === 0) return true
    if (!file || !authToken || !session.session || !activeUploadId) return false

    // Compatibility mode: edits are saved locally
    if (session.compatibilityMode) {
      setLastSaveSummary({ accepted: edits.pendingCount, rejected: 0 })
      // Don't clear edits in compatibility mode - they're needed for reprocess
      toast({
        title: 'Edits staged locally',
        description: 'Legacy mode stores edits locally and applies them on reprocess submit.',
      })
      return true
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

        const response = await saveQuarantineEditsBatch(activeUploadId, authToken, {
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
      staleEtagRetryCountRef.current = 0
      return true
    } catch (error: any) {
      const isStaleEtag =
        error?.status === 409 && error?.message?.toLowerCase().includes('stale etag')

      if (isStaleEtag) {
        staleEtagRetryCountRef.current += 1

        if (staleEtagRetryCountRef.current > 3) {
          staleEtagRetryCountRef.current = 0
          toast({
            title: 'Save failed',
            description: 'Could not resolve edit conflict after multiple retries.',
            variant: 'destructive',
          })
          return false
        }

        if (staleEtagRetryCountRef.current === 1) {
          toast({
            title: 'Edit conflict',
            description: 'Session etag was stale. Refreshing — your edits will retry automatically.',
          })
        }

        try {
          await session.refreshEtag(activeUploadId, authToken!, session.session?.base_upload_id || activeUploadId)
        } catch {
          // If refresh fails the next autosave will also fail; the retry
          // counter will eventually surface a terminal error.
        }
        // Pending edits stay in state so autosave retries with fresh etag.
        return false
      }

      staleEtagRetryCountRef.current = 0
      toast({
        title: 'Save failed',
        description: error?.message || 'Unable to save edits',
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [activeUploadId, file, authToken, session, edits, config.maxEditsPerBatch, toast])

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
      if (!file || !authToken || !activeUploadId) return

      setSubmitting(true)
      try {
        // Save any pending edits first
        if (edits.pendingCount > 0) {
          const saved = await saveEdits()
          if (!saved || edits.pendingCount > 0) {
            toast({
              title: 'Reprocess blocked',
              description: 'Your latest edits were not persisted. Resolve the save error, then retry reprocess.',
              variant: 'destructive',
            })
            return null
          }
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

            const result = await reprocessQuarantinedLegacy(activeUploadId, authToken, {
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

        const result = await submitQuarantineReprocess(activeUploadId, authToken, {
          session_id: session.session.session_id,
          if_match_base_upload_id: session.manifest.upload_id,
          patch_notes: patchNotes || 'Quarantine remediation from editor',
          submit_token: `${session.session.session_id}:${session.manifest.upload_id}`,
          mode: 'auto',
        })

        toast({
          title: 'Reprocess submitted',
          description: result.execution_arn || result.new_upload_id || result.status,
        })

        // Clear saved-edit indicators — patches are consumed by the new version.
        // Stale green cells on re-open would show server values (possibly empty)
        // as green, confusing the user.
        edits.reset()

        return result
      } catch (error: any) {
        toast({
          title: 'Reprocess failed',
          description: error?.message || 'Unable to submit reprocess',
          variant: 'destructive',
        })
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [activeUploadId, file, authToken, session, edits, rows, saveEdits, toast]
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
        startTransition(() => {
          setDataVersion((prev) => prev + 1)
        })
      }
    } catch (error) {
      console.error('Failed to refresh quarantine session:', error)
    }
  }, [file, authToken, session, rows, edits]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ref keeps latest rows for compatibility-mode slice without being a dep of
  // fetchRows — avoids rebuilding fetchRows on every cell edit or row merge.
  const rowsRowsRef = useRef(rows.rows)
  rowsRowsRef.current = rows.rows

  // AG Grid Infinite Row Model datasource — called by AG Grid when it needs a block
  const fetchRows = useCallback(
    async (startRow: number, endRow: number): Promise<{ rows: QuarantineRow[]; lastRow: number }> => {
      if (!file || !authToken || !session.manifest || !activeUploadId) {
        throw new Error('Quarantine session not ready')
      }

      // Compatibility mode: return pre-loaded rows slice
      if (session.compatibilityMode) {
        const slice = rowsRowsRef.current.slice(startRow, endRow)
        return { rows: slice, lastRow: rowsRowsRef.current.length }
      }

      try {
        const response = await queryQuarantinedRows(activeUploadId, authToken, {
          version: session.manifest.upload_id,
          session_id: session.session?.session_id,
          cursor: String(startRow),
          limit: endRow - startRow,
        })
        rows.mergeRows(response.rows || [])

        const totalRows = response.total_rows ?? session.manifest.row_count_quarantined ?? 0
        const lastRow = response.next_cursor ? -1 : startRow + (response.rows?.length ?? 0)

        return {
          rows: response.rows || [],
          lastRow: lastRow === -1 ? -1 : Math.min(lastRow, totalRows),
        }
      } catch (error: any) {
        console.error('[QuarantineEditor] fetchRows failed:', error)
        throw error
      }
    },
    [activeUploadId, file, authToken, session.manifest, session.session, session.compatibilityMode, rows.mergeRows]
  )

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
    totalRows: session.manifest?.row_count_quarantined ?? 0,

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
    dataVersion,

    // AG Grid Infinite Row Model datasource
    fetchRows,
  }
}
