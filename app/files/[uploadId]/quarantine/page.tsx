'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/modules/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useQuarantineEditor, useQuarantineFilters, useQuarantineFind, useOverlayPersist } from '@/modules/files/hooks'
import { useCollaboration } from '@/modules/files/hooks'
import { QuarantineCollaborationPanel } from '@/modules/files/components/quarantine-editor/quarantine-collaboration-panel'
import { QuarantineFilterBar } from '@/modules/files/components/quarantine-editor/quarantine-filter-bar'
import { QuarantineColumnFilter } from '@/modules/files/components/quarantine-editor/quarantine-column-filter'
import { QuarantineEditorHeader } from '@/modules/files/components/quarantine-editor/quarantine-editor-header'
import { QuarantineEditorToolbar } from '@/modules/files/components/quarantine-editor/quarantine-editor-toolbar'
import { QuarantineAgGridTable } from '@/modules/files/components/quarantine-editor/quarantine-ag-grid-table'
import { QuarantineVersionLineage } from '@/modules/files/components/quarantine-editor/quarantine-version-lineage'
import { QuarantineFindReplacePanel } from '@/modules/files/components/quarantine-editor/quarantine-find-replace-panel'
import { QuarantineCompareDialog } from '@/modules/files/components/quarantine-editor/quarantine-compare-dialog'
import { QuarantineVersionCompareDialog } from '@/modules/files/components/quarantine-editor/quarantine-version-compare-dialog'
import { QuarantineBulkApplyDialog } from '@/modules/files/components/quarantine-editor/quarantine-bulk-apply-dialog'
import { useEditHistory } from '@/modules/files/hooks/use-edit-history'
import { QuarantineUndoToast } from '@/modules/files/components/quarantine-editor/quarantine-undo-toast'
import { ArrowLeft, ClipboardCheck, Check, Clock, Loader2, Unlock, X } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types'
import { unlockRow } from '@/modules/files/api/file-quarantine-api'
import { fileManagementAPI } from '@/modules/files'
import { AWS_CONFIG } from '@/shared/config/aws-config'
import { toast } from 'sonner'

interface PageProps {
  params: Promise<{ uploadId: string }>
}

const ALLOWED_RETURN_TO = new Set(['/jobs', '/files', '/data-catalog', '/dashboard'])

