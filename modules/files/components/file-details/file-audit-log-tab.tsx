"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Filter, History, Loader2, RefreshCw, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/modules/auth"
import {
    getAuditLog,
    type AuditLogEntry,
    type AuditLogFilters,
    type AuditLogSource,
} from "@/modules/files/api/file-quarantine-api"
import { cn } from "@/shared/lib/utils"
import { formatToUserTZ } from "@/shared/lib/utils"
// W4-2 polish: render demo emails (battletest-user01@…) as "Demo User 01"
// in the changed_by column so the audit log never leaks the raw demo
// identity. Real customer emails flow through unchanged.
import { formatUserEmailForDisplay } from "@/shared/lib/user-display"

const SOURCE_OPTIONS: Array<{ value: AuditLogSource | "all"; label: string }> = [
    { value: "all", label: "All sources" },
    { value: "user_edit", label: "User edit" },
    { value: "auto_fix", label: "Auto fix" },
    { value: "find_replace", label: "Find / replace" },
    { value: "rule_correction", label: "Rule correction" },
    { value: "reprocess", label: "Reprocess" },
    { value: "unlock", label: "Unlock" },
    { value: "system", label: "System" },
]

const SOURCE_BADGE_COLORS: Record<AuditLogSource, string> = {
    user_edit: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    auto_fix: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    find_replace: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
    rule_correction: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    reprocess: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900",
    unlock: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
    system: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-900",
}

const PAGE_SIZE = 50

export interface FileAuditLogTabProps {
    uploadId: string
}

