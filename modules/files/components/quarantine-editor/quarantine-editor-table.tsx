/**
 * quarantine-editor-table.tsx
 *
 * Virtual scrolling table component for quarantine editor
 * Renders only visible rows for performance
 */

'use client'

import { Loader2 } from 'lucide-react'
import { QuarantineEditorCell } from './quarantine-editor-cell'
import type { QuarantineRow, QuarantineManifest, ActiveCell } from '@/modules/files/types'

interface QuarantineEditorTableProps {
  // Data
  columns: string[]
  virtualRows: QuarantineRow[]
  visibleStart: number
  editableColumns: string[]

  // State
  activeCell: ActiveCell | null
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any
  isCellEdited: (rowId: string, column: string) => boolean
  isRowEdited: (rowId: string) => boolean

  // Actions
  onCellEdit: (rowId: string, column: string, value: string) => void
  onActivateCell: (rowId: string, column: string) => void
  onDeactivateCell: () => void

  // Virtual scroll
  parentRef: React.RefObject<HTMLDivElement | null>
  totalHeight: number
  rowHeight: number
  headerHeight: number
  onScroll: () => void

  // Loading state
  loading: boolean
}

export function QuarantineEditorTable({
  columns,
  virtualRows,
  visibleStart,
  editableColumns,
  activeCell,
  getCellValue,
  isCellEdited,
  isRowEdited,
  onCellEdit,
  onActivateCell,
  onDeactivateCell,
  parentRef,
  totalHeight,
  rowHeight,
  headerHeight,
  onScroll,
  loading,
}: QuarantineEditorTableProps) {
  const tableMinWidth = Math.max(860, columns.length * 132)

  if (loading && virtualRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-0 bg-muted/5">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading quarantined rows...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-x-scroll overflow-y-auto [scrollbar-gutter:stable] min-h-0 bg-muted/5"
      onScroll={onScroll}
    >
      <div
        style={{
          height: `${totalHeight}px`,
          position: 'relative',
          minWidth: `${tableMinWidth}px`,
        }}
      >
        {/* Header row */}
        <div
          className="sticky top-0 z-20 bg-gradient-to-b from-muted/90 to-muted/70 backdrop-blur-sm border-b-2 border-border grid shadow-sm"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(132px, 1fr))` }}
        >
          {columns.map((col) => (
            <div
              key={col}
              className="px-3 py-2.5 text-xs font-semibold border-r border-border/50 truncate text-foreground/80 uppercase tracking-wide"
            >
              {col}
            </div>
          ))}
        </div>

        {/* Virtual rows */}
        {virtualRows.map((row, idx) => {
          const rowIndex = visibleStart + idx
          const rowId = String(row.row_id)
          const rowEdited = isRowEdited(rowId)

          return (
            <div
              key={`${rowId}-${rowIndex}`}
              className={`absolute left-0 w-full grid border-b border-border/30 transition-colors duration-150 ${
                rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/[0.12]'
              } ${rowEdited ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-500' : ''} hover:bg-accent/40`}
              style={{
                transform: `translateY(${headerHeight + rowIndex * rowHeight}px)`,
                gridTemplateColumns: `repeat(${columns.length}, minmax(132px, 1fr))`,
              }}
            >
              {columns.map((col) => {
                const editable = col !== 'row_id' && editableColumns.includes(col)
                const isActive = activeCell?.rowId === rowId && activeCell?.col === col
                const value = String(getCellValue(rowId, col, row))
                const isEdited = isCellEdited(rowId, col)

                return (
                  <div key={`${rowId}-${col}`} className="border-r border-border/30">
                    <QuarantineEditorCell
                      rowId={rowId}
                      column={col}
                      value={value}
                      isEditable={editable}
                      isActive={isActive}
                      isEdited={isEdited}
                      onEdit={onCellEdit}
                      onActivate={onActivateCell}
                      onDeactivate={onDeactivateCell}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
