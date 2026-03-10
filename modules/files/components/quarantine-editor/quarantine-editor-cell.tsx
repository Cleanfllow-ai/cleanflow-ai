/**
 * quarantine-editor-cell.tsx
 *
 * Editable cell component for quarantine editor
 * Handles inline editing with keyboard navigation
 */

'use client'

interface QuarantineEditorCellProps {
  rowId: string
  column: string
  value: string
  isEditable: boolean
  isActive: boolean
  isEdited: boolean
  onEdit: (rowId: string, column: string, value: string) => void
  onActivate: (rowId: string, column: string) => void
  onDeactivate: () => void
}

export function QuarantineEditorCell({
  rowId,
  column,
  value,
  isEditable,
  isActive,
  isEdited,
  onEdit,
  onActivate,
  onDeactivate,
}: QuarantineEditorCellProps) {
  if (!isEditable) {
    // Non-editable cell (e.g., row_id)
    return (
      <div className="h-8 truncate px-3 py-[7px] text-xs font-mono text-muted-foreground/70 bg-muted/30" title={value}>
        {value}
      </div>
    )
  }

  if (isActive) {
    // Active editing mode
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => onEdit(rowId, column, e.target.value)}
        onBlur={onDeactivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            onDeactivate()
          }
        }}
        className="h-8 w-full border-0 bg-background px-3 text-xs outline-none ring-2 ring-inset ring-primary shadow-sm"
      />
    )
  }

  // Display mode
  return (
    <div
      className={`h-8 truncate px-3 py-[7px] text-xs cursor-text transition-colors duration-150 ${
        isEdited
          ? 'font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30'
          : 'hover:bg-accent/30'
      }`}
      title={value}
      onClick={() => onActivate(rowId, column)}
    >
      {value || <span className="text-muted-foreground/40 italic text-[11px]">empty</span>}
    </div>
  )
}
