'use client'

/**
 * quarantine-ag-grid-table.tsx
 *
 * AG Grid Community wrapper for the quarantine editor.
 * Replaces the custom virtual-scroll table (quarantine-editor-table.tsx).
 *
 * Features:
 * - GRID-02: Resizable columns via drag
 * - GRID-03: Frozen/pinned headers during vertical scroll (AG Grid default)
 * - GRID-04: Arrow key navigation and Enter-to-edit on cells
 *
 * Designed to be wired into the quarantine editor dialog in Plan 02.
 * AG Grid handles row virtualization internally — no external virtual scroll needed.
 */

import { useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type CellValueChangedEvent,
  type BodyScrollEndEvent,
} from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types/quarantine.types'
import './quarantine-ag-grid-theme.css'

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuarantineAgGridTableProps {
  /** All quarantined row data passed to AG Grid as rowData */
  rows: QuarantineRow[]
  /** Ordered list of column names derived from the quarantine manifest */
  columns: string[]
  /** Subset of columns that are editable by the user */
  editableColumns: string[]

  /**
   * Edit state integration from useQuarantineEdits hook.
   * Returns the current value for a cell, applying pending edits over the raw row value.
   */
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any
  /**
   * Returns true if the given cell has a pending (unsaved) edit.
   * Used to apply the .ag-cell-edited CSS class for visual indicators.
   */
  isCellEdited: (rowId: string, column: string) => boolean
  /**
   * Fires when a user commits an edit to a cell.
   * Delegates to the quarantine edits hook which tracks and autosaves changes.
   */
  onCellEdit: (rowId: string, column: string, value: string) => void

  /** When true and rows is empty, the grid shows a loading overlay */
  loading: boolean

  /**
   * Optional callback fired when the user scrolls to the bottom of the grid body.
   * Use this to trigger fetching the next page of quarantined rows (cursor pagination).
   */
  onBodyScrollEnd?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * QuarantineAgGridTable
 *
 * Wraps AG Grid Community's AgGridReact for the quarantine editor.
 * This component is self-contained and does not depend on any virtual scroll
 * infrastructure — AG Grid handles row virtualization internally.
 */
export function QuarantineAgGridTable({
  rows,
  columns,
  editableColumns,
  getCellValue,
  isCellEdited,
  onCellEdit,
  loading,
  onBodyScrollEnd,
}: QuarantineAgGridTableProps) {
  // ─── Column Definitions ────────────────────────────────────────────────────

  const columnDefs = useMemo<ColDef<QuarantineRow>[]>(() => {
    return columns.map((col) => {
      // row_id is always pinned to the left and non-editable
      if (col === 'row_id') {
        return {
          field: col,
          headerName: 'Row ID',
          editable: false,
          pinned: 'left' as const,
          width: 80,
          suppressMovable: true,
          resizable: false,
          valueGetter: (params) => {
            if (!params.data) return ''
            return getCellValue(String(params.data.row_id), col, params.data)
          },
        } satisfies ColDef<QuarantineRow>
      }

      const isEditable = editableColumns.includes(col)

      return {
        field: col,
        headerName: col,
        editable: isEditable,
        resizable: true,
        minWidth: 100,
        flex: 1,
        valueGetter: (params) => {
          if (!params.data) return ''
          return getCellValue(String(params.data.row_id), col, params.data)
        },
        cellClassRules: isEditable
          ? {
              'ag-cell-edited': (params) => {
                if (!params.data) return false
                return isCellEdited(String(params.data.row_id), col)
              },
            }
          : undefined,
      } satisfies ColDef<QuarantineRow>
    })
  }, [columns, editableColumns, getCellValue, isCellEdited])

  // ─── Default Column Definition ─────────────────────────────────────────────

  const defaultColDef = useMemo<ColDef<QuarantineRow>>(
    () => ({
      resizable: true,
      sortable: false,
      filter: false,
      minWidth: 80,
    }),
    []
  )

  // ─── Stable Row Identity ───────────────────────────────────────────────────

  const getRowId = useCallback(
    (params: GetRowIdParams<QuarantineRow>) => String(params.data.row_id),
    []
  )

  // ─── Cell Edit Handler ─────────────────────────────────────────────────────

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<QuarantineRow>) => {
      const rowId = String(event.data.row_id)
      const field = event.colDef.field
      const newValue = String(event.newValue ?? '')
      if (field && field !== 'row_id') {
        onCellEdit(rowId, field, newValue)
      }
    },
    [onCellEdit]
  )

  // ─── Infinite Scroll Handler ───────────────────────────────────────────────

  const handleBodyScrollEnd = useCallback(
    (_event: BodyScrollEndEvent) => {
      onBodyScrollEnd?.()
    },
    [onBodyScrollEnd]
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    /*
     * .quarantine-ag-grid: scoping class for CSS variable overrides
     *   defined in quarantine-ag-grid-theme.css
     * flex-1 min-h-0: standard flex overflow pattern — parent must use
     *   display:flex + flex-direction:column for the grid to fill available height
     */
    <div className="quarantine-ag-grid flex-1 min-h-0" style={{ width: '100%', height: '100%' }}>
      <AgGridReact<QuarantineRow>
        // Module registration — use modules prop (not global ModuleRegistry)
        // to avoid SSR conflicts and multi-grid issues
        modules={[AllCommunityModule]}
        // Modern themeQuartz — no legacy CSS imports needed
        theme={themeQuartz}
        // Data
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        // Loading overlay: show only when loading and no rows are present yet
        loading={loading && rows.length === 0}
        // Cell editing
        onCellValueChanged={handleCellValueChanged}
        // Infinite scroll trigger
        onBodyScrollEnd={handleBodyScrollEnd}
        // Keyboard navigation: AG Grid provides arrow key nav and Enter-to-edit
        // out of the box when editable columns are configured.
        // No additional enterNavigatesVertically needed for basic use.
        enterNavigatesVerticallyAfterEdit={true}
        // Suppress the default context menu (prevent browser conflict)
        suppressContextMenu={true}
        // Ensure grid fills its container
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
