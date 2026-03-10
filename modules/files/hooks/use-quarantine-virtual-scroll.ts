/**
 * use-quarantine-virtual-scroll.ts
 *
 * Hook for virtual scrolling in quarantine editor
 * Optimizes rendering by only showing visible rows
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import type { QuarantineRow, QuarantineEditorConfig } from '@/modules/files/types'

interface VirtualScrollState {
  scrollTop: number
}

/**
 * Hook for virtual scrolling
 * Calculates visible rows based on scroll position and viewport height
 *
 * @param rows - All rows
 * @param config - Configuration object
 * @returns Virtual scroll state and utilities
 */
export function useQuarantineVirtualScroll(
  rows: QuarantineRow[],
  config: QuarantineEditorConfig
) {
  const [state, setState] = useState<VirtualScrollState>({ scrollTop: 0 })
  const parentRef = useRef<HTMLDivElement | null>(null)

  /**
   * Calculate viewport dimensions
   */
  const viewportHeight = useMemo(() => {
    return parentRef.current?.clientHeight || 600
  }, [parentRef.current?.clientHeight])

  /**
   * Calculate visible row range
   */
  const visibleRange = useMemo(() => {
    const visibleStart = Math.max(
      0,
      Math.floor(state.scrollTop / config.rowHeight) - config.overscan
    )
    const visibleEnd = Math.min(
      rows.length,
      Math.ceil((state.scrollTop + viewportHeight) / config.rowHeight) + config.overscan
    )

    return { visibleStart, visibleEnd }
  }, [state.scrollTop, config.rowHeight, config.overscan, viewportHeight, rows.length])

  /**
   * Get virtual rows (only visible portion)
   */
  const virtualRows = useMemo(() => {
    return rows.slice(visibleRange.visibleStart, visibleRange.visibleEnd)
  }, [rows, visibleRange.visibleStart, visibleRange.visibleEnd])

  /**
   * Handle scroll event
   */
  const handleScroll = useCallback(() => {
    if (parentRef.current) {
      setState({ scrollTop: parentRef.current.scrollTop })
    }
  }, [])

  /**
   * Scroll horizontally (for wide tables)
   * @param delta - Scroll amount in pixels
   */
  const scrollHorizontally = useCallback((delta: number) => {
    if (parentRef.current) {
      parentRef.current.scrollBy({ left: delta, behavior: 'smooth' })
    }
  }, [])

  /**
   * Check if should fetch more data (near bottom)
   * @param threshold - Pixels from bottom to trigger fetch
   */
  const shouldFetchMore = useCallback(
    (threshold: number = 260): boolean => {
      if (!parentRef.current) return false

      const { scrollTop, scrollHeight, clientHeight } = parentRef.current
      const remaining = scrollHeight - scrollTop - clientHeight

      return remaining < threshold
    },
    []
  )

  /**
   * Reset scroll position
   */
  const resetScroll = useCallback(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0
    }
    setState({ scrollTop: 0 })
  }, [])

  /**
   * Total content height (for virtual scrolling container)
   */
  const totalHeight = rows.length * config.rowHeight + config.headerHeight

  return {
    parentRef,
    scrollTop: state.scrollTop,
    virtualRows,
    visibleStart: visibleRange.visibleStart,
    visibleEnd: visibleRange.visibleEnd,
    totalHeight,
    handleScroll,
    scrollHorizontally,
    shouldFetchMore,
    resetScroll,
  }
}
