'use client'

import { X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ActiveFilterChip } from '@/modules/files/hooks/use-quarantine-filters'

interface QuarantineFilterBarProps {
  chips: ActiveFilterChip[]
  onRemoveFilter: (column: string, type: 'violation' | 'value', label: string) => void
  onClearAll: () => void
}

export function QuarantineFilterBar({ chips, onRemoveFilter, onClearAll }: QuarantineFilterBarProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 border-b px-4 py-1.5 bg-slate-100">
      <Filter className="h-3.5 w-3.5 text-slate-400" />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Badge
            key={`${chip.column}:${chip.type}:${chip.label}`}
            variant="secondary"
            className="gap-1 text-xs font-normal"
          >
            <span className="font-medium">{chip.column}:</span>
            <span>{chip.type === 'violation' ? chip.label.replace(/_/g, ' ') : chip.label}</span>
            <button
              className="ml-0.5 hover:text-destructive"
              onClick={() => onRemoveFilter(chip.column, chip.type, chip.label)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  )
}
