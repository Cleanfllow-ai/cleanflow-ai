"use client"

import React from "react"
import { cn } from "@/shared/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export type DqStatus = "clean" | "fixed" | "quarantined"

interface ColorCodedCellProps {
    value: any
    status?: DqStatus
    originalValue?: any
    error?: string
    ruleId?: string
    className?: string
}

const STATUS_STYLES: Record<DqStatus, string> = {
    clean: "bg-green-500/10 text-green-400 border-green-500/20",
    fixed: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    quarantined: "bg-red-500/10 text-red-400 border-red-500/20",
}

const STATUS_INDICATORS: Record<DqStatus, string> = {
    clean: "🟢",
    fixed: "🟡",
    quarantined: "🔴",
}

export function ColorCodedCell({
    value,
    status = "clean",
    originalValue,
    error,
    ruleId,
    className,
}: ColorCodedCellProps) {
    const displayValue = value === null || value === undefined || value === "" ? "—" : String(value)
    const hasTooltip = status !== "clean" && (originalValue !== undefined || error)

    const cellContent = (
        <div
            className={cn(
                "px-2 py-1 rounded text-sm border transition-colors",
                STATUS_STYLES[status],
                className
            )}
        >
            {displayValue}
        </div>
    )

    if (!hasTooltip) {
        return cellContent
    }

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                <TooltipContent
                    side="top"
                    className="max-w-xs bg-zinc-900 border-zinc-700 text-white"
                >
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                            <span>{STATUS_INDICATORS[status]}</span>
                            <span className="font-medium capitalize">{status}</span>
                            {ruleId && (
                                <span className="text-muted-foreground">({ruleId})</span>
                            )}
                        </div>
                        {status === "fixed" && originalValue !== undefined && (
                            <div>
                                <span className="text-muted-foreground">Original: </span>
                                <span className="line-through text-red-400">
                                    {String(originalValue)}
                                </span>
                                <span className="text-muted-foreground"> → </span>
                                <span className="text-green-400">{displayValue}</span>
                            </div>
                        )}
                        {status === "quarantined" && error && (
                            <div className="text-red-400">{error}</div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// Table row with color-coded cells
interface ColorCodedRowProps {
    row: Record<string, any>
    columns: string[]
    dqMetadata?: {
        dq_status?: DqStatus
        dq_changes?: Record<string, { original: any; rule_id: string }>
        dq_errors?: Record<string, string>
    }
}

export function ColorCodedRow({ row, columns, dqMetadata }: ColorCodedRowProps) {
    const rowStatus = dqMetadata?.dq_status || "clean"
    const changes = dqMetadata?.dq_changes || {}
    const errors = dqMetadata?.dq_errors || {}

    return (
        <tr className="border-b border-muted/40 hover:bg-muted/10">
            {columns.map((col) => {
                // Determine cell-level status
                let cellStatus: DqStatus = "clean"
                let originalValue: any
                let error: string | undefined
                let ruleId: string | undefined

                if (changes[col]) {
                    cellStatus = "fixed"
                    originalValue = changes[col].original
                    ruleId = changes[col].rule_id
                } else if (errors[col]) {
                    cellStatus = "quarantined"
                    error = errors[col]
                }

                return (
                    <td key={col} className="px-3 py-2">
                        <ColorCodedCell
                            value={row[col]}
                            status={cellStatus}
                            originalValue={originalValue}
                            error={error}
                            ruleId={ruleId}
                        />
                    </td>
                )
            })}
        </tr>
    )
}

// Full preview table with color coding
interface ColorCodedTableProps {
    headers: string[]
    rows: Record<string, any>[]
    className?: string
}

export function ColorCodedTable({ headers, rows, className }: ColorCodedTableProps) {
    // Filter out internal DQ columns from display
    const displayHeaders = headers.filter(
        (h) => !h.startsWith("dq_") && !h.startsWith("__")
    )

    return (
        <div className={cn("overflow-x-auto", className)}>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-muted bg-muted/30">
                        {displayHeaders.map((header) => (
                            <th
                                key={header}
                                className="px-3 py-2 text-left font-medium text-muted-foreground"
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        // Extract DQ metadata from row
                        const dqMetadata = {
                            dq_status: row.dq_status as DqStatus,
                            dq_changes: row.dq_changes,
                            dq_errors: row.dq_errors,
                        }

                        return (
                            <ColorCodedRow
                                key={idx}
                                row={row}
                                columns={displayHeaders}
                                dqMetadata={dqMetadata}
                            />
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default ColorCodedCell
