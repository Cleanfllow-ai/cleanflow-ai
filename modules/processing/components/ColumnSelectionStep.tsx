"use client"

import React, { useState } from "react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, Upload, CheckSquare, Square, ArrowRight } from "lucide-react"
import { useProcessingWizard } from "./WizardContext"

export function ColumnSelectionStep() {
    const {
        allColumns,
        selectedColumns,
        setSelectedColumns,
        toggleColumn,
        fileName,
        nextStep,
    } = useProcessingWizard()

    const [search, setSearch] = useState("")

    const filteredColumns = allColumns.filter((col) =>
        col.toLowerCase().includes(search.toLowerCase())
    )

    const selectAll = () => setSelectedColumns([...allColumns])
    const deselectAll = () => setSelectedColumns([])

    const handleUploadSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const text = await file.text()
            // Support CSV or JSON format
            let columns: string[] = []
            if (file.name.endsWith(".json")) {
                const data = JSON.parse(text)
                columns = Array.isArray(data) ? data : data.columns || []
            } else {
                // CSV - first line is columns
                columns = text.split("\n")[0].split(",").map((c) => c.trim().replace(/"/g, ""))
            }
            // Filter to only columns that exist
            const validColumns = columns.filter((c) => allColumns.includes(c))
            setSelectedColumns(validColumns)
        } catch (err) {
            console.error("Failed to parse selection file:", err)
        }
    }

    const canProceed = selectedColumns.length > 0

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold">Select Columns to Process</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Choose which columns from <span className="font-medium text-foreground">{fileName}</span> should be processed.
                </p>
            </div>

            {/* Actions bar */}
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={selectAll}>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                    <Square className="w-4 h-4 mr-2" />
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

            {/* Column grid */}
            <div className="border border-muted rounded-lg max-h-[45vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 p-2">
                    {filteredColumns.map((col) => {
                        const isSelected = selectedColumns.includes(col)
                        return (
                            <div
                                key={col}
                                onClick={() => toggleColumn(col)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                                    isSelected
                                        ? "bg-primary/10 border border-primary/30"
                                        : "hover:bg-muted/50 border border-transparent"
                                )}
                            >
                                <Checkbox checked={isSelected} />
                                <span className="text-sm font-medium truncate">{col}</span>
                            </div>
                        )
                    })}
                </div>
                {filteredColumns.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        No columns match your search.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-muted/40">
                <div className="text-sm text-muted-foreground">
                    Selected: <span className="font-medium text-foreground">{selectedColumns.length}</span> of {allColumns.length} columns
                </div>
                <Button onClick={nextStep} disabled={!canProceed}>
                    Next: Profile Columns
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    )
}
