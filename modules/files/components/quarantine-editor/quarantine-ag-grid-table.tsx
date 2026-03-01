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
 * - AI fix suggestion button (✨) per quarantined cell via AiSuggestCellRenderer
 *
 * Designed to be wired into the quarantine editor dialog in Plan 02.
 * AG Grid handles row virtualization internally — no external virtual scroll needed.
 */

import { useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type CellValueChangedEvent,
  type BodyScrollEndEvent,
  type GridApi,
} from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types/quarantine.types'
import { AiSuggestCellRenderer } from './quarantine-ai-suggest-cell'
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
   * Returns true if the given cell has a pending (unsaved) edit.
   * Used to apply the .ag-cell-edited CSS class for visual indicators.
   */
  isCellEdited: (rowId: string, column: string) => boolean
  /**
   * Returns true if the given cell was edited and successfully saved this session.
   * Used to apply the .ag-cell-saved CSS class for visual indicators.
   */
  isCellSaved?: (rowId: string, column: string) => boolean
  /**
   * Fires when a user commits an edit to a cell (including AI suggestion accepts).
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

  /**
   * Upload ID of the file being edited.
   * Passed through to AiSuggestCellRenderer for the suggest-fix API call.
   */
  uploadId: string

  /**
   * JWT auth token.
   * Passed through to AiSuggestCellRenderer for the suggest-fix API call.
   */
  authToken: string | null
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
  isCellEdited,
  isCellSaved,
  onCellEdit,
  loading,
  onBodyScrollEnd,
  uploadId,
  authToken,
}: QuarantineAgGridTableProps) {
  // ─── AG Grid API ref ───────────────────────────────────────────────────────
  const gridApiRef = useRef<GridApi<QuarantineRow> | null>(null)

  // ─── Stable onCellEdit ref ─────────────────────────────────────────────────
  // Use a ref so that AiSuggestCellRenderer always calls the latest onCellEdit
  // without needing to be remounted when the callback identity changes.

  const onCellEditRef = useRef(onCellEdit)
  useLayoutEffect(() => {
    onCellEditRef.current = onCellEdit
  }, [onCellEdit])

  const stableOnAccept = useCallback(
    (rowId: string, col: string, val: string) => {
      onCellEditRef.current(rowId, col, val)
      // Use applyTransaction to directly update AG Grid's internal row store.
      // This is necessary because AG Grid's React integration does not reliably
      // re-render cell renderers when rowData changes immutably — the React prop
      // update cycle and AG Grid's internal reconciliation are not synchronised.
      // applyTransaction is the documented programmatic update path and fires
      // cell refresh immediately without relying on React's render cycle.
      if (gridApiRef.current) {
        const node = gridApiRef.current.getRowNode(rowId)
        if (node?.data) {
          // Also flip {col}_dq_status to 'edited' so the cell class rules
          // see the updated status synchronously (node.data is read before
          // React's rows.updateRow setState has a chance to re-render).
          gridApiRef.current.applyTransaction({
            update: [{ ...node.data, [col]: val, [`${col}_dq_status`]: 'edited' }],
          })
        }
      }
    },
    [] // intentionally empty — uses refs
  )

  // ─── Refresh cell classes after edits commit ──────────────────────────────
  // isCellEdited gets a new reference every time editsMap changes. Running
  // refreshCells here — after React has committed the new state and columnDefs
  // carry the updated cellClassRules closures — ensures ag-cell-edited and
  // ag-cell-saved classes are applied/removed on the correct cells.
  useEffect(() => {
    gridApiRef.current?.refreshCells({ force: true })
  }, [isCellEdited])

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
        // AI suggest button on editable quarantined cells
        ...(isEditable && {
          cellRenderer: AiSuggestCellRenderer,
          cellRendererParams: {
            uploadId,
            authToken,
            onAccept: stableOnAccept,
          },
        }),
        cellClassRules: {
          ...(isEditable
            ? {
                'ag-cell-edited': (params) => {
                  if (!params.data) return false
                  return isCellEdited(String(params.data.row_id), col)
                },
                'ag-cell-saved': (params) => {
                  if (!params.data) return false
                  // In-session: cell was saved this session via the edits hook
                  if (isCellSaved && isCellSaved(String(params.data.row_id), col)) return true
                  // Persistent: on reload the patch includes {col}_dq_status='edited'
                  // so the row comes back from the backend already flipped — show green
                  // without requiring any in-memory state.
                  return String(params.data[`${col}_dq_status`] ?? '').toLowerCase() === 'edited'
                },
              }
            : {}),
          'ag-cell-quarantined': (params) => {
            if (!params.data) return false
            const statusValue = col.endsWith('_dq_status')
              ? params.data[col]
              : params.data[`${col}_dq_status`]
            return String(statusValue ?? '').toLowerCase() === 'quarantined'
          },
        },
      } satisfies ColDef<QuarantineRow>
    })
  }, [columns, editableColumns, isCellEdited, isCellSaved, uploadId, authToken, stableOnAccept])

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
    <div className="quarantine-ag-grid" style={{ width: '100%', height: '100%' }}>
      <AgGridReact<QuarantineRow>
        // Module registration — use modules prop (not global ModuleRegistry)
        // to avoid SSR conflicts and multi-grid issues
        modules={[AllCommunityModule]}
        // Modern themeQuartz — no legacy CSS imports needed
        theme={themeQuartz}
        onGridReady={(params) => { gridApiRef.current = params.api }}
        // Data
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        // Loading overlay: show only when loading and no rows are present yet
        loading={loading && rows.length === 0}
        // Cell editing — double-click (or Enter/F2) to start editing.
        // singleClickEdit is intentionally OFF: editable columns use AiSuggestCellRenderer
        // which embeds interactive buttons. With singleClickEdit=true, a click anywhere on
        // the cell — including the ✨ wand button — would unmount the renderer and mount the
        // text editor, making the AI suggestion popover impossible to open.
        onCellValueChanged={handleCellValueChanged}
        // Infinite scroll trigger
        onBodyScrollEnd={handleBodyScrollEnd}
        // Keyboard navigation
        enterNavigatesVerticallyAfterEdit={true}
        // Suppress the default context menu (prevent browser conflict)
        suppressContextMenu={true}
      />
    </div>
  )
}
