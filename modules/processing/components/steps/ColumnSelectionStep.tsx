"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Upload, CheckSquare, Square, ArrowRight } from "lucide-react"
import { cn }
  from "@/shared/lib/utils"
import { useProcessingWizard } from "../WizardContext"

export function ColumnSelectionStep() {
  const { allColumns, selectedColumns, setSelectedColumns, fileName, nextStep } = useProcessingWizard()
  const [search, setSearch] = useState("")
  const [savedState, setSavedState] = useState<string[]>([])
  const [isAllSelected, setIsAllSelected] = useState(false)

  // Initialize saved state when component mounts
  useEffect(() => {
    setSavedState([...selectedColumns])
    // Check if all columns are already selected on mount
    if (selectedColumns.length === allColumns.length) {
      setIsAllSelected(true)
    }
  }, []) // Only run once on mount

  const filtered = allColumns.filter((c) => c.toLowerCase().includes(search.toLowerCase()))

  const handleSelectAll = () => {
    if (isAllSelected) {
      // If already all selected, restore the saved state
      setSelectedColumns([...savedState])
      setIsAllSelected(false)
    } else {
      // Save current state before selecting all
      setSavedState([...selectedColumns])
      setSelectedColumns([...allColumns])
      setIsAllSelected(true)
    }
  }

  const handleDeselectAll = () => {
    setSelectedColumns([])
    setIsAllSelected(false)
    setSavedState([]) // Clear saved state when deselecting all
  }

  const toggle = (col: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(col)) {
        return prev.filter((c) => c !== col)
      }
      return [...prev, col]
    })
    // Reset the "all selected" state when manually toggling
    setIsAllSelected(false)
  }

  const handleUploadSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      let columns: string[] = []
      if (file.name.endsWith(".json")) {
        const data = JSON.parse(text)
        columns = Array.isArray(data) ? data : data.columns || []
      } else {
        columns = text.split("\n")[0].split(",").map((c) => c.trim().replace(/"/g, ""))
      }
      const valid = columns.filter((c) => allColumns.includes(c))
      setSelectedColumns(valid)
      setIsAllSelected(false)
    } catch (err) {
      console.error("Failed to parse selection file:", err)
    }
  }

  const canProceed = selectedColumns.length > 0
  const allSelected = selectedColumns.length === allColumns.length

  return (
    <div className="flex flex-col h-full p-6">
      <div>
        <h2 className="text-xl font-semibold">Select Columns to Process</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which columns from <span className="font-medium text-foreground">{fileName || "file"}</span> should be processed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleSelectAll}>
          {allSelected ? (
            <CheckSquare className="w-4 h-4 mr-2 text-primary" />
          ) : (
            <Square className="w-4 h-4 mr-2 text-muted-foreground" />
          )}
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={handleDeselectAll}>
          {selectedColumns.length === 0 ? (
            <CheckSquare className="w-4 h-4 mr-2 text-primary" />
          ) : (
            <Square className="w-4 h-4 mr-2 text-muted-foreground" />
          )}
          Deselect All
        </Button>
        <div className="relative">
          <Input
            type="file"
            accept=".csv,.json"
            onChange={handleUploadSelection}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload Selection
          </Button>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      <div className="border border-muted rounded-lg flex-1 overflow-y-auto mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 p-2">
          {filtered.map((col) => {
            const isSelected = selectedColumns.includes(col)
            return (
              <div
                key={col}
                onClick={() => toggle(col)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                  isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                )}
              >
                <Checkbox checked={isSelected} />
                <span className="text-sm font-medium truncate">{col}</span>
              </div>
            )
          })}
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No columns match your search.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-muted/40 mt-6">
        <div className="text-sm text-muted-foreground">
          Selected: <span className="font-medium text-foreground">{selectedColumns.length}</span> of {allColumns.length} columns
        </div>
        <Button onClick={nextStep} disabled={!canProceed}>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
