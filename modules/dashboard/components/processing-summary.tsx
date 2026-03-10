"use client";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import type { DqChartsProps } from "./chart-constants";

// Processing Summary component
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

    return (
        <Card>
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base font-semibold">
                    Processing Summary
                </CardTitle>
                <CardDescription className="text-xs">
                    Data quality metrics breakdown
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 max-h-[280px] overflow-y-auto">
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">
                            Total Input Rows
                        </span>
                        <span className="text-sm font-medium">
                            {totalRowsIn.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-green-500/10">
                        <span className="text-sm text-muted-foreground">Valid Output Rows</span>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            {totalRowsOut.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-yellow-500/10">
                        <span className="text-sm text-muted-foreground">Issues Resolved</span>
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                            {totalRowsFixed.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-red-500/10">
                        <span className="text-sm text-muted-foreground">Records Quarantined</span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            {totalRowsQuarantined.toLocaleString()}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
