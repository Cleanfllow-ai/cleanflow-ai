"use client"

import { useMemo } from "react"
import type { FileStatusResponse } from "@/modules/files"

interface FilesPageHeaderProps {
    files: FileStatusResponse[]
}

export function FilesPageHeader({ files }: FilesPageHeaderProps) {
    const stats = useMemo(() => {
        const visible = files.filter((f) => !f.parent_upload_id)
        const processed = visible.filter((f) => f.status === "DQ_FIXED").length
        const failed = visible.filter((f) =>
            ["DQ_FAILED", "UPLOAD_FAILED", "FAILED", "REJECTED"].includes(f.status)
        ).length
        const quarantined = visible.reduce(
            (sum, f) => sum + (f.rows_quarantined || 0),
            0
        )
        return { total: visible.length, processed, failed, quarantined }
    }, [files])

    if (stats.total === 0) {
        return (
            <div className="pb-1">
                <h1 className="text-xl font-semibold tracking-tight">Data Catalog</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Import and process your data files
                </p>
            </div>
        )
    }

    return (
        <div className="pb-1">
            <h1 className="text-xl font-semibold tracking-tight">Data Catalog</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span className="tabular-nums">
                    <span className="font-medium text-foreground">{stats.total}</span> file{stats.total !== 1 ? "s" : ""}
                </span>
                {stats.processed > 0 && (
                    <>
                        <span className="text-border">·</span>
                        <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                            <span className="font-medium">{stats.processed}</span> processed
                        </span>
                    </>
                )}
                {stats.failed > 0 && (
                    <>
                        <span className="text-border">·</span>
                        <span className="tabular-nums text-destructive">
                            <span className="font-medium">{stats.failed}</span> failed
                        </span>
                    </>
                )}
                {stats.quarantined > 0 && (
                    <>
                        <span className="text-border">·</span>
                        <span className="tabular-nums text-amber-600 dark:text-amber-400">
                            <span className="font-medium">{stats.quarantined.toLocaleString()}</span> quarantined rows
                        </span>
                    </>
                )}
            </div>
        </div>
    )
}