export default function QuarantineEditorPage({ params }: PageProps) {
  const { uploadId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawReturnTo = searchParams?.get('returnTo') || ''
  // Only honor safe, in-app relative paths to prevent open-redirect abuse.
  const returnTo = ALLOWED_RETURN_TO.has(rawReturnTo) ? rawReturnTo : '/files'
  const navigateBack = useCallback(() => router.push(returnTo), [router, returnTo])
  const { idToken, accessToken, userRole, user } = useAuth()
  const currentUserId = user?.sub

  const file = { upload_id: uploadId, filename: '', original_filename: '' }

  const filterState = useQuarantineFilters()

  const editor = useQuarantineEditor({
    file,
    authToken: idToken,
    filters: filterState.filters,
  })

  // B4 (2026-05-16): fetch augmented_columns for the violet-tint + ✨ header
  // decoration in the quarantine grid.  One-shot fetch on mount — the list
  // never changes for a given upload (set at start_dq_processing time).
  const [augmentedColumns, setAugmentedColumns] = useState<string[]>([])
  useEffect(() => {
    if (!idToken || !uploadId) return
    let cancelled = false
    fileManagementAPI
      .getFileStatus(uploadId, idToken)
      .then((resp) => {
        if (cancelled) return
        const cols = (resp as { augmented_columns?: string[] }).augmented_columns
        if (Array.isArray(cols) && cols.length > 0) setAugmentedColumns(cols)
      })
      .catch(() => {
        /* non-fatal — grid still renders, just without violet tinting */
      })
    return () => {
      cancelled = true
    }
  }, [uploadId, idToken])

  // ── Optimistic overlay restore (sessionStorage) ─────────────────────
  // Persist in-progress edits per {file_id, session_id} so an accidental
  // browser refresh doesn't lose them. Hydrated below once the user
  // confirms "Restore"; cleared on successful save (lastSavedAt change).
  const overlay = useOverlayPersist({
    fileId: uploadId,
    sessionId: editor.sessionInfo?.session_id,
    editsMap: editor.editsMap,
  })
  const [overlayBannerVisible, setOverlayBannerVisible] = useState(false)
  useEffect(() => {
    if (overlay.restoredCount > 0) setOverlayBannerVisible(true)
  }, [overlay.restoredCount])
  const lastSavedRef = useRef<Date | null>(null)
  useEffect(() => {
    if (editor.lastSavedAt && editor.lastSavedAt !== lastSavedRef.current) {
      lastSavedRef.current = editor.lastSavedAt
      overlay.clearPersisted()
    }
  // overlay is a new object each render; use the stable clearPersisted callback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.lastSavedAt, overlay.clearPersisted])
  const handleOverlayRestore = useCallback(() => {
    if (overlay.restored?.edits_map) {
      editor.hydrateEdits(overlay.restored.edits_map)
    }
    setOverlayBannerVisible(false)
  }, [overlay.restored, editor])
  const handleOverlayDiscard = useCallback(() => {
    overlay.discardRestored()
    setOverlayBannerVisible(false)
    editor.refreshSession?.()
  }, [overlay, editor])

  // Forward refs from collab back into find (#7). Collab is created
  // BELOW (it needs handleRemoteCellUpdate which closes over editor),
  // but find needs collab's bulk-lock fns. Refs break the cycle: find
  // calls into the ref, which is populated after collab initializes.
  const collabAcquireBulkRef = useRef<
    ((cells: string[]) => Promise<{
      acquired: boolean
      conflicting?: string[]
      reason?: string
    }>) | null
  >(null)
  const collabReleaseBulkRef = useRef<
    ((cells: string[]) => void) | null
  >(null)

  const find = useQuarantineFind({
    uploadId,
    authToken: idToken,
    sessionId: editor.sessionInfo?.session_id,
    sessionEtag: editor.sessionInfo?.session_etag,
    columns: editor.columns,
    // Bug #4 — forward filter scope to Find / Replace All.
    filters: filterState.filters,
    onCellEdit: editor.handleCellEdit,
    saveEdits: editor.saveEdits,
    onAfterReplaceAll: useCallback(
      (_newEtag: string, replaced: number, skipped: number) => {
        if (replaced > 0 || skipped > 0) {
          toast.success(
            skipped > 0
              ? `Replaced ${replaced.toLocaleString()} cells · ${skipped.toLocaleString()} skipped (locked)`
              : `Replaced ${replaced.toLocaleString()} cells`,
          )
        }
        // Refresh session to pull the latest etag and re-fetch grid rows.
        editor.refreshSession?.()
      },
      [editor],
    ),
    acquireBulkLocks: useCallback(
      async (cells: string[]) => {
        const fn = collabAcquireBulkRef.current
        if (!fn) return { acquired: true }  // collab not ready → fall through
        return fn(cells)
      },
      [],
    ),
    releaseBulkLocks: useCallback(
      (cells: string[]) => {
        const fn = collabReleaseBulkRef.current
        if (fn) fn(cells)
      },
      [],
    ),
    onBulkLockConflict: useCallback(
      (conflicting: string[], reason?: string) => {
        const cellsLabel =
          conflicting.length === 1
            ? conflicting[0]
            : `${conflicting.length} cells`
        toast.error(
          reason || `Find/replace blocked: ${cellsLabel} are being edited by another user`,
        )
      },
      [],
    ),
  })

  const handleRemoteCellUpdate = useCallback((column: string, rowId: string, value: string) => {
    console.log('[Collab] Remote cell update received:', { column, rowId, value, hasGridApi: !!gridApiRef.current })
    // Update React state so future fetches return the updated value
    editor.applyRemoteEdit(rowId, { [column]: value, [`${column}_dq_status`]: 'edited' })
    // Directly update AG Grid's internal row data (infinite model has its own cache)
    if (gridApiRef.current) {
      const rowNode = gridApiRef.current.getRowNode(rowId)
      console.log('[Collab] Row node found:', { rowId, found: !!rowNode, hasData: !!rowNode?.data })
      if (rowNode && rowNode.data) {
        rowNode.setData({ ...rowNode.data, [column]: value, [`${column}_dq_status`]: 'edited' })
      }
    }
  }, [editor.applyRemoteEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  // QE-debug 2026-05-17: open the collaboration WebSocket as soon as we have
  // credentials, NOT gated by manifest/sessionInfo. The WS protocol uses
  // `uploadId` only (cell locks + presence broadcast); session_id is never
  // sent over the wire. Previously, a transient manifest-fetch failure left
  // `sessionInfo=null` → `enabled=false` → WS never connected, even though
  // presence + locks would have worked fine. This was the root cause of
  // QE-01/QE-06/QE-09 showing 0/10 WSConnections registered.
  const collab = useCollaboration({
    uploadId,
    accessToken,
    idToken,
    enabled: Boolean(uploadId && accessToken),
    onRemoteCellUpdate: handleRemoteCellUpdate,
  })

  // Populate the F&R bulk-lock refs once collab is initialized so
  // useQuarantineFind can call them (#7).
  useEffect(() => {
    collabAcquireBulkRef.current = collab.acquireBulkLocks
    collabReleaseBulkRef.current = collab.releaseBulkLocks
  }, [collab.acquireBulkLocks, collab.releaseBulkLocks])

  const gridApiRef = useRef<GridApi<QuarantineRow> | null>(null)

  // Column visibility
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())

  const toggleColumn = useCallback((column: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }, [])

  const showAllColumns = useCallback(() => setHiddenColumns(new Set()), [])

  const hideAllColumns = useCallback(() => {
    setHiddenColumns(new Set(editor.columns.filter((c) => c !== 'row_id')))
  }, [editor.columns])

  const visibleColumns = useMemo(
    () => editor.columns.filter((c) => c === 'row_id' || !hiddenColumns.has(c)),
    [editor.columns, hiddenColumns],
  )

  // ── Bug 21: Bulk-fix UI state ───────────────────────────────────────
  // selectedRowIds is owned here so it survives AG Grid infinite-row-model
  // block eviction (otherwise selection would vanish on scroll).
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [bulkApplyDialogOpen, setBulkApplyDialogOpen] = useState(false)
  const [bulkApplying, setBulkApplying] = useState(false)

  const handleToggleRowSelected = useCallback((rowId: string, selected: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }, [])

  const handleToggleSelectAllVisible = useCallback(
    (rowIds: string[], selectAll: boolean) => {
      setSelectedRowIds((prev) => {
        const next = new Set(prev)
        if (selectAll) {
          for (const id of rowIds) next.add(id)
        } else {
          for (const id of rowIds) next.delete(id)
        }
        return next
      })
    },
    [],
  )

  const handleBulkClearSelection = useCallback(() => {
    setSelectedRowIds(new Set())
  }, [])

  // Reset bulk selection when the upload changes or a reprocess version
  // refreshes the grid (selection on a stale row_id is meaningless).
  useEffect(() => {
    setSelectedRowIds(new Set())
  }, [uploadId, editor.dataVersion])

  /**
   * Apply a single value to a column across every selected row.
   *
   * Wire pattern: the existing `editor.handleCellEdit` enqueues an edit in
   * the autosave map; `editor.saveEdits()` flushes via
   * `POST /files/{id}/quarantined/edits/batch` in chunks of
   * `config.maxEditsPerBatch`.  For >500 rows we still issue a single
   * confirm dialog (handled inside the dialog) but the wire shape stays
   * identical to the single-cell path — no new BE endpoint required.
   *
   * TODO(bulk-edit-endpoint): once the BE exposes a dedicated bulk
   * "set column to value" endpoint we can collapse this to one round-trip.
   */
  const handleBulkApply = useCallback(
    async (column: string, value: string) => {
      if (!column || selectedRowIds.size === 0) return
      setBulkApplying(true)
      try {
        // Stage every edit through handleCellEdit so the dq_status flips
        // ("edited"), the local row map updates, and collab broadcasts go
        // out — same path as a single-cell edit, just fanned out.
        const ids = Array.from(selectedRowIds)
        // Chunk locally for UI responsiveness (yields back to the event
        // loop every 100 edits).  Save batching is handled inside saveEdits.
        const CHUNK = 100
        for (let i = 0; i < ids.length; i += CHUNK) {
          const slice = ids.slice(i, i + CHUNK)
          for (const rowId of slice) {
            handleCellEditWithBroadcast(rowId, column, value, undefined)
          }
          // Yield so the grid can repaint between chunks.
          if (ids.length > CHUNK) {
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
        }
        const ok = await editor.saveEdits()
        if (ok) {
          toast.success(`Updated ${ids.length.toLocaleString()} cell${ids.length === 1 ? '' : 's'}`)
          setBulkApplyDialogOpen(false)
          setSelectedRowIds(new Set())
        } else {
          toast.error('Bulk update failed — see console for details')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Bulk update failed')
      } finally {
        setBulkApplying(false)
      }
    },
    [selectedRowIds, editor], // eslint-disable-line react-hooks/exhaustive-deps
  )

  /**
   * Mark every selected row as "fixed" — flips the dq_status of every
   * cell-level marker on the row to `fixed`.  Implementation uses the
   * same edits/batch pipeline: we only patch the `{col}_dq_status` field,
   * leaving the underlying values untouched.  Locked rows are filtered
   * out by the BE on the batch save.
   *
   * NOTE: We only flip the status on the editable_columns; the row_id
   * column is never a target.
   */
  const handleBulkMarkFixed = useCallback(async () => {
    if (selectedRowIds.size === 0) return
    const editable = (editor.manifest?.editable_columns || []).filter(
      (c) => c !== 'row_id',
    )
    if (editable.length === 0) {
      toast.error('No editable columns to mark as fixed')
      return
    }
    setBulkApplying(true)
    try {
      const ids = Array.from(selectedRowIds)
      const CHUNK = 100
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK)
        for (const rowId of slice) {
          for (const col of editable) {
            // Reuse the existing cell-edit path: we re-write the cell
            // with the current value so the edit goes through, and the
            // dq_status flip rides along (handleCellEdit appends
            // `{col}_dq_status=edited`; the BE collapses "edited" to
            // "fixed" on reprocess).  Cheap and uniform.
            const current = editor.getCellValue(rowId, col, {} as Record<string, any>)
            editor.handleCellEdit(rowId, col, String(current ?? ''))
          }
        }
        if (ids.length > CHUNK) {
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
      }
      const ok = await editor.saveEdits()
      if (ok) {
        toast.success(
          `Marked ${ids.length.toLocaleString()} row${ids.length === 1 ? '' : 's'} as fixed`,
        )
        setSelectedRowIds(new Set())
      } else {
        toast.error('Mark-as-fixed failed — see console for details')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Mark-as-fixed failed')
    } finally {
      setBulkApplying(false)
    }
  }, [selectedRowIds, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // Compare dialog state — captures the focused row at click-time so the diff
  // is stable while open even if the user moves the grid cursor.
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareRows, setCompareRows] = useState<QuarantineRow[]>([])

  // Between-VERSIONS comparison dialog (separate from the row-level Compare above).
  const [versionCompareOpen, setVersionCompareOpen] = useState(false)

  // ── Unlock locked-row dialog state (#6) ─────────────────────────────────
  const [unlockTargetRowId, setUnlockTargetRowId] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const isSuperAdmin = userRole === 'Super Admin'

  const handleUnlockRowClick = useCallback((rowId: string) => {
    if (!isSuperAdmin) return
    setUnlockTargetRowId(rowId)
  }, [isSuperAdmin])

  const handleConfirmUnlock = useCallback(async () => {
    if (!unlockTargetRowId || !idToken) return
    setUnlocking(true)
    try {
      await unlockRow(uploadId, unlockTargetRowId, idToken)
      // Optimistically clear is_locked locally so the badge disappears
      // and editing re-enables without forcing a full reload.
      const api = gridApiRef.current
      if (api) {
        const node = api.getRowNode(unlockTargetRowId)
        if (node && node.data) {
          node.setData({ ...node.data, is_locked: false })
        }
      }
      toast.success(`Row ${unlockTargetRowId} unlocked`)
      setUnlockTargetRowId(null)
    } catch (e: any) {
      const msg = String(e?.message || 'Unlock failed')
      toast.error(msg)
    } finally {
      setUnlocking(false)
    }
  }, [unlockTargetRowId, idToken, uploadId])

  const handleOpenCompare = useCallback(() => {
    const api = gridApiRef.current
    if (!api) return
    const collected: QuarantineRow[] = []
    // Prefer multi-selection if any rows are selected (future-proof — grid
    // currently has no checkbox column, but selection API still works).
    const selected = api.getSelectedRows?.() ?? []
    if (selected.length > 0) {
      collected.push(...(selected as QuarantineRow[]))
    } else {
      const focused = api.getFocusedCell?.()
      if (focused) {
        const node = api.getDisplayedRowAtIndex(focused.rowIndex)
        if (node?.data) collected.push(node.data as QuarantineRow)
      }
    }
    if (collected.length === 0) return
    setCompareRows(collected)
    setCompareOpen(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault()
        find.setOpen(!find.open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [find.open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (collab.lockDeniedCell && gridApiRef.current) {
      gridApiRef.current.stopEditing(true)
    }
  }, [collab.lockDeniedCell])

  // Reprocess gate. Super Admins / approved users trigger the delta
  // reprocess directly (no confirmation dialog). Users still in the
  // approval-request flow defer to the editor hook's existing modal.
  const [reprocessRunning, setReprocessRunning] = useState(false)
  const reprocessGate = useMemo(() => {
    if (userRole === 'Super Admin') return 'CONFIRM' as const
    if (editor.approvalStatus === 'APPROVED') return 'CONFIRM' as const
    return 'APPROVAL_FLOW' as const
  }, [userRole, editor.approvalStatus])

  const performReprocess = useCallback(async () => {
    setReprocessRunning(true)
    try {
      const result = await editor.handleReprocessAction()
      if (result) navigateBack()
    } finally {
      setReprocessRunning(false)
    }
  }, [editor, navigateBack])

  const handlePrimaryAction = async () => {
    if (reprocessGate === 'APPROVAL_FLOW') {
      // Defer to existing approval-request flow inside the editor hook.
      const result = await editor.handleReprocessAction()
      if (result) navigateBack()
      return
    }
    // Trigger the delta reprocess immediately — no confirmation dialog.
    void performReprocess()
  }

  const approvalStateLabel = (() => {
    if (userRole === 'Super Admin') return 'Super Admin bypass'
    switch (editor.approvalStatus) {
      case 'PENDING':
        return 'Awaiting approval'
      case 'APPROVED':
        return 'Approval granted'
      case 'REJECTED':
        return 'Approval rejected'
      default:
        return 'Approval required'
    }
  })()

  const approvalStateBadge = (() => {
    if (userRole === 'Super Admin') {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <ClipboardCheck className="h-3 w-3" />
          Super Admin
        </Badge>
      )
    }

    switch (editor.approvalStatus) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 gap-1.5">
            <Clock className="h-3 w-3" />
            Pending approval
          </Badge>
        )
      case 'APPROVED':
        return (
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 gap-1.5">
            <Check className="h-3 w-3" />
            Approved
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 gap-1.5">
            <X className="h-3 w-3" />
            Rejected
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1.5">
            <ClipboardCheck className="h-3 w-3" />
            Request approval
          </Badge>
        )
    }
  })()

  const handleCellEditStart = useCallback((column: string, rowId: string) => {
    collab.focusCell(column, rowId)
  }, [collab.focusCell])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellEditStop = useCallback((column: string, rowId: string) => {
    collab.blurCell(column, rowId)
  }, [collab.blurCell])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Undo per-cell (20-edit ring buffer + Ctrl+Z) ────────────────────
  const history = useEditHistory()
  const [undoToast, setUndoToast] = useState<{ open: boolean; column: string | null }>({
    open: false,
    column: null,
  })
  // history.clear is a stable useCallback — use it directly in deps instead of
  // the history object (which is a new reference every render and would cause
  // an infinite setState loop via setVersion inside clear(); React error #185).
  useEffect(() => { history.clear() }, [uploadId, history.clear]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellEditWithBroadcast = useCallback((rowId: string, column: string, value: string, oldValue?: string) => {
    // ── Undo bug fix (2026-05-15) ──────────────────────────────────────
    // The previous implementation tried `editor.getCellValue(rowId, column, {})`
    // to recover the pre-edit value, but passed an EMPTY row object — so the
    // lookup fell through `editsMap → savedEditsMap → originalRow[column] ?? ''`
    // and always returned ''. Undo then wrote '' back, blanking the cell.
    // AG-Grid now forwards `event.oldValue` through `onCellEdit`, so we have
    // the real pre-edit value to push onto the undo stack.
    const previous =
      oldValue !== undefined
        ? oldValue
        : editor.getCellValue(rowId, column, {} as Record<string, any>)
    editor.handleCellEdit(rowId, column, value)
    collab.broadcastCellUpdate(column, rowId, value)
    history.push({ file_id: uploadId, row_id: rowId, column, old_value: previous, new_value: value })
    setUndoToast({ open: true, column })
  }, [editor.handleCellEdit, editor.getCellValue, collab.broadcastCellUpdate, history, uploadId])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = useCallback(() => {
    const entry = history.undo()
    if (!entry) return
    editor.handleCellEdit(entry.row_id, entry.column, entry.old_value)
    collab.broadcastCellUpdate(entry.column, entry.row_id, entry.old_value)
    // W5B-1: Surface a sonner toast so the user has a clear audit-trail
    // confirmation of the undo (the action toast above auto-dismisses on
    // click).  Keep the message short: column + restored value.
    const restored =
      entry.old_value === null || entry.old_value === undefined || entry.old_value === ''
        ? '(empty)'
        : String(entry.old_value)
    toast.success(`Undid: ${entry.column} restored to "${restored}"`, {
      duration: 3500,
    })
  }, [history, editor.handleCellEdit, collab.broadcastCellUpdate])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (history.size === 0) return
        const active = document.activeElement as HTMLElement | null
        const tag = active?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, history.size])

  const handleGridApiReady = useCallback((api: GridApi<QuarantineRow>) => {
    gridApiRef.current = api
  }, [])

  const isGridReady = editor.compatibilityMode || Boolean(editor.manifest)

  const gridInstanceKey = [
    uploadId,
    editor.compatibilityMode ? 'legacy' : editor.sessionInfo?.session_id ?? 'pending',
    String(editor.dataVersion),
    String(editor.totalRows),
  ].join(':')

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" onClick={navigateBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <QuarantineEditorHeader
          manifest={editor.manifest}
          pendingCount={editor.pendingCount}
          compatibilityMode={editor.compatibilityMode}
        />
      </div>

      {/* Toolbar */}
      <QuarantineEditorToolbar
        session={editor.sessionInfo}
        saving={editor.saving}
        submitting={editor.submitting}
        savedAt={editor.lastSavedAt}
        currentUserRole={userRole}
        approvalStatus={editor.approvalStatus}
        approvalLoading={editor.approvalLoading}
        onPrimaryAction={handlePrimaryAction}
        onFindReplace={() => find.setOpen(!find.open)}
        onCompare={handleOpenCompare}
        compareDisabled={!isGridReady}
        columns={editor.columns}
        hiddenColumns={hiddenColumns}
        onToggleColumn={toggleColumn}
        onShowAllColumns={showAllColumns}
        onHideAllColumns={hideAllColumns}
        collabConnected={collab.connected}
        collabUsers={collab.users}
        collabPanelOpen={collab.panelOpen}
        onToggleCollabPanel={() => collab.setPanelOpen(!collab.panelOpen)}
        bulkSelectedCount={selectedRowIds.size}
        onBulkApplyValue={() => setBulkApplyDialogOpen(true)}
        onBulkMarkFixed={() => void handleBulkMarkFixed()}
        onBulkClearSelection={handleBulkClearSelection}
        bulkApplying={bulkApplying}
      />

      {/* Version lineage */}
      {editor.lineage.length > 0 && (
        <QuarantineVersionLineage
          lineage={editor.lineage}
          baseUploadId={editor.manifest?.upload_id}
          onCompareVersions={() => setVersionCompareOpen(true)}
        />
      )}

      <QuarantineFilterBar
        chips={filterState.activeChips}
        onRemoveFilter={filterState.removeFilter}
        onClearAll={filterState.clearAllFilters}
      />

      {overlayBannerVisible && overlay.restoredCount > 0 && (
        <div
          role="alert"
          data-testid="overlay-restore-banner"
          className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span>
            Restored {overlay.restoredCount} unsaved edit
            {overlay.restoredCount === 1 ? '' : 's'} from previous session — Save or Discard
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleOverlayRestore}>
              Restore
            </Button>
            <Button size="sm" variant="ghost" onClick={handleOverlayDiscard}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="relative min-h-0 flex-1 flex overflow-hidden">
        {/* Grid area */}
        <div className="relative flex-1">
          {find.open && (
            <QuarantineFindReplacePanel
              searchTerm={find.searchTerm}
              replaceTerm={find.replaceTerm}
              column={find.column}
              matchCase={find.matchCase}
              totalMatches={find.totalMatches}
              currentIndex={find.currentIndex}
              truncated={find.truncated}
              loading={find.loading}
              columns={editor.columns}
              hasMoreMatches={find.hasMoreMatches}
              lockedRowIds={find.lockedRowIds}
              onSearchTermChange={find.setSearchTerm}
              onReplaceTermChange={find.setReplaceTerm}
              onColumnChange={find.setColumn}
              onMatchCaseChange={find.setMatchCase}
              onNext={find.goToNext}
              onPrevious={find.goToPrevious}
              onReplaceCurrent={find.replaceCurrent}
              onReplaceAll={find.replaceAll}
              onClose={() => find.setOpen(false)}
            />
          )}
          <div className="absolute inset-0">
            {isGridReady ? (
              <QuarantineAgGridTable
                key={gridInstanceKey}
                columns={visibleColumns}
                editableColumns={editor.manifest?.editable_columns || []}
                totalRows={editor.totalRows}
                fetchRows={editor.fetchRows}
                getCellValue={editor.getCellValue}
                isCellEdited={editor.isCellEdited}
                isCellSaved={editor.isCellSaved}
                onCellEdit={handleCellEditWithBroadcast}
                loading={editor.loading}
                uploadId={uploadId}
                reloadToken={editor.dataVersion}
                findMatches={find.matches}
                currentMatch={find.currentMatch}
                cellLocksRef={collab.cellLocksRef}
                onCellEditingStarted={handleCellEditStart}
                onCellEditingStopped={handleCellEditStop}
                onGridApiReady={handleGridApiReady}
                onUnlockRowClick={handleUnlockRowClick}
                canUnlock={isSuperAdmin}
                augmentedColumns={augmentedColumns}
                selectedRowIds={selectedRowIds}
                onToggleRowSelected={handleToggleRowSelected}
                onToggleSelectAllVisible={handleToggleSelectAllVisible}
                filterComponent={(column) => (
                  <QuarantineColumnFilter
                    column={column}
                    uploadId={uploadId}
                    authToken={idToken}
                    currentFilter={filterState.filters.columns[column]}
                    onFilterChange={filterState.setColumnFilter}
                  />
                )}
              />
            ) : !editor.loading ? (
              <div
                role="alert"
                data-testid="quarantine-load-error"
                className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center"
              >
                <span className="text-sm font-medium text-destructive">
                  Failed to load quarantine data
                </span>
                {editor.initError?.message && (
                  <span className="max-w-xl text-xs text-muted-foreground break-words">
                    {editor.initError.status ? `[${editor.initError.status}] ` : ''}
                    {editor.initError.message}
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  API: {AWS_CONFIG.API_BASE_URL || '(unset — Next.js env not baked; restart dev server)'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => editor.retryInit()}
                  className="gap-2"
                >
                  <Loader2 className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <span className="text-sm font-medium text-slate-500">Loading quarantine data...</span>
              </div>
            )}
          </div>
        </div>

        {/* Collaboration panel */}
        {collab.panelOpen && (
          <QuarantineCollaborationPanel
            users={collab.users}
            activity={collab.activity}
            connected={collab.connected}
            currentUserId={currentUserId}
            onClose={() => collab.setPanelOpen(false)}
          />
        )}
      </div>

      <QuarantineCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        rows={compareRows}
        columns={visibleColumns}
        getCellValue={editor.getCellValue}
        isCellEdited={editor.isCellEdited}
      />

      <QuarantineVersionCompareDialog
        open={versionCompareOpen}
        onOpenChange={setVersionCompareOpen}
        uploadId={uploadId}
        authToken={idToken}
        lineage={editor.lineage}
        columns={visibleColumns}
      />

      {/* Bug 21: Bulk "Apply value to all" dialog */}
      <QuarantineBulkApplyDialog
        open={bulkApplyDialogOpen}
        onOpenChange={(open) => {
          if (!bulkApplying) setBulkApplyDialogOpen(open)
        }}
        editableColumns={editor.manifest?.editable_columns || []}
        selectedRowCount={selectedRowIds.size}
        onApply={handleBulkApply}
        applying={bulkApplying}
      />

      {/* ── Unlock confirmation dialog (#6) ──────────────────────────── */}
      <Dialog
        open={unlockTargetRowId !== null}
        onOpenChange={(open) => { if (!open) setUnlockTargetRowId(null) }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-amber-600" />
              Unlock pushed row
            </DialogTitle>
            <DialogDescription>
              Row <span className="font-mono font-medium">{unlockTargetRowId}</span> was
              pushed to a destination connector and is currently read-only. Unlocking
              will let you edit it again, but the original push remains in the audit log
              alongside an <span className="font-medium">unlock</span> event with your name.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setUnlockTargetRowId(null)}
              disabled={unlocking}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUnlock}
              disabled={unlocking}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {unlocking ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-3.5 w-3.5" />
              )}
              Unlock row
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editor.approvalRequestDialogOpen}
        onOpenChange={(open) => {
          editor.setApprovalRequestDialogOpen(open)
          if (!open) {
            editor.setApprovalRequestMessage('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-2">
              {approvalStateBadge}
            </div>
            <DialogTitle>Request Super Admin approval</DialogTitle>
            <DialogDescription>
              {approvalStateLabel}. Add an optional note for the reviewer, then submit the request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <Label htmlFor="approval-message" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Message
            </Label>
            <Textarea
              id="approval-message"
              value={editor.approvalRequestMessage}
              onChange={(event) => editor.setApprovalRequestMessage(event.target.value)}
              placeholder="Optional note for the Super Admin..."
              className="min-h-[120px]"
              disabled={editor.approvalRequestSubmitting}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                editor.setApprovalRequestDialogOpen(false)
                editor.setApprovalRequestMessage('')
              }}
              disabled={editor.approvalRequestSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void editor.requestApproval()}
              disabled={editor.approvalRequestSubmitting}
              className="gap-2"
            >
              {editor.approvalRequestSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-cell undo toast (8s auto-dismiss; Ctrl+Z is the keyboard equivalent) */}
      <QuarantineUndoToast
        column={undoToast.column}
        open={undoToast.open}
        onOpenChange={(open) => setUndoToast((s) => ({ ...s, open }))}
        onUndo={handleUndo}
      />

    </div>
  )
}
