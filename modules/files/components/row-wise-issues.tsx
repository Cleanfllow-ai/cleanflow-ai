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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { getRuleLabel, getRuleDescription } from "@/shared/lib/dq-rules";

// Heuristic: looks like a raw DQ rule code (R1..R99 / CUST_xxx / CROSS:/INTRA:)
// rather than a human label. Used to decide whether to humanize on the fly.
function looksLikeRuleCode(text: string): boolean {
    if (!text) return false;
    if (/^R\d{1,3}$/.test(text)) return true;
    if (text.startsWith("CUST_")) return true;
    if (text.startsWith("CROSS:")) return true;
    if (text.startsWith("INTRA:")) return true;
    return false;
}

function humanizeViolation(violation: string): string {
    if (looksLikeRuleCode(violation)) {
        return getRuleLabel(violation);
    }
    return violation.replace(/_/g, " ");
}

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
        if (violation.includes('missing') || violation.includes('required')) return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20';
        if (violation.includes('invalid') || violation.includes('duplicate')) return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20';
        if (violation.includes('format') || violation.includes('type')) return 'text-amber-800 bg-amber-100 border-amber-300 dark:text-yellow-500 dark:bg-yellow-500/10 dark:border-yellow-500/20';
        return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Outstanding Issues
                    <Badge variant="secondary" className="bg-red-50 text-red-500">
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

            {/* Issue Type Summary — codes hidden, label + hover tooltip */}
            <TooltipProvider delayDuration={150}>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(issuesByType).map(([type, count]) => {
                        const label = humanizeViolation(type)
                        const desc = getRuleDescription(type) || label
                        return (
                            <Tooltip key={type}>
                                <TooltipTrigger asChild>
                                    <Badge
                                        variant="outline"
                                        data-rule-id={type}
                                        data-testid="row-issue-type-badge"
                                        className={cn("text-xs cursor-help", getViolationColor(type))}
                                    >
                                        {label}: {count}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs" data-testid="row-issue-type-tooltip">
                                    {desc}
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>
            </TooltipProvider>

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
                                                    <TooltipProvider delayDuration={150}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge
                                                                    variant="outline"
                                                                    data-rule-id={issue.violation}
                                                                    data-testid="row-issue-detail-badge"
                                                                    className={cn(
                                                                        "text-xs cursor-help",
                                                                        getViolationColor(issue.violation),
                                                                    )}
                                                                >
                                                                    {humanizeViolation(issue.violation)}
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent
                                                                side="top"
                                                                className="max-w-xs"
                                                                data-testid="row-issue-detail-tooltip"
                                                            >
                                                                {getRuleDescription(issue.violation) ||
                                                                    humanizeViolation(issue.violation)}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
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
