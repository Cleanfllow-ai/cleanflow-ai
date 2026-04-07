'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/modules/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useQuarantineEditor, useQuarantineFilters, useQuarantineFind } from '@/modules/files/hooks'
import { useCollaboration } from '@/modules/files/hooks'
import { QuarantineCollaborationPanel } from '@/modules/files/components/quarantine-editor/quarantine-collaboration-panel'
import { QuarantineFilterBar } from '@/modules/files/components/quarantine-editor/quarantine-filter-bar'
import { QuarantineColumnFilter } from '@/modules/files/components/quarantine-editor/quarantine-column-filter'
import { QuarantineEditorHeader } from '@/modules/files/components/quarantine-editor/quarantine-editor-header'
import { QuarantineEditorToolbar } from '@/modules/files/components/quarantine-editor/quarantine-editor-toolbar'
import { QuarantineAgGridTable } from '@/modules/files/components/quarantine-editor/quarantine-ag-grid-table'
import { QuarantineVersionLineage } from '@/modules/files/components/quarantine-editor/quarantine-version-lineage'
import { QuarantineFindReplacePanel } from '@/modules/files/components/quarantine-editor/quarantine-find-replace-panel'
import { ArrowLeft, ClipboardCheck, Check, Clock, Loader2, X } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types'

interface PageProps {
  params: Promise<{ uploadId: string }>
}

export default function QuarantineEditorPage({ params }: PageProps) {
  const { uploadId } = use(params)
  const router = useRouter()
  const { idToken, accessToken, userRole } = useAuth()

  const file = { upload_id: uploadId, filename: '', original_filename: '' }

  const filterState = useQuarantineFilters()

  const editor = useQuarantineEditor({
    file,
    authToken: idToken,
    filters: filterState.filters,
  })

  const find = useQuarantineFind({
    uploadId,
    authToken: idToken,
    sessionId: editor.sessionInfo?.session_id,
    columns: editor.columns,
    onCellEdit: editor.handleCellEdit,
    saveEdits: editor.saveEdits,
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

  const collab = useCollaboration({
    uploadId,
    accessToken,
    enabled: Boolean(editor.sessionInfo),
    onRemoteCellUpdate: handleRemoteCellUpdate,
  })

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

  const handlePrimaryAction = async () => {
    const result = await editor.handleReprocessAction()
    if (result) router.push('/files')
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

  const handleCellEditWithBroadcast = useCallback((rowId: string, column: string, value: string) => {
    console.log('[Collab] handleCellEditWithBroadcast called:', { rowId, column, value })
    editor.handleCellEdit(rowId, column, value)
    collab.broadcastCellUpdate(column, rowId, value)
  }, [editor.handleCellEdit, collab.broadcastCellUpdate])  // eslint-disable-line react-hooks/exhaustive-deps

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
        <Button variant="ghost" size="icon" onClick={() => router.push('/files')}>
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
        columns={editor.columns}
        hiddenColumns={hiddenColumns}
        onToggleColumn={toggleColumn}
        onShowAllColumns={showAllColumns}
        onHideAllColumns={hideAllColumns}
        collabConnected={collab.connected}
        collabUsers={collab.users}
        collabPanelOpen={collab.panelOpen}
        onToggleCollabPanel={() => collab.setPanelOpen(!collab.panelOpen)}
      />

      {/* Version lineage */}
      {editor.lineage.length > 0 && (
        <QuarantineVersionLineage
          lineage={editor.lineage}
          baseUploadId={editor.manifest?.upload_id}
        />
      )}

      <QuarantineFilterBar
        chips={filterState.activeChips}
        onRemoveFilter={filterState.removeFilter}
        onClearAll={filterState.clearAllFilters}
      />

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
              <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
                <span className="text-sm font-medium text-destructive">Failed to load quarantine data</span>
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
            onClose={() => collab.setPanelOpen(false)}
          />
        )}
      </div>

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
    </div>
  )
}
