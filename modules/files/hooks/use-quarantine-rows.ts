/**
 * use-quarantine-rows.ts
 *
 * Hook for managing quarantined rows data
 * Handles pagination, cursor-based loading, and row trimming for memory management
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/shared/hooks/use-toast'
import { queryQuarantinedRows } from '@/modules/files/api'
import type { QuarantineRow, QuarantineEditorConfig } from '@/modules/files/types'

interface RowsState {
  rows: QuarantineRow[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
}

/**
 * Hook for quarantine rows management
 * Handles cursor-based pagination and memory-efficient row loading
 *
 * @param config - Configuration object
 * @returns Rows state and fetch functions
 */
export function useQuarantineRows(config: QuarantineEditorConfig) {
  const { toast } = useToast()
  const [state, setState] = useState<RowsState>({
    rows: [],
    cursor: null,
    hasMore: true,
    loading: false,
  })

  /**
   * Fetch next page of rows
   * @param uploadId - File upload ID
   * @param authToken - JWT token
   * @param sessionId - Active session ID
   * @param baseUploadId - Base version upload ID
   * @param nextCursor - Optional cursor override
   */
  const fetchNext = useCallback(
    async (
      uploadId: string,
      authToken: string,
      sessionId?: string,
      baseUploadId?: string,
      nextCursor?: string | null
    ) => {
      // Prevent concurrent fetches
      if (state.loading) return

      // No more data to fetch
      if (!state.hasMore && nextCursor === undefined) return

      setState((prev) => ({ ...prev, loading: true }))

      try {
        const response = await queryQuarantinedRows(uploadId, authToken, {
          version: baseUploadId,
          session_id: sessionId,
          cursor: nextCursor !== undefined ? nextCursor || undefined : state.cursor || undefined,
          limit: config.pageSize,
        })

        setState((prev) => {
          const newRows = [...prev.rows, ...(response.rows || [])]

          // Trim old rows if exceeding memory limit
          let trimmedRows = newRows
          if (trimmedRows.length > config.maxRowsInMemory) {
            const trimCount = trimmedRows.length - config.maxRowsInMemory
            trimmedRows = trimmedRows.slice(trimCount)

            // Note: In a production app, you might want to adjust scrollTop
            // here to prevent jarring jumps. This is handled in the
            // virtual scroll hook.
          }

          return {
            rows: trimmedRows,
            cursor: response.next_cursor ?? null,
            hasMore: Boolean(response.next_cursor),
            loading: false,
          }
        })
      } catch (error: any) {
        setState((prev) => ({ ...prev, loading: false }))
        toast({
          title: 'Failed to load quarantined rows',
          description: error?.message || 'Unknown error',
          variant: 'destructive',
        })
        throw error
      }
    },
    [state.loading, state.hasMore, state.cursor, config.pageSize, config.maxRowsInMemory, toast]
  )

  /**
   * Initialize with first page
   * @param uploadId - File upload ID
   * @param authToken - JWT token
   * @param sessionId - Session ID
   * @param baseUploadId - Base version upload ID
   */
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
      } catch (error: any) {
        setState({ rows: [], cursor: null, hasMore: false, loading: false })
        toast({
          title: 'Failed to load quarantined rows',
          description: error?.message || 'Unknown error',
          variant: 'destructive',
        })
        throw error
      }
    },
    [config.pageSize, toast]
  )

  /**
   * Set rows directly (for compatibility mode)
   * @param rows - Rows to set
   */
  const setRows = useCallback((rows: QuarantineRow[]) => {
    setState({ rows, cursor: null, hasMore: false, loading: false })
  }, [])

  /**
   * Update a single row (optimistic update)
   * @param rowId - Row ID to update
   * @param updates - Partial row updates
   */
  const updateRow = useCallback((rowId: string, updates: Record<string, any>) => {
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        String(row.row_id) === rowId ? { ...row, ...updates } : row
      ),
    }))
  }, [])

  /**
   * Reset rows state
   */
  const reset = useCallback(() => {
    setState({ rows: [], cursor: null, hasMore: true, loading: false })
  }, [])

  return {
    ...state,
    fetchNext,
    initialize,
    setRows,
    updateRow,
    reset,
  }
}
