'use client'

import './quarantine-ag-grid-theme.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  themeQuartz,
  type CellClassParams,
  type CellValueChangedEvent,
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
  type IDatasource,
  type IGetRowsParams,
  type ValueFormatterParams,
} from 'ag-grid-community'
import type { QuarantineRow } from '@/modules/files/types'

interface QuarantineAgGridTableProps {
  columns: string[]
  editableColumns: string[]
  totalRows: number
  fetchRows: (startRow: number, endRow: number) => Promise<{ rows: QuarantineRow[]; lastRow: number }>
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any
  isCellEdited: (rowId: string, column: string) => boolean
  isCellSaved: (rowId: string, column: string) => boolean
  onCellEdit: (rowId: string, column: string, value: string) => void
  loading: boolean
  uploadId: string
  reloadToken: number
}

const GRID_THEME = themeQuartz.withParams({
  accentColor: '#2a4477',
  borderColor: '#e5e7eb',
  cellHorizontalPaddingScale: 0.85,
  columnBorder: true,
  fontFamily: {
    googleFont: 'IBM Plex Mono',
  },
  foregroundColor: '#111827',
  headerBackgroundColor: '#f9fafb',
  headerFontFamily: {
    googleFont: 'Inter',
  },
  headerFontSize: 11,
  headerTextColor: '#6b7280',
  rowBorder: true,
  rowHoverColor: '#f9fafb',
  rowVerticalPaddingScale: 0.9,
})

function formatCellValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getCellStatusClass(
  params: CellClassParams<QuarantineRow>,
  isCellEdited: (rowId: string, column: string) => boolean,
  isCellSaved: (rowId: string, column: string) => boolean
) {
  const field = params.colDef.field
  const rowId = String(params.data?.row_id ?? '')

  if (!field || field === 'row_id' || !rowId) {
    return []
  }

  const classes: string[] = []
  const dqStatus = String(params.data?.[`${field}_dq_status`] ?? '').toLowerCase()

  if (dqStatus === 'clean' || dqStatus === 'fixed' || dqStatus === 'quarantined' || dqStatus === 'edited') {
    classes.push(`ag-cell-${dqStatus}`)
  } else {
    classes.push('ag-cell-clean')
  }

  if (isCellSaved(rowId, field)) {
    classes.push('ag-cell-saved')
  }

  if (isCellEdited(rowId, field)) {
    classes.push('ag-cell-edited')
  }

  return classes
}

