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
    try {
      const result = await editor.submitReprocess()
      if (result?.new_upload_id && onReprocessSubmitted) {
        onReprocessSubmitted(result.new_upload_id)
      }
      handleClose()
    } catch (error) {
      // Error already toasted in hook
      console.error('Reprocess failed:', error)
    }
  }

  // After server-side apply-all: refresh session so rows + etag are up-to-date
  const handleRuleApplied = (_newEtag: string, _rowsAffected: number) => {
    editor.refreshSession()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/*
         * flex column: inline style overrides shadcn's default grid class so
         * flex-1 on the table wrapper reliably fills all remaining height.
         */}
        <DialogContent
          className="w-[98vw] max-w-[1700px] h-[90vh] p-0 gap-0 overflow-hidden"
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
            onOpenCustomRule={() => setCustomRuleOpen(true)}
          />

        {/* Table section — flex: 1 consumes remaining height, position: relative
            establishes a containing block so the absolute inner div gets a
            definite pixel height regardless of flex/percentage quirks. */}
        <div className="relative overflow-hidden min-h-0" style={{ flex: 1 }}>
          <div className="absolute inset-0">
            <QuarantineAgGridTable
              rows={editor.rows}
              columns={editor.columns}
              editableColumns={editor.manifest?.editable_columns || []}
              isCellEdited={editor.isCellEdited}
              isCellSaved={editor.isCellSaved}
              onCellEdit={editor.handleCellEdit}
              loading={editor.loading || editor.rowsLoading}
              onBodyScrollEnd={editor.handleBodyScrollEnd}
              uploadId={file?.upload_id ?? ''}
              authToken={idToken}
            />
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
