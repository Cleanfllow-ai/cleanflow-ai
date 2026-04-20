'use client'

import './quarantine-ag-grid-theme.css'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  themeQuartz,
  type CellClassParams,
  type CellEditingStartedEvent,
  type CellEditingStoppedEvent,
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
import type { CellLockInfo } from '@/modules/files/types'

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
  filterComponent?: (column: string) => React.ReactNode
  findMatches?: Array<{ row_id: string; column: string; index?: number }>
  currentMatch?: { row_id: string; column: string; index?: number } | null
  cellLocksRef?: React.MutableRefObject<Map<string, CellLockInfo>>
  onCellEditingStarted?: (column: string, rowId: string) => void
  onCellEditingStopped?: (column: string, rowId: string) => void
  onGridApiReady?: (api: GridApi<QuarantineRow>) => void
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
  isCellSaved: (rowId: string, column: string) => boolean,
  findMatchSet: Set<string>,
  currentMatchKey: string | null,
  cellLocksMap: Map<string, CellLockInfo>,
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

  const cellKey = `${rowId}:${field}`
  if (currentMatchKey === cellKey) {
    classes.push('ag-cell-find-current')
  } else if (findMatchSet.has(cellKey)) {
    classes.push('ag-cell-find-match')
  }

  const lockKey = `${field}:${rowId}`
  const lockInfo = cellLocksMap.get(lockKey)
  if (lockInfo) {
    classes.push('ag-cell-locked')
  }

  return classes
}