function getCellTooltip(field: string, row: QuarantineRow) {
  const cellStatus = String(row?.[`${field}_dq_status`] ?? '').toLowerCase()
  if (!cellStatus || cellStatus === 'clean') {
    return null
  }

  const fieldLower = field.toLowerCase()
  const extractForColumn = (raw: string) =>
    raw
      .split(';')
      .map((token) => token.trim())
      .filter((token) => {
        if (!token) return false
        const lower = token.toLowerCase()
        return (
          lower.includes(`(${fieldLower})`) ||
          lower.startsWith(`${fieldLower}:`) ||
          lower.startsWith(`${fieldLower} :`) ||
          lower.startsWith(`${fieldLower}=`) ||
          lower.includes(` ${fieldLower}:`) ||
          lower.includes(` ${fieldLower} `)
        )
      })

  const violations = extractForColumn(String(row?.dq_violations ?? ''))
  const fixes = extractForColumn(String(row?.fixes_applied ?? ''))

  const lines: string[] = [`Status: ${cellStatus}`]
  if (violations.length > 0) {
    lines.push(`Issues: ${violations.join('; ')}`)
  }
  if (cellStatus === 'fixed') {
    if (fixes.length > 0) {
      lines.push(`Fixes: ${fixes.join('; ')}`)
    } else {
      lines.push('Auto-fixed by DQ engine')
    }
  }

  return lines.join('\n')
}

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
  uploadId: _uploadId,
  reloadToken,
}: QuarantineAgGridTableProps) {
  const apiRef = useRef<GridApi<QuarantineRow> | null>(null)
  const getCellValueRef = useRef(getCellValue)
  const isCellEditedRef = useRef(isCellEdited)
  const isCellSavedRef = useRef(isCellSaved)
  const fetchRowsRef = useRef(fetchRows)

  getCellValueRef.current = getCellValue
  isCellEditedRef.current = isCellEdited
  isCellSavedRef.current = isCellSaved
  fetchRowsRef.current = fetchRows

  const editableColumnSet = useMemo(() => {
    return new Set(editableColumns.filter((column) => column !== 'row_id'))
  }, [editableColumns])

  const columnDefs = useMemo<ColDef<QuarantineRow>[]>(() => {
    return columns.map((column): ColDef<QuarantineRow> => {
      if (column === 'row_id') {
        return {
          cellClass: 'font-medium text-slate-400',
          editable: false,
          field: column,
          headerName: 'Row',
          maxWidth: 120,
          minWidth: 96,
          pinned: 'left',
          sortable: false,
          suppressMovable: true,
          valueGetter: (params) => {
            if (!params.data) return ''
            return getCellValueRef.current(String(params.data.row_id), column, params.data)
          },
          valueFormatter: (params: ValueFormatterParams<QuarantineRow>) => formatCellValue(params.value),
          width: 104,
        }
      }

      return {
        editable: editableColumnSet.has(column),
        field: column,
        flex: 1,
        minWidth: 180,
        sortable: false,
        valueSetter: (params) => {
          if (!params.data) return false
          const nextValue = formatCellValue(params.newValue)
          if (formatCellValue(params.data[column]) === nextValue) {
            return false
          }
          params.data[column] = nextValue
          return true
        },
        valueGetter: (params) => {
          if (!params.data) return ''
          return getCellValueRef.current(String(params.data.row_id), column, params.data)
        },
        tooltipValueGetter: (params) => {
          if (!params.data) return null
          return getCellTooltip(column, params.data)
        },
        valueFormatter: (params: ValueFormatterParams<QuarantineRow>) => formatCellValue(params.value),
        cellClass: (params) => getCellStatusClass(params, isCellEditedRef.current, isCellSavedRef.current),
      }
    })
  }, [columns, editableColumnSet])

  // fetchRows is accessed via ref so the datasource object stays stable across
  // cell edits and row merges. AG Grid resets scroll/cache whenever datasource
  // changes, so we only recreate on intentional reloads (reloadToken) or when
  // the total row count changes.
  const datasource = useMemo<IDatasource>(() => {
    return {
      rowCount: totalRows,
      getRows: (params: IGetRowsParams<QuarantineRow>) => {
        void fetchRowsRef.current(params.startRow, params.endRow)
          .then(({ rows, lastRow }) => {
            params.successCallback(rows, lastRow >= 0 ? lastRow : undefined)
          })
          .catch((error) => {
            console.error('[QuarantineAgGridTable] Failed to fetch rows', error)
            params.failCallback()
          })
      },
    }
  }, [totalRows, reloadToken])

  useEffect(() => {
    const api = apiRef.current
    if (!api) return

    if (loading) {
      api.showLoadingOverlay()
      return
    }

    api.hideOverlay()
  }, [loading])

  useEffect(() => {
    apiRef.current?.refreshCells({ force: true })
  }, [isCellSaved, reloadToken])

  const handleGridReady = (event: GridReadyEvent<QuarantineRow>) => {
    apiRef.current = event.api
    event.api.sizeColumnsToFit()
  }

  const getRowId = useCallback((params: GetRowIdParams<QuarantineRow>) => {
    return String(params.data.row_id)
  }, [])

  const handleCellValueChanged = (event: CellValueChangedEvent<QuarantineRow>) => {
    const field = event.colDef.field
    const rowId = String(event.data?.row_id ?? '')

    if (!field || field === 'row_id' || !rowId) {
      return
    }

    const nextValue = formatCellValue(event.newValue)
    if (event.data) {
      event.data[field] = nextValue
    }
    onCellEdit(rowId, field, nextValue)
  }

  return (
    <div className="quarantine-ag-grid h-full w-full bg-white">
      <AgGridReact<QuarantineRow>
        animateRows={false}
        blockLoadDebounceMillis={75}
        cacheBlockSize={100}
        columnDefs={columnDefs}
        datasource={datasource}
        defaultColDef={{
          editable: false,
          filter: false,
          resizable: true,
          suppressHeaderMenuButton: true,
          wrapHeaderText: false,
        }}
        domLayout="normal"
        getRowId={getRowId}
        loading={loading}
        modules={[AllCommunityModule]}
        maxBlocksInCache={8}
        onCellValueChanged={handleCellValueChanged}
        onGridReady={handleGridReady}
        overlayLoadingTemplate='<span class="text-xs font-medium text-slate-500">Loading quarantine data...</span>'
        rowBuffer={2}
        rowModelType="infinite"
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        suppressCellFocus={false}
        suppressContextMenu
        tooltipHideDelay={5000}
        tooltipShowDelay={150}
        theme={GRID_THEME}
      />
    </div>
  )
}

export default QuarantineAgGridTable
