'use client'

/**
 * quarantine-ag-grid-table.tsx
 *
 * AG Grid Community wrapper for the quarantine editor.
 * Uses AG Grid's Infinite Row Model for server-side paginated loading —
 * rows are fetched on demand as the user scrolls, keeping memory bounded
 * regardless of how many quarantined rows exist.
 */

import { useMemo, useCallback, useRef, useEffect, type MutableRefObject } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type CellValueChangedEvent,
  type IDatasource,
  type IGetRowsParams,
  type GridReadyEvent,
} from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types/quarantine.types'
import './quarantine-ag-grid-theme.css'

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuarantineAgGridTableProps {
  /** Ordered list of column names derived from the quarantine manifest */
  columns: string[]
  /** Subset of columns that are editable by the user */
  editableColumns: string[]
  /** Total quarantined row count (for AG Grid row model hint) */
  totalRows: number
  /**
   * Datasource callback — AG Grid calls this to load each block of rows.
   * Returns the rows for [startRow, endRow) and the total row count (or -1 if unknown).
   */
  fetchRows: (startRow: number, endRow: number) => Promise<{ rows: QuarantineRow[]; lastRow: number }>
  /**
   * Returns the display value for a cell, overlaying any pending (unsaved) edits
   * over the raw server value.
   */
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any
  /** Returns true if the cell has a pending (unsaved) edit — shown as yellow highlight */
  isCellEdited: (rowId: string, column: string) => boolean
  /** Returns true if the cell has a saved edit — shown as green highlight */
  isCellSaved: (rowId: string, column: string) => boolean
  /** Fires when the user commits an edit to a cell */
  onCellEdit: (rowId: string, column: string, value: string) => void
  /** When true and no rows are loaded yet, show the loading overlay */
  loading: boolean
  /** File upload ID (passed through for keying) */
  uploadId: string
  /** Increments on data refresh — triggers AG Grid to re-fetch all blocks */
  reloadToken: number
}

// Number of rows fetched per AG Grid block (must match server page size)
const BLOCK_SIZE = 100

// ─── Component ────────────────────────────────────────────────────────────────

