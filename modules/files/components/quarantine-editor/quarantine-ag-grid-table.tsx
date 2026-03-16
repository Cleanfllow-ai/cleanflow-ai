'use client'

/**
 * quarantine-ag-grid-table.tsx
 *
 * AG Grid Community wrapper for the quarantine editor.
 * Uses the Infinite Row Model for memory-efficient handling of large datasets.
 *
 * Features:
 * - Infinite scroll with block-based caching (200 rows/block, 10 blocks max)
 * - Resizable columns via drag
 * - Frozen/pinned headers during vertical scroll (AG Grid default)
 * - Arrow key navigation and Enter-to-edit on cells
 */

import { useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type CellValueChangedEvent,
  type GridApi,
  type IDatasource,
  type IGetRowsParams,
} from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types/quarantine.types'
import './quarantine-ag-grid-theme.css'

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuarantineAgGridTableProps {
  /** Ordered list of column names derived from the quarantine manifest */
  columns: string[]
  /** Subset of columns that are editable by the user */
  editableColumns: string[]
  /** Total number of rows (from manifest) — used to size scrollbar */
  totalRows: number

  /**
   * Datasource fetch function — called by AG Grid when it needs a block of rows.
   * Must return { rows, lastRow } where lastRow is the total row count (or -1 if unknown).
   */
  fetchRows: (startRow: number, endRow: number) => Promise<{ rows: QuarantineRow[]; lastRow: number }>

  /**
   * Returns true if the given cell has a pending (unsaved) edit.
   */
  isCellEdited: (rowId: string, column: string) => boolean
  /**
   * Returns true if the given cell was edited and successfully saved this session.
   */
  isCellSaved?: (rowId: string, column: string) => boolean
  /**
   * Fires when a user commits an edit to a cell.
   */
  onCellEdit: (rowId: string, column: string, value: string) => void

  /** When true and no rows loaded yet, the grid shows a loading overlay */
  loading: boolean

  /** Upload ID of the file being edited */
  uploadId: string
  /** Bump to force the infinite cache to refetch from row 0 */
  reloadToken: number

}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuarantineAgGridTable({
  columns,
  editableColumns,
  totalRows,
  fetchRows,
  isCellEdited,
  isCellSaved,
  onCellEdit,
  loading,
  uploadId,
  reloadToken,
}: QuarantineAgGridTableProps) {
  // ─── AG Grid API ref ───────────────────────────────────────────────────────
  const gridApiRef = useRef<GridApi<QuarantineRow> | null>(null)

  // ─── Stable onCellEdit ref ─────────────────────────────────────────────────
  const onCellEditRef = useRef(onCellEdit)
  useLayoutEffect(() => {
    onCellEditRef.current = onCellEdit
  }, [onCellEdit])

  // ─── Stable fetchRows ref ─────────────────────────────────────────────────
  const fetchRowsRef = useRef(fetchRows)
  useLayoutEffect(() => {
    fetchRowsRef.current = fetchRows
  }, [fetchRows])

  const stableOnAccept = useCallback(
    (rowId: string, col: string, val: string) => {
      onCellEditRef.current(rowId, col, val)
      if (gridApiRef.current) {
        const node = gridApiRef.current.getRowNode(rowId)
        if (node?.data) {
          node.setData({ ...node.data, [col]: val, [`${col}_dq_status`]: 'edited' })
        }
      }
    },
    []
  )

  // ─── Refresh cell classes after edits commit ──────────────────────────────
  useEffect(() => {
    gridApiRef.current?.refreshCells({ force: true })
  }, [isCellEdited])

  // ─── Infinite Row Model Datasource ────────────────────────────────────────
  const datasource = useMemo<IDatasource>(() => ({
    getRows: async (params: IGetRowsParams) => {
      try {
        const { rows, lastRow } = await fetchRowsRef.current(params.startRow, params.endRow)
        params.successCallback(rows, lastRow)
      } catch (error) {
        console.error('[QuarantineGrid] Failed to fetch rows:', error)
        params.failCallback()
      }
    },
  }), [])

  // ─── Reset datasource when fetchRows changes (e.g. new file/session) ──────
  const prevCacheKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const api = gridApiRef.current
    if (!api) return

    const nextCacheKey = `${uploadId}:${reloadToken}:${totalRows}`
    if (nextCacheKey !== prevCacheKeyRef.current) {
      prevCacheKeyRef.current = nextCacheKey
      api.setGridOption('datasource', datasource)
      api.purgeInfiniteCache()
    }
  }, [uploadId, reloadToken, totalRows, datasource])

  // ─── Column Definitions ────────────────────────────────────────────────────

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
        tooltipValueGetter: (params) => {
          if (!params.data) return null
          const statusValue = String(params.data[`${col}_dq_status`] ?? '').toLowerCase()
          if (!statusValue || statusValue === 'clean') return null

          const colLower = col.toLowerCase()

          // Check violations for quarantined cells
          const violations = String((params.data as any).dq_violations ?? '')
          if (violations) {
            const tokens = violations.split(';').map((t: string) => t.trim()).filter((t: string) => {
              const lower = t.toLowerCase()
              return (
                lower.includes(`(${colLower})`) ||
                lower.startsWith(`${colLower}:`) ||
                lower.includes(` ${colLower}:`)
              )
            })
            if (tokens.length > 0) return `${statusValue.toUpperCase()}: ${tokens.join('; ')}`
          }

          // Check fixes_applied for fixed cells
          if (statusValue === 'fixed') {
            const fixes = String((params.data as any).fixes_applied ?? '')
            if (fixes) {
              const fixTokens = fixes.split(';').map((t: string) => t.trim()).filter((t: string) => {
                const lower = t.toLowerCase()
                return (
                  lower.includes(`(${colLower})`) ||
                  lower.startsWith(`${colLower}:`) ||
                  lower.includes(` ${colLower}:`)
                )
              })
              if (fixTokens.length > 0) return `FIXED: ${fixTokens.join('; ')}`
            }
            return 'Auto-fixed by DQ engine'
          }

          return `Status: ${statusValue}`
        },
        cellClassRules: {
          ...(isEditable
            ? {
                'ag-cell-edited': (params) => {
                  if (!params.data) return false
                  return isCellEdited(String(params.data.row_id), col)
                },
                'ag-cell-saved': (params) => {
                  if (!params.data) return false
                  if (isCellSaved && isCellSaved(String(params.data.row_id), col)) return true
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
          'ag-cell-fixed': (params) => {
            if (!params.data) return false
            const statusValue = String(params.data[`${col}_dq_status`] ?? '').toLowerCase()
            return statusValue === 'fixed'
          },
          'ag-cell-clean': (params) => {
            if (!params.data) return false
            const statusValue = String(params.data[`${col}_dq_status`] ?? '').toLowerCase()
            return statusValue === 'clean'
          },
        },
      } satisfies ColDef<QuarantineRow>
    })
  }, [columns, editableColumns, isCellEdited, isCellSaved])

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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="quarantine-ag-grid" style={{ width: '100%', height: '100%' }}>
      <AgGridReact<QuarantineRow>
        modules={[AllCommunityModule]}
        theme={themeQuartz}
        onGridReady={(params) => {
          gridApiRef.current = params.api
          prevCacheKeyRef.current = `${uploadId}:${reloadToken}:${totalRows}`
          params.api.setGridOption('datasource', datasource)
        }}
        // Infinite Row Model for large dataset support
        rowModelType="infinite"
        datasource={datasource}
        // Block cache: 200 rows per block, keep 10 blocks in memory (2000 rows max)
        cacheBlockSize={200}
        maxBlocksInCache={10}
        cacheOverflowSize={2}
        maxConcurrentDatasourceRequests={1}
        infiniteInitialRowCount={Math.min(Math.max(totalRows, 1), 200)}
        // Column config
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        // Loading overlay
        loading={loading && totalRows === 0}
        // Cell editing
        onCellValueChanged={handleCellValueChanged}
        // Keyboard navigation
        enterNavigatesVerticallyAfterEdit={true}
        // Tooltips
        tooltipShowDelay={300}
        tooltipHideDelay={3000}
        // Misc
        suppressContextMenu={true}
        suppressFieldDotNotation={true}
      />
    </div>
  )
}
