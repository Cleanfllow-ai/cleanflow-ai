"use client";

import { useState } from "react";
import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";

export interface RowWiseIssuesProps {
    issues: { row: number; column: string; violation: string; value: any }[];
    total?: number;
    hasMore?: boolean;
}

// Row-wise Issues Component with smart grouping and expandable view
export function RowWiseIssues({
    issues,
    total,
    hasMore,
}: RowWiseIssuesProps) {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Group issues by row
    const issuesByRow = issues.reduce((acc, issue) => {
        if (!acc[issue.row]) {
            acc[issue.row] = [];
        }
        acc[issue.row].push(issue);
        return acc;
    }, {} as Record<number, typeof issues>);

    // Group issues by violation type for summary
    const issuesByType = issues.reduce((acc, issue) => {
        if (!acc[issue.violation]) {
            acc[issue.violation] = 0;
        }
        acc[issue.violation]++;
        return acc;
    }, {} as Record<string, number>);

    const toggleRow = (row: number) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(row)) {
            newExpanded.delete(row);
        } else {
            newExpanded.add(row);
        }
        setExpandedRows(newExpanded);
    };

    const expandAll = () => {
        setExpandedRows(new Set(Object.keys(issuesByRow).map(Number)));
    };

    const collapseAll = () => {
        setExpandedRows(new Set());
    };

    const getViolationColor = (violation: string) => {
        if (violation.includes('missing') || violation.includes('required')) return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (violation.includes('invalid') || violation.includes('duplicate')) return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        if (violation.includes('format') || violation.includes('type')) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Outstanding Issues
                    <Badge variant="secondary" className="bg-red-500/10 text-red-500">
                        {issues.length} issues in {Object.keys(issuesByRow).length} rows
                    </Badge>
                </h4>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">
                        Expand All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">
                        Collapse All
                    </Button>
                </div>
            </div>

            {/* Sampling note */}
            {(hasMore || (total && total > issues.length)) && (
                <div className="text-xs text-muted-foreground">
                    Showing {issues.length.toLocaleString()} of {(total ?? issues.length).toLocaleString()} issues.
                    {hasMore ? " Load more from backend to see full list." : ""}
                </div>
            )}

            {/* Issue Type Summary */}
            <div className="flex flex-wrap gap-2">
                {Object.entries(issuesByType).map(([type, count]) => (
                    <Badge key={type} variant="outline" className={cn("text-xs", getViolationColor(type))}>
                        {type.replace(/_/g, ' ')}: {count}
                    </Badge>
                ))}
            </div>

            {/* Row-wise expandable list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {Object.entries(issuesByRow).map(([rowNum, rowIssues]) => (
                    <Collapsible
                        key={rowNum}
                        open={expandedRows.has(Number(rowNum))}
                        onOpenChange={() => toggleRow(Number(rowNum))}
                    >
                        <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/70 transition-colors">
                                <div className="flex items-center gap-3">
                                    {expandedRows.has(Number(rowNum)) ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <Badge variant="outline" className="font-mono">Row {rowNum}</Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {rowIssues.length} {rowIssues.length === 1 ? 'issue' : 'issues'}
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    {rowIssues.slice(0, 3).map((issue, idx) => (
                                        <Badge
                                            key={idx}
                                            variant="outline"
                                            className={cn("text-[10px] px-1.5", getViolationColor(issue.violation))}
                                        >
                                            {issue.column}
                                        </Badge>
                                    ))}
                                    {rowIssues.length > 3 && (
                                        <Badge variant="outline" className="text-[10px] px-1.5">
                                            +{rowIssues.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-2 ml-7 space-y-2">
                                {rowIssues.map((issue, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "p-3 rounded-lg border-l-4 bg-muted/30",
                                            issue.violation.includes('missing') || issue.violation.includes('required') ? 'border-l-red-500' :
                                                issue.violation.includes('invalid') || issue.violation.includes('duplicate') ? 'border-l-orange-500' :
                                                    issue.violation.includes('format') ? 'border-l-yellow-500' : 'border-l-blue-500'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">{issue.column}</code>
                                                    <Badge variant="outline" className={cn("text-xs", getViolationColor(issue.violation))}>
                                                        {issue.violation.replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Value: <code className="bg-muted px-1 rounded">{issue.value === null ? 'null' : issue.value === '' ? '(empty)' : String(issue.value)}</code>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
        </div>
    );
}
