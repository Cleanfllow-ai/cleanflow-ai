'use client'

import { X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { getRuleLabel, getRuleDescription } from '@/shared/lib/dq-rules'
import type { ActiveFilterChip } from '@/modules/files/hooks/use-quarantine-filters'

interface QuarantineFilterBarProps {
  chips: ActiveFilterChip[]
  onRemoveFilter: (column: string, type: 'violation' | 'value', label: string) => void
  onClearAll: () => void
}

export function QuarantineFilterBar({ chips, onRemoveFilter, onClearAll }: QuarantineFilterBarProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 border-b px-4 py-1.5 bg-slate-50">
      <Filter className="h-3.5 w-3.5 text-slate-400" />
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            // Violation chips were rendering the raw R-code label after
            // `replace(/_/g, ' ')`. Now we map through getRuleLabel and put
            // the long description in a hover tooltip — same UX as every
            // other DQ surface.
            const isViolation = chip.type === 'violation'
            const shown = isViolation
              ? getRuleLabel(chip.label)
              : chip.label
            const tipText = isViolation
              ? getRuleDescription(chip.label) || shown
              : shown
            return (
              <Tooltip key={`${chip.column}:${chip.type}:${chip.label}`}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    data-rule-id={isViolation ? chip.label : undefined}
                    data-testid="filter-chip"
                    className="gap-1 text-xs font-normal cursor-help"
                  >
                    <span className="font-medium">{chip.column}:</span>
                    <span>{shown}</span>
                    <button
                      className="ml-0.5 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFilter(chip.column, chip.type, chip.label)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs" data-testid="filter-chip-tooltip">
                  {tipText}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
      <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  )
}
