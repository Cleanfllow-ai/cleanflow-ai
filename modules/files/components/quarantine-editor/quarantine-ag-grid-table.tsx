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
  type CellStyle,
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
import { getRuleLabel } from '@/shared/lib/dq-rules'

interface QuarantineAgGridTableProps {
  columns: string[]
  editableColumns: string[]
  totalRows: number
  fetchRows: (startRow: number, endRow: number) => Promise<{ rows: QuarantineRow[]; lastRow: number }>
  getCellValue: (rowId: string, column: string, row: Record<string, any>) => any
  isCellEdited: (rowId: string, column: string) => boolean
  isCellSaved: (rowId: string, column: string) => boolean
  onCellEdit: (rowId: string, column: string, value: string, oldValue?: string) => void
  loading: boolean
  uploadId: string
  reloadToken: number
  filterComponent?: (column: string) => React.ReactNode
  findMatches?: Array<{ row_id: string; column: string; index?: number }>
  currentMatch?: { row_id: string; column: string; index?: number } | null
  cellLocksRef?: React.MutableRefObject<Map<string, CellLockInfo>>
  /** Lock-hole #1 fix: cells the server has confirmed our ownership via
   *  cellLockGranted. editable predicate treats these as "mine" even if
   *  cellLocksRef doesn't yet reflect our own lock (we set peer locks, not
   *  our own, in cellLocksRef). */
  myGrantedCellsRef?: React.MutableRefObject<Set<string>>
  /** Cells for which we sent cellFocus but haven't yet received the server
   *  ack (cellLockGranted or cellLockDenied). Predicate allows editing
   *  optimistically, relying on server to reject if we lost the race. */
  pendingLockCellsRef?: React.MutableRefObject<Set<string>>
  onCellEditingStarted?: (column: string, rowId: string) => void
  onCellEditingStopped?: (column: string, rowId: string) => void
  onGridApiReady?: (api: GridApi<QuarantineRow>) => void
  /** Click handler invoked when the user clicks the lock badge on a
   *  row that has `is_locked: true`. Only wired for super-admins;
   *  members see the badge but no click target. */
  onUnlockRowClick?: (rowId: string) => void
  /** True when the caller has permission to unlock pushed rows. Drives
   *  whether the lock badge is interactive. */
  canUnlock?: boolean
  /** B4 (2026-05-16): list of column names introduced by augmentation
   *  presets / custom augmentation rules before DQ ran.  When present,
   *  the grid violet-tints these columns and prefixes the header with
   *  a "✨" so users can tell augmented columns apart from upload columns.
   *  Sourced from FileStatusResponse.augmented_columns (BE-persisted in
   *  start_dq_processing.py). */
  augmentedColumns?: string[]
  /** Bug 21 (Bulk Fix UI): when provided, renders a leftmost checkbox
   *  column for multi-row selection.  Selection state is owned by the
   *  parent so it survives AG Grid infinite-row-model block eviction.
   *  selectedRowIds: live Set the grid reads from on each cell render.
   *  setSelectedRowIds: called with a producer-style updater so the parent
   *  can swap-in / out individual row_ids without re-creating the Set on
   *  every selection change (perf for 500+ rows). */
  selectedRowIds?: Set<string>
  onToggleRowSelected?: (rowId: string, selected: boolean) => void
  onToggleSelectAllVisible?: (rowIds: string[], selectAll: boolean) => void
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

  // Replace any inline raw rule code (R1..R99 / CUST_xxx) with a friendly
  // label. The BE often emits "R33: invalid email" — we want "Invalid Email
  // / Phone: invalid email" so the user reads English, not a code book.
  // CROSS:/INTRA: prefixes are kept as-is for now (they encode a rule key +
  // condition; the dq-engine renderer presents them in business terms in
  // dq_violations directly).
  const humanizeInlineCode = (s: string): string => {
    return s.replace(/\bR\d{1,3}\b/g, (m) => getRuleLabel(m))
      .replace(/\bCUST_\w+/g, () => "Custom Rule")
  }

  const lines: string[] = []
  if (violations.length > 0) {
    lines.push(...violations.map(humanizeInlineCode))
  }
  if (cellStatus === 'fixed') {
    if (fixes.length > 0) {
      lines.push(...fixes.map(humanizeInlineCode))
    } else if (violations.length === 0) {
      lines.push('Auto-fixed by DQ engine')
    }
  }

