"use client"

import { useMemo } from "react"
import { Database, CheckCircle2, AlertTriangle } from "lucide-react"
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
        return { total: visible.length, processed, failed }
    }, [files])

    if (stats.total === 0) {
        return (
            <div className="pb-1">
                <h1 className="font-sans text-xl font-bold tracking-tight">
                    Data Catalog
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Import and process your data files
                </p>
            </div>
        )
    }

    return (
        <div className="pb-1">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-sans text-xl font-bold tracking-tight mr-2">
                    Data Catalog
                </h1>

                {/* Stat pills */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50">
                        <Database className="h-3 w-3 text-primary" />
                        <span className="font-mono text-[12px] font-semibold tabular-nums text-foreground">
                            {stats.total}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            files
                        </span>
                    </div>

                    {stats.processed > 0 && (
                        // Wave 4: emerald-400 on emerald-500/10 was 1.70:1 (regression).
                        // Use status-success token (green-700 light / green-400 dark) which
                        // clears AA on both surfaces. Drop the /60 opacity on the small
                        // uppercase label — `text-[color:var(--status-success)]/75` would
                        // still erode contrast below AA at 10px.
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 border border-green-200/60 dark:bg-green-900/30 dark:border-green-900/50">
                            <CheckCircle2 className="h-3 w-3 text-[color:var(--status-success)]" />
                            <span className="font-mono text-[12px] font-semibold tabular-nums text-[color:var(--status-success)]">
                                {stats.processed}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[color:var(--status-success)]">
                                processed
                            </span>
                        </div>
                    )}

                    {stats.failed > 0 && (
                        // Wave 4: `text-destructive/60` on the 10px uppercase "failed"
                        // label diluted the deepened red-700 to 2.81:1. Drop the /60
                        // opacity so the small label clears AA.
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 border border-destructive/20">
                            <AlertTriangle className="h-3 w-3 text-[color:var(--text-destructive)]" />
                            <span className="font-mono text-[12px] font-semibold tabular-nums text-[color:var(--text-destructive)]">
                                {stats.failed}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-destructive)]">
                                failed
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
