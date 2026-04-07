'use client'

import { use, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/modules/auth'
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
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GridApi } from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types'

interface PageProps {
  params: Promise<{ uploadId: string }>
}

export default function QuarantineEditorPage({ params }: PageProps) {
  const { uploadId } = use(params)
  const router = useRouter()
  const { idToken, accessToken } = useAuth()

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

  const collab = useCollaboration({
    uploadId,
    accessToken,
    enabled: Boolean(editor.sessionInfo),
  })

  const gridApiRef = useRef<GridApi<QuarantineRow> | null>(null)

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

  const handleReprocess = async () => {
    const result = await editor.submitReprocess()
    if (result) router.push('/files')
  }

  const handleCellEditStart = useCallback((column: string, rowId: string) => {
    collab.focusCell(column, rowId)
  }, [collab.focusCell])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellEditStop = useCallback((column: string, rowId: string) => {
    collab.blurCell(column, rowId)
  }, [collab.blurCell])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellEditWithBroadcast = useCallback((rowId: string, column: string, value: string) => {
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
        onReprocess={handleReprocess}
        onFindReplace={() => find.setOpen(!find.open)}
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
                columns={editor.columns}
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
    </div>
  )
}