  // Fallback: if extraction found nothing but cell is flagged, show the
  // raw row-level violation string (may lack column prefix in older data)
  if (lines.length === 0) {
    const raw = String(row?.dq_violations ?? '').trim()
    if (raw) {
      lines.push(humanizeInlineCode(raw))
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
  myGrantedCellsRef,
  pendingLockCellsRef,
  onCellEditingStarted: onCellEditStart,
  onCellEditingStopped: onCellEditStop,
  onGridApiReady,
  onUnlockRowClick,
  canUnlock = false,
  augmentedColumns,
  selectedRowIds,
  onToggleRowSelected,
  onToggleSelectAllVisible,
}: QuarantineAgGridTableProps) {
  // B4 (2026-05-16): pre-build a Set for O(1) membership checks inside the
  // cellClass closure (called once per cell render — every scroll tick).
  const augmentedColumnsSet = useMemo(
    () => new Set(augmentedColumns ?? []),
    [augmentedColumns],
  )

  // Bug 21 (Bulk Fix UI): expose selectedRowIds via a ref so the column
  // cellRenderer reads live state without forcing columnDefs to re-build
  // every time a checkbox toggles (which would blow the AG Grid block cache
  // and cause a 89-row re-render on every click).  The checkbox-column
  // cellRenderer pulls from selectedRowIdsRef.current on each render call
  // and we just refreshCells() to repaint.
  const selectedRowIdsRef = useRef<Set<string>>(selectedRowIds ?? new Set())
  selectedRowIdsRef.current = selectedRowIds ?? new Set()
  const onToggleRowSelectedRef = useRef(onToggleRowSelected)
  const onToggleSelectAllVisibleRef = useRef(onToggleSelectAllVisible)
  onToggleRowSelectedRef.current = onToggleRowSelected
  onToggleSelectAllVisibleRef.current = onToggleSelectAllVisible
  const showSelectColumn = !!onToggleRowSelected
  // Bump-counter only changes when the consumer wants the header checkbox
  // / cell checkboxes to repaint after a selection change.  We use a derived
  // value (selectedRowIds.size) as the trigger.
  const selectedSize = selectedRowIds?.size ?? 0
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
    const defs: ColDef<QuarantineRow>[] = []

    // Bug 21 (Bulk Fix UI): leftmost checkbox column.  Custom cellRenderer
    // (no AG Grid native selection) because we own the selection state in
    // the parent — native selection is wiped when the infinite-row-model
    // evicts blocks, which is the common case on 89+ row uploads.
    if (showSelectColumn) {
      defs.push({
        field: '__bulk_select__',
        headerName: '',
        maxWidth: 44,
        minWidth: 44,
        width: 44,
        pinned: 'left',
        sortable: false,
        editable: false,
        suppressMovable: true,
        suppressNavigable: true,
        // Header: select-all-visible checkbox.
        headerComponent: () => {
          const api = apiRef.current
          // Collect currently rendered row_ids.  Infinite model: only
          // displayed (loaded) nodes count — "visible" = "in the viewport
          // block cache".  Avoids selecting un-fetched rows.
          const collectVisibleRowIds = (): string[] => {
            if (!api) return []
            const ids: string[] = []
            api.forEachNode((node) => {
              const rid = String(node?.data?.row_id ?? '')
              if (rid) ids.push(rid)
            })
            return ids
          }
          const visibleIds = collectVisibleRowIds()
          const allSelected =
            visibleIds.length > 0 &&
            visibleIds.every((id) => selectedRowIdsRef.current.has(id))
          return (
            <span className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                aria-label="Select all visible rows"
                data-testid="bulk-checkbox-select-all"
                checked={allSelected}
                onChange={(e) => {
                  const next = collectVisibleRowIds()
                  onToggleSelectAllVisibleRef.current?.(next, e.target.checked)
                }}
                className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
              />
            </span>
          )
        },
        cellRenderer: (params: any) => {
          const rowId = String(params.data?.row_id ?? '')
          if (!rowId) return null
          const checked = selectedRowIdsRef.current.has(rowId)
          return (
            <span className="flex h-full items-center justify-center">
              <input
                type="checkbox"
                aria-label={`Select row ${rowId}`}
                data-testid={`bulk-checkbox-row-${rowId}`}
                checked={checked}
                onChange={(e) => {
                  onToggleRowSelectedRef.current?.(rowId, e.target.checked)
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
              />
            </span>
          )
        },
        valueGetter: () => '',
        cellClass: 'p-0',
      })
    }

    columns.forEach((column) => {
      if (column === 'row_id') {
        defs.push({
          cellClass: 'font-medium text-slate-400',
          editable: false,
          field: column,
          headerName: 'Row',
          maxWidth: 140,
          minWidth: 110,
          pinned: 'left',
          sortable: false,
          suppressMovable: true,
          valueGetter: (params) => {
            if (!params.data) return ''
            return getCellValueRef.current(String(params.data.row_id), column, params.data)
          },
          // Custom cellRenderer so locked rows show a 🔒 badge.
          // Click on the badge (super-admin only) calls onUnlockRowClick.
          cellRenderer: (params: any) => {
            const rowId = String(params.data?.row_id ?? '')
            const isLocked = !!params.data?.is_locked
            return (
              <span className="flex items-center gap-1.5">
                <span className="font-mono">{params.valueFormatted ?? params.value ?? ''}</span>
                {isLocked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (canUnlock && rowId) onUnlockRowClick?.(rowId)
                    }}
                    title={
                      canUnlock
                        ? 'Row pushed to destination — click to unlock (super-admin only)'
                        : 'Row pushed to destination — read-only'
                    }
                    className={
                      'inline-flex h-4 w-4 items-center justify-center rounded text-[10px] ' +
                      (canUnlock
                        ? 'cursor-pointer text-amber-600 hover:bg-amber-100'
                        : 'cursor-default text-amber-500')
                    }
                  >
                    {/* lock glyph (lucide-style) */}
                    🔒
                  </button>
                )}
              </span>
            )
          },
          valueFormatter: (params: ValueFormatterParams<QuarantineRow>) => formatCellValue(params.value),
          width: 124,
        })
        return
      }

      defs.push({
        editable: (params) => {
          if (!editableColumnSet.has(column)) return false
          const rowId = String(params.data?.row_id ?? '')
          if (!rowId) return false
          // Hard lock: the row was pushed to a destination — read-only
          // until super-admin unlocks (FE source of truth: `is_locked`
          // attached by the QueryQuarantineRowsUseCase).
          if (params.data?.is_locked) return false
          const cellKey = `${column}:${rowId}`
          const lockInfo = cellLocksRefInternal.current.get(cellKey)
          // Lock-hole #1 fix: lockInfo represents PEER locks (cellLocked
          // broadcasts). If WE hold this cell — confirmed by cellLockGranted
          // OR still pending — we must return true despite lockInfo being
          // absent from the map (our own locks don't appear there).
          // The server enforces the winner at cellUpdate time; this predicate
          // only controls whether AG Grid starts the inline editor.
          const isMineGranted = myGrantedCellsRef?.current.has(cellKey) ?? false
          const isMePending = pendingLockCellsRef?.current.has(cellKey) ?? false
          if (lockInfo) {
            // Someone else holds this cell — only editable if it's us.
            return isMineGranted || isMePending
          }
          // No lock info: editable. We may be in the race window (between
          // our cellFocus and the cellLocked broadcast from the server), but
          // the server rejects the cellUpdate if we don't own the lock.
          return true
        },
        field: column,
        flex: 1,
        minWidth: 180,
        sortable: false,
        // B4 (2026-05-16): augmented columns get a violet bar on the
        // left edge of each cell so they're visually distinct from upload
        // columns.  The class is appended ALONGSIDE the existing DQ status
        // classes; it doesn't replace cell highlighting for issues.
        headerComponent: filterComponent
          ? () => (
              <div className="flex items-center">
                {augmentedColumnsSet.has(column) && (
                  <span
                    className="text-violet-500 mr-1"
                    title="Augmented column (created by an augmentation rule before DQ)"
                    aria-hidden="true"
                  >
                    ✨
                  </span>
                )}
                <span>{column}</span>
                {filterComponent(column)}
              </div>
            )
          : augmentedColumnsSet.has(column)
          ? () => (
              <div className="flex items-center">
                <span
                  className="text-violet-500 mr-1"
                  title="Augmented column (created by an augmentation rule before DQ)"
                  aria-hidden="true"
                >
                  ✨
                </span>
                <span>{column}</span>
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
        cellClass: (params) => {
          const classes = getCellStatusClass(
            params,
            isCellEditedRef.current,
            isCellSavedRef.current,
            findMatchSetRef.current,
            currentMatchKeyRef.current,
            cellLocksRefInternal.current,
          )
          // B4 (2026-05-16): violet tint + left-border on augmented columns.
          if (augmentedColumnsSet.has(column)) {
            classes.push('bg-violet-50/40', 'border-l-2', 'border-violet-300')
          }
          return classes
        },
        cellStyle: (params): CellStyle | undefined => {
          const field = params.colDef.field
          const rowId = String(params.data?.row_id ?? '')
          if (!field || field === 'row_id' || !rowId) return undefined
          const lockInfo = cellLocksRefInternal.current.get(`${field}:${rowId}`)
          if (lockInfo) {
            return { '--lock-color': lockInfo.color } as CellStyle
          }
          return undefined
        },
      })
    })

    return defs
  }, [columns, editableColumnSet, filterComponent, canUnlock, onUnlockRowClick, augmentedColumnsSet, showSelectColumn])

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

  // Bug 21: repaint the checkbox column + header when selection changes.
  // We scope the refresh to the bulk-select column only so the rest of the
  // grid doesn't re-render unnecessarily (perf for 500+ selected rows).
  useEffect(() => {
    if (!showSelectColumn) return
    const api = apiRef.current
    if (!api) return
    api.refreshCells({ force: true, columns: ['__bulk_select__'] })
    api.refreshHeader()
  }, [selectedSize, showSelectColumn])

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
    // ── Undo fix (2026-05-15) ──────────────────────────────────────────
    // AG-Grid's CellValueChangedEvent carries the pre-edit oldValue. We
    // forward it to the editor so the per-cell undo history can revert
    // to the ORIGINAL value instead of writing '' (the previous code
    // looked up the old value in editsMap, which was empty for first-time
    // edits, falling through to `?? ''` and blanking the cell on Undo).
    const oldValue = formatCellValue(event.oldValue)
    if (event.data) {
      event.data[field] = nextValue
    }
    onCellEditRef.current(rowId, field, nextValue, oldValue)
  }, [])

  return (
    <div ref={wrapperRef} className="quarantine-ag-grid h-full w-full bg-white dark:bg-[#111318]">
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
