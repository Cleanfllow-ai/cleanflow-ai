"use client"

import { useMemo } from "react"
import { Files, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react"
import type { FileStatusResponse } from "@/modules/files"

interface DashboardKpiCardsProps {
    files: FileStatusResponse[]
}

export function DashboardKpiCards({ files }: DashboardKpiCardsProps) {
    const stats = useMemo(() => {
        const visible = files.filter((f) => !f.parent_upload_id)
        const processed = visible.filter((f) => f.status === "DQ_FIXED")
        const failed = visible.filter((f) =>
            ["DQ_FAILED", "REJECTED", "UPLOAD_FAILED", "FAILED"].includes(f.status)
        )
        const avgScore =
            processed.length > 0
                ? processed.reduce((sum, f) => sum + (f.dq_score || 0), 0) / processed.length
                : null
        const totalQuarantined = processed.reduce(
            (sum, f) => sum + (f.rows_quarantined || 0),
            0
        )
        return {
            total: visible.length,
            processed: processed.length,
            failed: failed.length,
            avgScore,
            totalQuarantined,
        }
    }, [files])

    const cards = [
        {
            label: "Total Files",
            value: stats.total.toString(),
            sub: stats.failed > 0 ? `${stats.failed} failed` : "all sources",
            icon: Files,
            iconColor: "text-primary",
            bgColor: "bg-primary/8",
            valueColor: "",
            alertColor: stats.failed > 0 ? "text-destructive" : "text-muted-foreground",
            accentColor: "bg-primary",
        },
        {
            label: "Avg DQ Score",
            value: stats.avgScore !== null ? `${stats.avgScore.toFixed(1)}%` : "\u2014",
            sub:
                stats.avgScore !== null
                    ? stats.avgScore >= 90
                        ? "Excellent"
                        : stats.avgScore >= 70
                        ? "Good"
                        : "Needs attention"
                    : "No processed files",
            icon: ShieldCheck,
            iconColor:
                stats.avgScore === null
                    ? "text-muted-foreground"
                    : stats.avgScore >= 90
                    ? "text-emerald-500"
                    : stats.avgScore >= 70
                    ? "text-amber-500"
                    : "text-destructive",
            bgColor:
                stats.avgScore === null
                    ? "bg-muted/40"
                    : stats.avgScore >= 90
                    ? "bg-emerald-500/8"
                    : stats.avgScore >= 70
                    ? "bg-amber-500/8"
                    : "bg-destructive/8",
            valueColor:
                stats.avgScore === null
                    ? ""
                    : stats.avgScore >= 90
                    ? "text-emerald-600 dark:text-emerald-400"
                    : stats.avgScore >= 70
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive",
            alertColor: "text-muted-foreground",
            accentColor:
                stats.avgScore === null
                    ? "bg-muted-foreground/30"
                    : stats.avgScore >= 90
                    ? "bg-emerald-500"
                    : stats.avgScore >= 70
                    ? "bg-amber-500"
                    : "bg-destructive",
        },
        {
            label: "Processed",
            value: stats.processed.toString(),
            sub:
                stats.total > 0
                    ? `${Math.round((stats.processed / stats.total) * 100)}% completion`
                    : "no files",
            icon: CheckCircle2,
            iconColor: "text-emerald-500",
            bgColor: "bg-emerald-500/8",
            valueColor: "",
            alertColor: "text-muted-foreground",
            accentColor: "bg-emerald-500",
        },
        {
            label: "Quarantined Rows",
            value: stats.totalQuarantined.toLocaleString(),
            sub: stats.totalQuarantined > 0 ? "require remediation" : "all rows clean",
            icon: AlertTriangle,
            iconColor: stats.totalQuarantined > 0 ? "text-amber-500" : "text-muted-foreground",
            bgColor: stats.totalQuarantined > 0 ? "bg-amber-500/8" : "bg-muted/40",
            valueColor:
                stats.totalQuarantined > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "",
            alertColor: "text-muted-foreground",
            accentColor: stats.totalQuarantined > 0 ? "bg-amber-500" : "bg-muted-foreground/30",
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 flex items-start gap-3"
                >
                    {/* Left accent bar */}
                    <div
                        className={`absolute left-0 top-0 bottom-0 w-[3px] ${card.accentColor}`}
                    />

                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                        <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-none mb-2">
                            {card.label}
                        </p>
                        <p className={`text-xl font-bold leading-none font-mono tabular-nums ${card.valueColor}`}>
                            {card.value}
                        </p>
                        <p className={`text-[11px] mt-1.5 leading-none ${card.alertColor}`}>
                            {card.sub}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    )
}
