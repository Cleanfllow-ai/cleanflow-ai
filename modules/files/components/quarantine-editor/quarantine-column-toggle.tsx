'use client'

import { useState } from 'react'
import { Columns3, Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface QuarantineColumnToggleProps {
  columns: string[]
  hiddenColumns: Set<string>
  onToggleColumn: (column: string) => void
  onShowAll: () => void
  onHideAll: () => void
}

export function QuarantineColumnToggle({
  columns,
  hiddenColumns,
  onToggleColumn,
  onShowAll,
  onHideAll,
}: QuarantineColumnToggleProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const dataColumns = columns.filter((c) => c !== 'row_id')
  const filtered = search
    ? dataColumns.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : dataColumns

  const visibleCount = dataColumns.filter((c) => !hiddenColumns.has(c)).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs font-medium px-3">
          <Columns3 className="w-3 h-3 mr-1.5" />
          Columns
          {hiddenColumns.size > 0 && (
            <span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">
              {visibleCount}/{dataColumns.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs pl-7"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No columns match</p>
          ) : (
            filtered.map((col) => (
              <label
                key={col}
                className="flex items-center gap-2 py-1.5 px-1 text-xs cursor-pointer rounded hover:bg-muted/50"
              >
                <Checkbox
                  checked={!hiddenColumns.has(col)}
                  onCheckedChange={() => onToggleColumn(col)}
                />
                <span className="truncate">{col}</span>
              </label>
            ))
          )}
        </div>
        <div className="border-t p-2 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-xs h-7" onClick={onShowAll}>
            Show all
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs h-7" onClick={onHideAll}>
            Hide all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
