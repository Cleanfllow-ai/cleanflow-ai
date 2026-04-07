"use client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import type { DqChartsProps } from "./chart-constants";
export function ProcessingSummary({ files }: DqChartsProps) {
    const completedFiles = files.filter((f) => f.status === "DQ_FIXED");
    const totalRowsIn = completedFiles.reduce(
        (sum, f) => sum + (f.rows_in || 0),
        0
    );
    const totalRowsFixed = completedFiles.reduce(
        (sum, f) => sum + (f.rows_fixed || 0),
        0
    );
    const totalRowsQuarantined = completedFiles.reduce(
        (sum, f) => sum + (f.rows_quarantined || 0),
        0
    );
    const totalRowsOut = totalRowsIn - totalRowsQuarantined;
    const metrics = [
        { label: "Input Rows", value: totalRowsIn, color: "text-foreground", bg: "bg-muted/30" },
        { label: "Valid Output", value: totalRowsOut, color: "text-emerald-500", bg: "bg-emerald-500/5" },
        { label: "Issues Fixed", value: totalRowsFixed, color: "text-amber-500", bg: "bg-amber-500/5" },
        { label: "Quarantined", value: totalRowsQuarantined, color: "text-rose-500", bg: "bg-rose-500/5" },
    ];
    return (
        <Card className="border-border">
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2"
                >
                    Processing Summary
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-3">
                <div className="space-y-1">
                    {metrics.map((m) => (
                        <div key={m.label} className={`flex justify-between items-center px-3 py-2 rounded-md ${m.bg}`}>
                            <span className="text-[11px] text-muted-foreground font-medium"
                            >
                                {m.label}
                            </span>
                            <span className={`text-sm font-bold font-mono tabular-nums ${m.color}`}>
                                {m.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
