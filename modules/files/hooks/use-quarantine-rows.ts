import { useState, useCallback } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import { toastFromQuarantineError } from '@/lib/error-toast-jsx'
import { queryQuarantinedRows } from '@/modules/files/api'
import type { QuarantineRow, QuarantineEditorConfig, QuarantineFilters } from '@/modules/files/types'

interface RowsState {
  rows: QuarantineRow[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
}

export function useQuarantineRows(config: QuarantineEditorConfig) {
  const { toast } = useToast()
  const [state, setState] = useState<RowsState>({
    rows: [],
    cursor: null,
    hasMore: true,
    loading: false,
  })

  const fetchNext = useCallback(
    async (
      uploadId: string,
      authToken: string,
      sessionId?: string,
      baseUploadId?: string,
      nextCursor?: string | null,
      filters?: QuarantineFilters
    ) => {
      if (state.loading) return
      if (!state.hasMore && nextCursor === undefined) return

      setState((prev) => ({ ...prev, loading: true }))

      try {
        const response = await queryQuarantinedRows(uploadId, authToken, {
          version: baseUploadId,
          session_id: sessionId,
          cursor: nextCursor !== undefined ? nextCursor || undefined : state.cursor || undefined,
          limit: config.pageSize,
          filters,
        })

        setState((prev) => {
          const newRows = [...prev.rows, ...(response.rows || [])]
          const trimmedRows = newRows.length > config.maxRowsInMemory
            ? newRows.slice(newRows.length - config.maxRowsInMemory)
            : newRows

          return {
            rows: trimmedRows,
            cursor: response.next_cursor ?? null,
            hasMore: Boolean(response.next_cursor),
            loading: false,
          }
        })
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false }))
        toast(toastFromQuarantineError(error, { action: 'load quarantined rows' }))
        throw error
      }
    },
    [state.loading, state.hasMore, state.cursor, config.pageSize, config.maxRowsInMemory, toast]
  )

  const initialize = useCallback(
    async (uploadId: string, authToken: string, sessionId: string, baseUploadId: string) => {
      setState({ rows: [], cursor: null, hasMore: true, loading: true })

      try {
        const response = await queryQuarantinedRows(uploadId, authToken, {
          version: baseUploadId,
          session_id: sessionId,
          limit: config.pageSize,
        })

        setState({
          rows: response.rows || [],
          cursor: response.next_cursor ?? null,
          hasMore: Boolean(response.next_cursor),
          loading: false,
        })
      } catch (error) {
        setState({ rows: [], cursor: null, hasMore: false, loading: false })
        toast(toastFromQuarantineError(error, { action: 'load quarantined rows' }))
        throw error
      }
    },
    [config.pageSize, toast]
  )

  const setRows = useCallback((rows: QuarantineRow[]) => {
    setState({ rows, cursor: null, hasMore: false, loading: false })
  }, [])

  const updateRow = useCallback((rowId: string, updates: Record<string, unknown>) => {
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        String(row.row_id) === rowId ? { ...row, ...updates } : row
      ),
    }))
  }, [])

  const mergeRows = useCallback((newRows: QuarantineRow[]) => {
    if (!newRows.length) return
    setState((prev) => {
      const existingIds = new Set(prev.rows.map((r) => String(r.row_id)))
      const toAdd = newRows.filter((r) => !existingIds.has(String(r.row_id)))
      if (!toAdd.length) return prev
      return { ...prev, rows: [...prev.rows, ...toAdd] }
    })
  }, [])

  const reset = useCallback(() => {
    setState({ rows: [], cursor: null, hasMore: true, loading: false })
  }, [])

  return {
    ...state,
    fetchNext,
    initialize,
    setRows,
    mergeRows,
    updateRow,
    reset,
  }
}
