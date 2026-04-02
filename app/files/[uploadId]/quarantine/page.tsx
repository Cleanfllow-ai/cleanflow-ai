'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/modules/auth'
import { useQuarantineEditor, useQuarantineFilters } from '@/modules/files/hooks'
import { QuarantineFilterBar } from '@/modules/files/components/quarantine-editor/quarantine-filter-bar'
import { QuarantineColumnFilter } from '@/modules/files/components/quarantine-editor/quarantine-column-filter'
import { QuarantineEditorHeader } from '@/modules/files/components/quarantine-editor/quarantine-editor-header'
import { QuarantineEditorToolbar } from '@/modules/files/components/quarantine-editor/quarantine-editor-toolbar'
import { QuarantineAgGridTable } from '@/modules/files/components/quarantine-editor/quarantine-ag-grid-table'
import { QuarantineVersionLineage } from '@/modules/files/components/quarantine-editor/quarantine-version-lineage'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ uploadId: string }>
}

export default function QuarantineEditorPage({ params }: PageProps) {
  const { uploadId } = use(params)
  const router = useRouter()
  const { idToken } = useAuth()

  const file = { upload_id: uploadId, filename: '', original_filename: '' }

  const filterState = useQuarantineFilters()

  const editor = useQuarantineEditor({
    file,
    authToken: idToken,
    filters: filterState.filters,
  })

  const handleReprocess = async () => {
    const result = await editor.submitReprocess()
    if (result) router.push('/files')
  }

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
      <div className="relative min-h-0 flex-1 overflow-hidden">
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
              onCellEdit={editor.handleCellEdit}
              loading={editor.loading}
              uploadId={uploadId}
              reloadToken={editor.dataVersion}
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
    </div>
  )
}