export function FileAuditLogTab({ uploadId }: FileAuditLogTabProps) {
    const { idToken } = useAuth()
    const [entries, setEntries] = useState<AuditLogEntry[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [forbidden, setForbidden] = useState(false)
    // Filters
    const [sourceFilter, setSourceFilter] = useState<AuditLogSource | "all">("all")
    const [rowIdFilter, setRowIdFilter] = useState("")
    const [columnFilter, setColumnFilter] = useState("")

    const buildFilters = useCallback(
        (cursor?: string): AuditLogFilters => {
            const f: AuditLogFilters = { limit: PAGE_SIZE }
            if (sourceFilter !== "all") f.source = sourceFilter
            if (rowIdFilter.trim()) f.row_id = rowIdFilter.trim()
            if (columnFilter.trim()) f.column = columnFilter.trim()
            if (cursor) f.cursor = cursor
            return f
        },
        [sourceFilter, rowIdFilter, columnFilter],
    )

    const load = useCallback(
        async (cursor?: string) => {
            if (!idToken) return
            const isInitial = !cursor
            if (isInitial) setLoading(true)
            else setLoadingMore(true)
            setError(null)
            try {
                const resp = await getAuditLog(uploadId, idToken, buildFilters(cursor))
                if (isInitial) setEntries(resp.entries)
                else setEntries((prev) => [...prev, ...resp.entries])
                setNextCursor(resp.next_cursor)
                setForbidden(false)
            } catch (e: any) {
                const message = String(e?.message || "Failed to load audit log")
                if (message.toLowerCase().includes("forbidden") || message.includes("403")) {
                    setForbidden(true)
                } else {
                    setError(message)
                }
            } finally {
                if (isInitial) setLoading(false)
                else setLoadingMore(false)
            }
        },
        [idToken, uploadId, buildFilters],
    )

    useEffect(() => {
        load()
        // We intentionally only re-run on uploadId change here; filter changes
        // go through the explicit "Apply filters" button to avoid hammering
        // the API on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uploadId, idToken])

    const groupedByDate = useMemo(() => {
        const groups: Array<{ label: string; entries: AuditLogEntry[] }> = []
        const map = new Map<string, AuditLogEntry[]>()
        for (const e of entries) {
            const day = (e.changed_at || "").slice(0, 10) || "unknown"
            const arr = map.get(day) || []
            arr.push(e)
            map.set(day, arr)
        }
        for (const [day, list] of map.entries()) {
            groups.push({ label: day, entries: list })
        }
        return groups
    }, [entries])

    if (forbidden) {
        return (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                You do not have permission to view this audit log.
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col">
            {/* Filter bar */}
            <div className="border-b bg-muted/20 px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select
                        value={sourceFilter}
                        onValueChange={(v) => setSourceFilter(v as AuditLogSource | "all")}
                    >
                        <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SOURCE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={rowIdFilter}
                            onChange={(e) => setRowIdFilter(e.target.value)}
                            placeholder="Row id"
                            className="h-8 w-40 pl-7 text-xs"
                        />
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={columnFilter}
                            onChange={(e) => setColumnFilter(e.target.value)}
                            placeholder="Column"
                            className="h-8 w-40 pl-7 text-xs"
                        />
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => load()}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-1.5 h-3 w-3" />
                        )}
                        Apply
                    </Button>

                    <div className="ml-auto text-xs text-muted-foreground">
                        {entries.length > 0 && `${entries.length} entries`}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {loading && entries.length === 0 ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {error}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-muted-foreground">
                        <History className="mb-2 h-8 w-8 opacity-30" />
                        No audit entries match the current filters.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedByDate.map((group) => (
                            <div key={group.label}>
                                <div className="sticky top-0 z-10 mb-2 -mx-6 border-b bg-background/95 px-6 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                                    {group.label}
                                </div>
                                <ul className="space-y-1.5">
                                    {group.entries.map((e) => (
                                        <AuditEntryRow key={e.audit_id} entry={e} />
                                    ))}
                                </ul>
                            </div>
                        ))}

                        {nextCursor && (
                            <div className="flex justify-center pt-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => load(nextCursor)}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? (
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    ) : null}
                                    Load more
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function AuditEntryRow({ entry }: { entry: AuditLogEntry }) {
    const time = formatToUserTZ(entry.changed_at)
    const oldStr = formatValue(entry.old_value)
    const newStr = formatValue(entry.new_value)
    const showDiff = oldStr !== newStr || entry.source !== "user_edit"

    return (
        <li className="rounded-md border bg-card/50 px-3 py-2 text-xs">
            <div className="flex items-start gap-2">
                <span className="shrink-0 font-mono text-muted-foreground">{time}</span>
                <Badge
                    variant="outline"
                    className={cn("h-5 shrink-0 px-1.5 text-[10px]", SOURCE_BADGE_COLORS[entry.source])}
                >
                    {entry.source.replace("_", " ")}
                </Badge>
                <span className="shrink-0 truncate font-medium" data-testid="audit-row-changed-by">
                    {formatUserEmailForDisplay(entry.changed_by)}
                </span>
                {entry.column && (
                    <span className="shrink-0 truncate text-muted-foreground">
                        edited <span className="font-mono">{entry.column}</span>
                    </span>
                )}
                <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    row {entry.row_id}
                </span>
            </div>
            {showDiff && (
                <div className="mt-1 flex items-baseline gap-2 pl-[60px]">
                    <span
                        className={cn(
                            "max-w-xs truncate rounded px-1.5 py-0.5 font-mono text-[11px]",
                            oldStr === ""
                                ? "text-muted-foreground italic"
                                : "bg-rose-50 text-rose-700 line-through dark:bg-rose-950/40 dark:text-rose-300",
                        )}
                        title={oldStr}
                    >
                        {oldStr || "(empty)"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span
                        className={cn(
                            "max-w-xs truncate rounded px-1.5 py-0.5 font-mono text-[11px]",
                            newStr === ""
                                ? "text-muted-foreground italic"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                        )}
                        title={newStr}
                    >
                        {newStr || "(empty)"}
                    </span>
                </div>
            )}
        </li>
    )
}

function formatValue(v: unknown): string {
    if (v === null || v === undefined) return ""
    if (typeof v === "string") return v
    try {
        return JSON.stringify(v)
    } catch {
        return String(v)
    }
}
