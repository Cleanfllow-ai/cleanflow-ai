/**
 * index.tsx - Quarantine Editor Dialog
 *
 * Main entry point for quarantine editor feature
 * Orchestrates all sub-components and business logic
 */
'use client'
import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useAuth } from '@/modules/auth'
import { useQuarantineEditor } from '@/modules/files/hooks'
import { QuarantineEditorHeader } from './quarantine-editor-header'
import { QuarantineEditorToolbar } from './quarantine-editor-toolbar'
import { QuarantineAgGridTable } from './quarantine-ag-grid-table'
import { QuarantineCustomRuleDialog } from './quarantine-custom-rule-dialog'
import { QuarantineVersionLineage } from './quarantine-version-lineage'
import type { QuarantineEditorDialogProps } from '@/modules/files/types'
/**
 * Quarantine Editor Dialog
 *
 * Focused editor for quarantined rows with:
 * - AG Grid for virtualized rendering and native resize/keyboard nav
 * - Inline cell editing
 * - Autosave
 * - Session management
 * - Compatibility mode fallback
 *
 * @param props - File, open state, and callbacks
 */
export function QuarantineEditorDialog({ file, open, onOpenChange, onReprocessSubmitted }: QuarantineEditorDialogProps) {
  const { idToken } = useAuth()
  // Main editor hook
  const editor = useQuarantineEditor({
    file,
    authToken: idToken,
    open,
  })
  // Custom rule dialog state
  const [customRuleOpen, setCustomRuleOpen] = useState(false)
  // Close handler
  const handleClose = () => {
    onOpenChange(false)
  }
  // Reprocess handler
  const handleReprocess = async () => {
    const result = await editor.submitReprocess()
    if (result && onReprocessSubmitted) {
      onReprocessSubmitted(result)
    }
    if (result) handleClose()
  }
  // After server-side apply-all: refresh session so rows + etag are up-to-date
  const handleRuleApplied = (_newEtag: string, _rowsAffected: number) => {
    editor.refreshSession()
  }
  const isGridReady = editor.compatibilityMode || Boolean(editor.manifest)
  const gridInstanceKey = [
    file?.upload_id ?? 'none',
    editor.compatibilityMode ? 'legacy' : editor.sessionInfo?.session_id ?? 'pending',
    String(editor.dataVersion),
    String(editor.totalRows),
  ].join(':')
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/*
         * flex column: inline style overrides shadcn's default grid class so
         * flex-1 on the table wrapper reliably fills all remaining height.
         */}
        <DialogContent
          className="w-[98vw] max-w-[1800px] h-[92vh] p-0 gap-0 overflow-hidden rounded-lg border border-slate-200 shadow-2xl"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {/* Row 1 — header */}
          <QuarantineEditorHeader
            manifest={editor.manifest}
            pendingCount={editor.pendingCount}
            compatibilityMode={editor.compatibilityMode}
          />
          {/* Row 2 — toolbar */}
          <QuarantineEditorToolbar
            session={editor.sessionInfo}
            saving={editor.saving}
            submitting={editor.submitting}
            savedAt={editor.lastSavedAt}
            onReprocess={handleReprocess}
          />
          {/* Row 3 — version lineage (only when versions available) */}
          {editor.lineage.length > 0 && (
            <QuarantineVersionLineage
              lineage={editor.lineage}
              baseUploadId={editor.manifest?.upload_id}
            />
          )}
        {/* Table section — flex: 1 consumes remaining height, position: relative
            establishes a containing block so the absolute inner div gets a
            definite pixel height regardless of flex/percentage quirks. */}
        <div className="relative overflow-hidden min-h-0" style={{ flex: 1 }}>
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
                uploadId={file?.upload_id ?? ''}
                reloadToken={editor.dataVersion}
              />
            ) : !editor.loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
                <span className="text-sm font-medium text-destructive">
                  Failed to load quarantine data
                </span>
                <span className="text-xs text-muted-foreground text-center max-w-md">
                  The DQ result may not be available yet. For large files, the quarantine index
                  can take several minutes to build. Try closing and reopening, or reprocess the file.
                </span>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500" />
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    Loading quarantine data...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* AI Custom Rule Dialog — rendered outside the main dialog to avoid
        Radix DismissableLayer conflicts between two nested dialogs */}
    <QuarantineCustomRuleDialog
      open={customRuleOpen}
      onOpenChange={setCustomRuleOpen}
      rows={editor.rows}
      uploadId={file?.upload_id ?? ''}
      authToken={idToken}
      session={editor.sessionInfo}
      onApplied={handleRuleApplied}
    />
    </>
  )
}
// Named export for convenient importing
export { QuarantineEditorDialog as default }
