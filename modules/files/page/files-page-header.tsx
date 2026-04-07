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
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span className="font-mono text-[12px] font-semibold tabular-nums text-emerald-400">
                                {stats.processed}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-emerald-400/60">
                                processed
                            </span>
                        </div>
                    )}

                    {stats.failed > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 border border-destructive/20">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="font-mono text-[12px] font-semibold tabular-nums text-destructive">
                                {stats.failed}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-destructive/60">
                                failed
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
