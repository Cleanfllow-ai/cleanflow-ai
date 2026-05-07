/**
 * quarantine-find-replace-panel.tsx
 *
 * Floating overlay panel for Find & Replace in the quarantine editor.
 * Anchored to top-right of the grid area.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ChevronUp, ChevronDown, Search, Replace, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface QuarantineFindReplacePanelProps {
  searchTerm: string
  replaceTerm: string
  column: string | null
  matchCase: boolean
  totalMatches: number
  currentIndex: number
  /** Legacy field; cursor-mode v2 always sets this false. */
  truncated: boolean
  loading: boolean
  columns: string[]
  /** True when Find has a `next_cursor` and more matches are paginatable. */
  hasMoreMatches?: boolean
  /** Row ids whose matches are on locked rows (informational badge). */
  lockedRowIds?: string[]

  onSearchTermChange: (value: string) => void
  onReplaceTermChange: (value: string) => void
  onColumnChange: (column: string | null) => void
  onMatchCaseChange: (matchCase: boolean) => void
  onNext: () => void
  onPrevious: () => void
  onReplaceCurrent: () => void
  /** Returns `{ replaced, skipped }` after the chained server call. */
  onReplaceAll: () => Promise<{ replaced: number; skipped: number } | number>
  onClose: () => void
}

export function QuarantineFindReplacePanel({
  searchTerm,
  replaceTerm,
  column,
  matchCase,
  totalMatches,
  currentIndex,
  truncated,
  loading,
  columns,
  hasMoreMatches,
  lockedRowIds,
  onSearchTermChange,
  onReplaceTermChange,
  onColumnChange,
  onMatchCaseChange,
  onNext,
  onPrevious,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
}: QuarantineFindReplacePanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [replaceAllCount, setReplaceAllCount] = useState<number | null>(null)
  const [skippedCount, setSkippedCount] = useState<number>(0)
  const [replacing, setReplacing] = useState(false)

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Clear replace count after 3 seconds
  useEffect(() => {
    if (replaceAllCount === null) return
    const timer = setTimeout(() => setReplaceAllCount(null), 3000)
    return () => clearTimeout(timer)
  }, [replaceAllCount])

  const handleReplaceAll = async () => {
    setReplacing(true)
    try {
      const result = await onReplaceAll()
      if (typeof result === 'number') {
        setReplaceAllCount(result)
        setSkippedCount(0)
      } else {
        setReplaceAllCount(result.replaced)
        setSkippedCount(result.skipped || 0)
      }
    } finally {
      setReplacing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        onPrevious()
      } else {
        onNext()
      }
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const editableColumns = columns.filter((c) => c !== 'row_id')

  return (
    <div
      className="absolute top-2 right-4 z-50 w-80 rounded-lg border border-border bg-card shadow-lg"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">Find and Replace</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-muted text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Find input */}
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Find..."
            className="h-7 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onPrevious} disabled={totalMatches === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onNext} disabled={totalMatches === 0}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Replace input */}
        <div className="flex items-center gap-1.5">
          <Replace className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={replaceTerm}
            onChange={(e) => onReplaceTermChange(e.target.value)}
            placeholder="Replace with..."
            className="h-7 text-xs flex-1"
          />
        </div>

        {/* Options row */}
        <div className="flex items-center gap-3">
          {/* Scope */}
          <Select
            value={column || '__all__'}
            onValueChange={(v) => onColumnChange(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue placeholder="All columns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All columns</SelectItem>
              {editableColumns.map((col) => (
                <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Match case */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={matchCase}
              onCheckedChange={(checked) => onMatchCaseChange(checked === true)}
              className="h-3.5 w-3.5"
            />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Match case</span>
          </label>
        </div>

        {/* Match count */}
        <div className="flex items-center justify-between text-[11px]">
          {loading ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </span>
          ) : searchTerm.trim() ? (
            <span className="text-muted-foreground">
              {totalMatches === 0 ? (
                'No matches'
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {currentIndex >= 0 ? currentIndex + 1 : 0}
                  </span>
                  {' of '}
                  <span className="font-medium text-foreground">
                    {totalMatches.toLocaleString()}
                  </span>
                  {hasMoreMatches ? '+ matches' : ' matches'}
                  {(lockedRowIds?.length ?? 0) > 0 && (
                    <span className="ml-1 text-amber-600">
                      ({lockedRowIds!.length} locked)
                    </span>
                  )}
                </>
              )}
            </span>
          ) : (
            <span />
          )}

          {replaceAllCount !== null && (
            <span className="text-emerald-600 font-medium">
              Replaced {replaceAllCount.toLocaleString()}
              {skippedCount > 0 && (
                <span className="ml-1 text-amber-600">
                  · {skippedCount.toLocaleString()} skipped (locked)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={totalMatches === 0 || currentIndex < 0 || !replaceTerm}
            onClick={onReplaceCurrent}
          >
            Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={totalMatches === 0 || !replaceTerm || replacing}
            onClick={handleReplaceAll}
          >
            {replacing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            Replace All
          </Button>
        </div>
      </div>
    </div>
  )
}
