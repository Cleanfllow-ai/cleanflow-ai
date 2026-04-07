import { useState, useCallback, useMemo } from 'react'
import type { QuarantineFilters, ColumnFilter } from '@/modules/files/types'

export interface ActiveFilterChip {
  column: string
  type: 'violation' | 'value'
  label: string
}

export function useQuarantineFilters() {
  const [filters, setFilters] = useState<QuarantineFilters>({ columns: {} })

  const setColumnFilter = useCallback((column: string, filter: ColumnFilter) => {
    setFilters((prev) => {
      const next = { ...prev, columns: { ...prev.columns } }
      if (
        (!filter.violations || filter.violations.length === 0) &&
        (!filter.values || filter.values.length === 0)
      ) {
        delete next.columns[column]
      } else {
        next.columns[column] = filter
      }
      return next
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({ columns: {} })
  }, [])

  const removeFilter = useCallback((column: string, type: 'violation' | 'value', label: string) => {
    setFilters((prev) => {
      const next = { ...prev, columns: { ...prev.columns } }
      const existing = next.columns[column]
      if (!existing) return prev

      if (type === 'violation') {
        const violations = (existing.violations || []).filter((v) => v !== label)
        next.columns[column] = { ...existing, violations }
      } else {
        const values = (existing.values || []).filter((v) => v !== label)
        next.columns[column] = { ...existing, values }
      }

      const updated = next.columns[column]
      if (
        (!updated.violations || updated.violations.length === 0) &&
        (!updated.values || updated.values.length === 0)
      ) {
        delete next.columns[column]
      }

      return next
    })
  }, [])

  const hasActiveFilters = useMemo(() => Object.keys(filters.columns).length > 0, [filters])

  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = []
    for (const [column, filter] of Object.entries(filters.columns)) {
      for (const v of filter.violations || []) {
        chips.push({ column, type: 'violation', label: v })
      }
      for (const v of filter.values || []) {
        chips.push({ column, type: 'value', label: v })
      }
    }
    return chips
  }, [filters])

  return {
    filters,
    setColumnFilter,
    clearAllFilters,
    removeFilter,
    hasActiveFilters,
    activeChips,
  }
}