function getCellTooltip(field: string, row: QuarantineRow) {
  const cellStatus = String(row?.[`${field}_dq_status`] ?? '').toLowerCase()
  if (!cellStatus || cellStatus === 'clean' || cellStatus === 'edited') {
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
      // Strip column name prefix ("colName: R33: ...") and trailing "(ColumnName)" — redundant on a per-cell tooltip
      .map((token) => {
        let cleaned = token.replace(/\s*\([^)]*\)\s*$/, '').trim()
        // Remove leading "column: " prefix if present
        const colonIdx = cleaned.indexOf(':')
        if (colonIdx > 0 && cleaned.substring(0, colonIdx).trim().toLowerCase() === fieldLower) {
          cleaned = cleaned.substring(colonIdx + 1).trim()
        }
        return cleaned
      })
      .filter(Boolean)

  const violations = extractForColumn(String(row?.dq_violations ?? ''))
  const fixes = extractForColumn(String(row?.fixes_applied ?? ''))

  const lines: string[] = []
  if (violations.length > 0) {
    lines.push(...violations)
  }
  if (cellStatus === 'fixed') {
    if (fixes.length > 0) {
      lines.push(...fixes)
    } else if (violations.length === 0) {
      lines.push('Auto-fixed by DQ engine')
    }
  }

  // Fallback: if extraction found nothing but cell is flagged, show the
  // raw row-level violation string (may lack column prefix in older data)
  if (lines.length === 0) {
    const raw = String(row?.dq_violations ?? '').trim()
    if (raw) {
      lines.push(raw)
    } else {
      lines.push(cellStatus === 'fixed' ? 'Fixed' : 'Quarantined')
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
  filterComponent,
  findMatches,
  currentMatch,
  cellLocksRef,
  onCellEditingStarted: onCellEditStart,
  onCellEditingStopped: onCellEditStop,
  onGridApiReady,
}: QuarantineAgGridTableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<GridApi<QuarantineRow> | null>(null)
  const getCellValueRef = useRef(getCellValue)
  const isCellEditedRef = useRef(isCellEdited)
  const isCellSavedRef = useRef(isCellSaved)
  const fetchRowsRef = useRef(fetchRows)
  const findMatchSetRef = useRef<Set<string>>(new Set())
  const currentMatchKeyRef = useRef<string | null>(null)
  const cellLocksRefInternal = useRef<Map<string, CellLockInfo>>(new Map())

  const onCellEditRef = useRef(onCellEdit)
  getCellValueRef.current = getCellValue
  isCellEditedRef.current = isCellEdited
  isCellSavedRef.current = isCellSaved
  fetchRowsRef.current = fetchRows
  onCellEditRef.current = onCellEdit

  useEffect(() => {
    const set = new Set<string>()
    for (const m of findMatches || []) {
      set.add(`${m.row_id}:${m.column}`)
    }
    findMatchSetRef.current = set
    currentMatchKeyRef.current = currentMatch ? `${currentMatch.row_id}:${currentMatch.column}` : null
    apiRef.current?.refreshCells({ force: true })

    // Scroll to the current match's row + focus its cell. index is the
    // row's position in the manifest's sorted quarantine list (returned
    // by the backend), which is what AG Grid's infinite row model keys by.
    if (currentMatch && typeof currentMatch.index === 'number' && apiRef.current) {
      try {
        apiRef.current.ensureIndexVisible(currentMatch.index, 'middle')
        apiRef.current.setFocusedCell(currentMatch.index, currentMatch.column)
      } catch {
        /* best-effort — ignore if grid isn't ready */
      }
    }
  }, [findMatches, currentMatch])

  useEffect(() => {
    cellLocksRefInternal.current = cellLocksRef?.current ?? new Map()
    apiRef.current?.refreshCells({ force: true })
  }, [cellLocksRef?.current])  // eslint-disable-line react-hooks/exhaustive-deps

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
        editable: (params) => {
          if (!editableColumnSet.has(column)) return false
          const rowId = String(params.data?.row_id ?? '')
          if (!rowId) return false
          const lockInfo = cellLocksRefInternal.current.get(`${column}:${rowId}`)
          return !lockInfo
        },
        field: column,
        flex: 1,
        minWidth: 180,
        sortable: false,
        headerComponent: filterComponent
          ? () => (
              <div className="flex items-center">
                <span>{column}</span>
                {filterComponent(column)}
              </div>
            )
          : undefined,
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
        cellClass: (params) => getCellStatusClass(params, isCellEditedRef.current, isCellSavedRef.current, findMatchSetRef.current, currentMatchKeyRef.current, cellLocksRefInternal.current),
        cellStyle: (params) => {
          const field = params.colDef.field
          const rowId = String(params.data?.row_id ?? '')
          if (!field || field === 'row_id' || !rowId) return undefined
          const lockInfo = cellLocksRefInternal.current.get(`${field}:${rowId}`)
          if (lockInfo) {
            return { '--lock-color': lockInfo.color } as React.CSSProperties
          }
          return undefined
        },
      }
    })
  }, [columns, editableColumnSet, filterComponent])

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
  }, [isCellEdited, isCellSaved, reloadToken])

  const handleGridReady = (event: GridReadyEvent<QuarantineRow>) => {
    apiRef.current = event.api
    event.api.sizeColumnsToFit()
    onGridApiReady?.(event.api)
  }

  const getRowId = useCallback((params: GetRowIdParams<QuarantineRow>) => {
    return String(params.data.row_id)
  }, [])

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent<QuarantineRow>) => {
    const field = event.colDef.field
    const rowId = String(event.data?.row_id ?? '')

    if (!field || field === 'row_id' || !rowId) {
      return
    }

    const nextValue = formatCellValue(event.newValue)
    if (event.data) {
      event.data[field] = nextValue
    }
    onCellEditRef.current(rowId, field, nextValue)
  }, [])

  return (
    <div ref={wrapperRef} className="quarantine-ag-grid h-full w-full bg-white">
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
        onCellEditingStarted={(event: CellEditingStartedEvent<QuarantineRow>) => {
          const field = event.colDef.field
          const rowId = String(event.data?.row_id ?? '')
          if (field && field !== 'row_id' && rowId && onCellEditStart) {
            onCellEditStart(field, rowId)
          }
        }}
        onCellEditingStopped={(event: CellEditingStoppedEvent<QuarantineRow>) => {
          const field = event.colDef.field
          const rowId = String(event.data?.row_id ?? '')
          if (field && field !== 'row_id' && rowId && onCellEditStop) {
            onCellEditStop(field, rowId)
          }
        }}
        onGridReady={handleGridReady}
        overlayLoadingTemplate='<span class="text-xs font-medium text-slate-500">Loading quarantine data...</span>'
        popupParent={wrapperRef.current ?? undefined}
        rowBuffer={2}
        rowModelType="infinite"
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        suppressCellFocus={false}
        suppressContextMenu
        tooltipHideDelay={5000}
        tooltipInteraction
        tooltipShowDelay={150}
        theme={GRID_THEME}
      />
    </div>
  )
}

export default QuarantineAgGridTable
