'use client'

import { useState, useEffect } from 'react'
import { Filter } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getColumnValues } from '@/modules/files/api/file-quarantine-api'
import type { ColumnFilter } from '@/modules/files/types'

interface QuarantineColumnFilterProps {
  column: string
  uploadId: string
  authToken: string | null
  currentFilter?: ColumnFilter
  onFilterChange: (column: string, filter: ColumnFilter) => void
}

export function QuarantineColumnFilter({
  column,
  uploadId,
  authToken,
  currentFilter,
  onFilterChange,
}: QuarantineColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<string[]>([])
  const [violations, setViolations] = useState<string[]>([])
  const [valuesLoading, setValuesLoading] = useState(false)
  const [valueSearch, setValueSearch] = useState('')

  const selectedViolations = currentFilter?.violations || []
  const selectedValues = currentFilter?.values || []
  const hasFilter = selectedViolations.length > 0 || selectedValues.length > 0

  // Fetch distinct values and violations for this column
  useEffect(() => {
    if (!open || !authToken) return
    setValuesLoading(true)
    getColumnValues(uploadId, authToken, { column, search: valueSearch || undefined, limit: 200 })
      .then((resp) => {
        setValues(resp.values)
        if (resp.violations) setViolations(resp.violations)
      })
      .catch(() => {
        setValues([])
        setViolations([])
      })
      .finally(() => setValuesLoading(false))
  }, [open, column, uploadId, authToken, valueSearch])

  const toggleViolation = (v: string) => {
    const next = selectedViolations.includes(v)
      ? selectedViolations.filter((x) => x !== v)
      : [...selectedViolations, v]
    onFilterChange(column, { violations: next, values: selectedValues })
  }

  const toggleValue = (v: string) => {
    const next = selectedValues.includes(v)
      ? selectedValues.filter((x) => x !== v)
      : [...selectedValues, v]
    onFilterChange(column, { violations: selectedViolations, values: next })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="ml-1 inline-flex items-center opacity-50 hover:opacity-100">
          <Filter className={`h-3 w-3 ${hasFilter ? 'text-blue-600 opacity-100' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Tabs defaultValue="violations" className="w-full">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="violations" className="flex-1 text-xs">DQ Status</TabsTrigger>
            <TabsTrigger value="values" className="flex-1 text-xs">Values</TabsTrigger>
          </TabsList>
          <TabsContent value="violations" className="max-h-48 overflow-y-auto p-2">
            {valuesLoading ? (
              <p className="text-xs text-muted-foreground py-2">Loading...</p>
            ) : violations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No violations found for this column</p>
            ) : (
              violations.map((v) => (
                <label key={v} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                  <Checkbox
                    checked={selectedViolations.includes(v)}
                    onCheckedChange={() => toggleViolation(v)}
                  />
                  {v}
                </label>
              ))
            )}
          </TabsContent>
          <TabsContent value="values" className="p-2">
            <Input
              placeholder="Search values..."
              value={valueSearch}
              onChange={(e) => setValueSearch(e.target.value)}
              className="mb-2 h-7 text-xs"
            />
            <div className="max-h-40 overflow-y-auto">
              {valuesLoading ? (
                <p className="text-xs text-muted-foreground py-2">Loading...</p>
              ) : values.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No values found</p>
              ) : (
                values.map((v) => (
                  <label key={v} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                    <Checkbox
                      checked={selectedValues.includes(v)}
                      onCheckedChange={() => toggleValue(v)}
                    />
                    {v || '(empty)'}
                  </label>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
        {hasFilter && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onFilterChange(column, {})}
            >
              Clear filter
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