export function QuarantineAgGridTable({
  columns,
  editableColumns,
  totalRows,
  fetchRows,
  getCellValue,
  isCellEdited,
  isCellSaved,
  onCellEdit,
  loading,
  reloadToken,
}: QuarantineAgGridTableProps) {
  const gridRef = useRef<AgGridReact<QuarantineRow>>(null)

  // ─── Stable Refs for AG Grid Callbacks ───────────────────────────────────────
  // AG Grid's Infinite Row Model caches valueGetter/cellClassRules closures from
  // columnDefs. When markAsSaved() updates state, AG Grid may not process the new
  // columnDefs before refreshCells fires, causing stale closures to read empty
  // editsMap/savedEditsMap. Refs ensure valueGetters always read the latest state.
  const getCellValueRef = useRef(getCellValue)
  getCellValueRef.current = getCellValue
  const isCellEditedRef = useRef(isCellEdited)
  isCellEditedRef.current = isCellEdited
  const isCellSavedRef = useRef(isCellSaved)
  isCellSavedRef.current = isCellSaved

  // ─── Column Definitions ──────────────────────────────────────────────────────

  const columnDefs = useMemo<ColDef<QuarantineRow>[]>(() => {
    return columns.map((col) => {
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
            return getCellValueRef.current(String(params.data.row_id), col, params.data)
          },
        } satisfies ColDef<QuarantineRow>
      }

      const isEditable = editableColumns.includes(col)
      const colLower = col.toLowerCase()

      return {
        field: col,
        headerName: col,
        editable: isEditable,
        resizable: true,
        minWidth: 100,
        flex: 1,
        valueGetter: (params) => {
          if (!params.data) return ''
          return getCellValueRef.current(String(params.data.row_id), col, params.data)
        },
        cellClassRules: {
          // DQ status — driven by {col}_dq_status field on the row
          'ag-cell-quarantined': (params) =>
            params.data
              ? String(params.data[`${col}_dq_status`] || '').toLowerCase() === 'quarantined'
              : false,
          'ag-cell-fixed': (params) =>
            params.data
              ? String(params.data[`${col}_dq_status`] || '').toLowerCase() === 'fixed'
              : false,
          'ag-cell-clean': (params) =>
            params.data
              ? String(params.data[`${col}_dq_status`] || '').toLowerCase() === 'clean'
              : false,
          // Edit status — only for editable columns; CSS cascade overrides DQ colors
          'ag-cell-edited': (params) =>
            isEditable && params.data ? isCellEditedRef.current(String(params.data.row_id), col) : false,
          'ag-cell-saved': (params) =>
            isEditable && params.data ? isCellSavedRef.current(String(params.data.row_id), col) : false,
        },
        tooltipValueGetter: (params) => {
          if (!params.data) return null
          const cellStatus = String(params.data[`${col}_dq_status`] || '').toLowerCase()
          if (!cellStatus || cellStatus === 'clean') return null

          // Filter dq_violations to only those mentioning this column
          const violationsRaw = String(params.data.dq_violations || '')
          const colViolations = violationsRaw
            .split(';')
            .map((t) => t.trim())
            .filter((t) => {
              if (!t) return false
              const lower = t.toLowerCase()
              return (
                lower.includes(`(${colLower})`) ||
                lower.startsWith(`${colLower}:`) ||
                lower.startsWith(`${colLower} :`) ||
                lower.startsWith(`${colLower}=`) ||
                lower.includes(` ${colLower}:`) ||
                lower.includes(` ${colLower} `)
              )
            })

          const lines: string[] = [`Status: ${cellStatus}`]
          if (colViolations.length > 0) {
            lines.push(`Issues: ${colViolations.join('; ')}`)
          }
          if (cellStatus === 'fixed') {
            const fixesRaw = String(params.data.fixes_applied || '')
            const colFixes = fixesRaw
              .split(';')
              .map((t) => t.trim())
              .filter((t) => {
                if (!t) return false
                const lower = t.toLowerCase()
                return (
                  lower.includes(`(${colLower})`) ||
                  lower.startsWith(`${colLower}:`) ||
                  lower.includes(` ${colLower}:`)
                )
              })
            if (colFixes.length > 0) {
              lines.push(`Fixes: ${colFixes.join('; ')}`)
            } else {
              lines.push('Auto-fixed by DQ engine')
            }
          }
          return lines.join('\n')
        },
      } satisfies ColDef<QuarantineRow>
    })
    // columnDefs is now stable — refs handle state changes, no need to rebuild on every edit/save
  }, [columns, editableColumns])

  // ─── Default Column Definition ────────────────────────────────────────────────

  const defaultColDef = useMemo<ColDef<QuarantineRow>>(
    () => ({ resizable: true, sortable: false, filter: false, minWidth: 80 }),
    []
  )

  // ─── Stable Row Identity ──────────────────────────────────────────────────────

  const getRowId = useCallback(
    (params: GetRowIdParams<QuarantineRow>) => String(params.data.row_id),
    []
  )

  // ─── Cell Edit Handler ────────────────────────────────────────────────────────

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

  // ─── Infinite Row Model Datasource ────────────────────────────────────────────
  //
  // A new datasource object is created when fetchRows, totalRows, or reloadToken
  // changes. AG Grid detects the new reference and purges its row cache, causing
  // it to re-fetch all visible blocks — this is how data refresh works.

  const datasource = useMemo<IDatasource>(
    () => ({
      rowCount: totalRows || undefined,
      getRows: async (params: IGetRowsParams) => {
        try {
          const result = await fetchRows(params.startRow, params.endRow)
          // lastRow >= 0 means we know the total; -1 means "keep scrolling"
          const lastRow = result.lastRow >= 0 ? result.lastRow : undefined
          params.successCallback(result.rows, lastRow)
        } catch {
          params.failCallback()
        }
      },
    }),
    // reloadToken in deps forces datasource recreation after save/reprocess
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchRows, totalRows, reloadToken]
  )

  // Push updated datasource to AG Grid whenever it changes
  useEffect(() => {
    gridRef.current?.api?.setGridOption('datasource', datasource)
  }, [datasource])

  // Refresh visible cells after a save completes (editsMap → savedEditsMap).
  // AG Grid's Infinite Row Model doesn't re-call valueGetters when columnDefs
  // props change, so after markAsSaved clears editsMap and populates savedEditsMap
  // cells would otherwise keep showing stale server values.
  // Only watching isCellSaved (not getCellValue/isCellEdited) prevents firing
  // on every keystroke — the in-progress edit is reflected live by AG Grid's
  // own edit overlay and doesn't need a manual refresh.
  useEffect(() => {
    gridRef.current?.api?.refreshCells({ force: true })
  }, [isCellSaved])

  const handleGridReady = useCallback(
    (event: GridReadyEvent) => {
      event.api.setGridOption('datasource', datasource)
    },
    [datasource]
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="quarantine-ag-grid flex-1 min-h-0" style={{ width: '100%', height: '100%' }}>
      <AgGridReact<QuarantineRow>
        ref={gridRef}
        modules={[AllCommunityModule]}
        theme={themeQuartz}
        // Server-side infinite scroll — rows are fetched in BLOCK_SIZE chunks
        rowModelType="infinite"
        cacheBlockSize={BLOCK_SIZE}
        infiniteInitialRowCount={Math.min(totalRows || BLOCK_SIZE, BLOCK_SIZE)}
        maxBlocksInCache={50}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        loading={loading}
        onCellValueChanged={handleCellValueChanged}
        onGridReady={handleGridReady}
        enterNavigatesVerticallyAfterEdit={true}
        suppressContextMenu={true}
        tooltipShowDelay={400}
        tooltipHideDelay={5000}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
