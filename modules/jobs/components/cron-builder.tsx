"use client"

/**
 * CronBuilder — visual builder for AWS EventBridge 6-field cron expressions.
 *
 * Format: `minute hour day-of-month month day-of-week year`
 * Ranges: min 0-59 / hour 0-23 / dom 1-31 / month 1-12 / dow 1-7 / year 1970-2199
 *
 * EventBridge requires that exactly ONE of day-of-month and day-of-week be `?`.
 * The builder enforces this automatically.
 *
 * State shape: caller passes a single `value: string` (the 6-field cron) and an
 * `onChange: (cron: string) => void`. The builder parses `value` on mount/update
 * and re-emits whenever the user edits any field.
 */

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Check, Copy, Wand2 } from "lucide-react"
import {
    Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/shared/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] // EventBridge: 1=SUN..7=SAT

// EventBridge weekday numbering: 1=SUN, 2=MON, ..., 7=SAT
const WEEKDAY_IDX_TO_NAME: Record<number, string> = {
    1: "SUN", 2: "MON", 3: "TUE", 4: "WED", 5: "THU", 6: "FRI", 7: "SAT",
}
const WEEKDAY_NAME_TO_IDX: Record<string, number> = {
    SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7,
}

const MONTH_NAME_TO_IDX: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

// Quick presets
export interface CronPreset {
    label: string
    cron: string
}

export const CRON_PRESETS: CronPreset[] = [
    { label: "Every 5 minutes", cron: "0/5 * * * ? *" },
    { label: "Every 15 minutes", cron: "0/15 * * * ? *" },
    { label: "Every 30 minutes", cron: "0/30 * * * ? *" },
    { label: "Hourly", cron: "0 * * * ? *" },
    { label: "Every 2 hours", cron: "0 0/2 * * ? *" },
    { label: "Every 6 hours", cron: "0 0/6 * * ? *" },
    { label: "Daily at midnight", cron: "0 0 * * ? *" },
    { label: "Daily at 9 AM", cron: "0 9 * * ? *" },
    { label: "Weekdays at 9 AM", cron: "0 9 ? * MON-FRI *" },
    { label: "Mondays at 9 AM", cron: "0 9 ? * MON *" },
    { label: "1st of every month at midnight", cron: "0 0 1 * ? *" },
]

// ─── Tiny cron parser & next-fire-time iterator ───────────────────────────────

/**
 * Parses a single cron field into a sorted, deduped array of valid integer
 * values within [min, max], or null on parse error.
 *
 * Supports:
 *   *           → all values
 *   N/M, *\/M   → starting at N (or 0/min), step M
 *   N-M         → inclusive range
 *   N,M,O       → list (each token recursively parsed)
 *   N           → exact int
 *   ?           → "any" (returned as null sentinel — caller decides)
 *   alpha names → MON/JAN — translated via the supplied mapping
 */
function parseField(
    raw: string,
    min: number,
    max: number,
    nameMap?: Record<string, number>,
): number[] | null {
    const text = raw.trim().toUpperCase()
    if (text === "" || text === "?") return null

    const lookup = (tok: string): number | null => {
        if (nameMap && tok in nameMap) return nameMap[tok]
        if (/^-?\d+$/.test(tok)) return parseInt(tok, 10)
        return null
    }

    const result = new Set<number>()
    for (const part of text.split(",")) {
        const piece = part.trim()
        if (piece === "") return null

        // step: BASE/STEP
        if (piece.includes("/")) {
            const [base, stepStr] = piece.split("/")
            const step = parseInt(stepStr, 10)
            if (!Number.isFinite(step) || step <= 0) return null

            let lo: number
            let hi: number
            if (base === "*" || base === "") {
                lo = min
                hi = max
            } else if (base.includes("-")) {
                const [aRaw, bRaw] = base.split("-")
                const a = lookup(aRaw)
                const b = lookup(bRaw)
                if (a === null || b === null) return null
                lo = Math.min(a, b)
                hi = Math.max(a, b)
            } else {
                const a = lookup(base)
                if (a === null) return null
                lo = a
                hi = max
            }
            if (lo < min || hi > max) return null
            for (let v = lo; v <= hi; v += step) result.add(v)
            continue
        }

        // range: A-B
        if (piece.includes("-")) {
            const [aRaw, bRaw] = piece.split("-")
            const a = lookup(aRaw)
            const b = lookup(bRaw)
            if (a === null || b === null) return null
            const lo = Math.min(a, b)
            const hi = Math.max(a, b)
            if (lo < min || hi > max) return null
            for (let v = lo; v <= hi; v++) result.add(v)
            continue
        }

        // wildcard
        if (piece === "*") {
            for (let v = min; v <= max; v++) result.add(v)
            continue
        }

        // single value
        const v = lookup(piece)
        if (v === null || v < min || v > max) return null
        result.add(v)
    }

    return Array.from(result).sort((a, b) => a - b)
}

export interface ParsedCron {
    minute: number[]
    hour: number[]
    dayOfMonth: number[] | null  // null = "?"
    month: number[]
    dayOfWeek: number[] | null   // null = "?", 1=SUN..7=SAT
    year: number[] | null         // null = "*" (every year)
    error?: string
}

/**
 * Parses a 6-field EventBridge cron into per-field allowed value sets.
 * Returns `{ error }` if any field is invalid.
 */
export function parseCron(cron: string): ParsedCron {
    const tokens = cron.trim().split(/\s+/)
    if (tokens.length !== 6) {
        return {
            minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null,
            error: "Cron must have 6 fields: minute hour day-of-month month day-of-week year",
        }
    }

    const [minRaw, hourRaw, domRaw, monRaw, dowRaw, yearRaw] = tokens

    const minute = parseField(minRaw, 0, 59)
    const hour = parseField(hourRaw, 0, 23)
    const dom = domRaw.trim() === "?" ? null : parseField(domRaw, 1, 31)
    const month = parseField(monRaw, 1, 12, MONTH_NAME_TO_IDX)
    const dow = dowRaw.trim() === "?" ? null : parseField(dowRaw, 1, 7, WEEKDAY_NAME_TO_IDX)
    const year = yearRaw.trim() === "*" ? null : parseField(yearRaw, 1970, 2199)

    if (!minute || minute.length === 0) {
        return { minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null, error: "Invalid minute field" }
    }
    if (!hour || hour.length === 0) {
        return { minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null, error: "Invalid hour field" }
    }
    if (domRaw.trim() !== "?" && (!dom || dom.length === 0)) {
        return { minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null, error: "Invalid day-of-month field" }
    }
    if (!month || month.length === 0) {
        return { minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null, error: "Invalid month field" }
    }
    if (dowRaw.trim() !== "?" && (!dow || dow.length === 0)) {
        return { minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null, error: "Invalid day-of-week field" }
    }
    if (yearRaw.trim() !== "*" && (!year || year.length === 0)) {
        return { minute: [], hour: [], dayOfMonth: null, month: [], dayOfWeek: null, year: null, error: "Invalid year field" }
    }

    // EventBridge: exactly one of dom/dow must be `?`
    const domAny = dom === null
    const dowAny = dow === null
    if (domAny === dowAny) {
        return {
            minute, hour, dayOfMonth: dom, month, dayOfWeek: dow, year,
            error: "Either day-of-month or day-of-week must be `?` (not both, not neither)",
        }
    }

    return { minute, hour, dayOfMonth: dom, month, dayOfWeek: dow, year }
}

/**
 * Computes the next N firing times for a parsed cron, in IST (UTC+5:30).
 *
 * Algorithm: brute-force minute scan starting from `from`. We step minute by
 * minute and emit any timestamp that satisfies all five field sets. This is
 * O(1) per minute scan; bounded above by ~ 366*24*60 minutes for very rare
 * crons. Plenty fast for an interactive preview.
 */
export function getNextFireTimes(
    parsed: ParsedCron,
    count = 5,
    from: Date = new Date(),
): Date[] {
    if (parsed.error) return []
    const results: Date[] = []
    // start at next minute boundary
    const start = new Date(from.getTime())
    start.setSeconds(0, 0)
    start.setMinutes(start.getMinutes() + 1)

    // Cap iterations: ~ 4 years of minutes
    const MAX_ITERATIONS = 366 * 24 * 60 * 4
    const cur = new Date(start.getTime())

    for (let i = 0; i < MAX_ITERATIONS && results.length < count; i++) {
        // Convert UTC `cur` to IST for matching
        const ist = new Date(cur.getTime() + 5.5 * 60 * 60 * 1000)
        const m = ist.getUTCMinutes()
        const h = ist.getUTCHours()
        const dom = ist.getUTCDate()
        const mon = ist.getUTCMonth() + 1 // 1-12
        // EventBridge dow: 1=SUN..7=SAT. JS getUTCDay: 0=SUN..6=SAT.
        const dow = ist.getUTCDay() + 1
        const yr = ist.getUTCFullYear()

        const yearOk = parsed.year === null || parsed.year.includes(yr)
        const minOk = parsed.minute.includes(m)
        const hourOk = parsed.hour.includes(h)
        const monOk = parsed.month.includes(mon)
        const domOk = parsed.dayOfMonth === null ? true : parsed.dayOfMonth.includes(dom)
        const dowOk = parsed.dayOfWeek === null ? true : parsed.dayOfWeek.includes(dow)

        if (yearOk && minOk && hourOk && monOk && domOk && dowOk) {
            results.push(new Date(cur.getTime()))
        }
        cur.setUTCMinutes(cur.getUTCMinutes() + 1)
    }
    return results
}

/** Format a UTC date as IST human-readable string. */
function formatIST(d: Date): string {
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const dayName = dayNames[ist.getUTCDay()]
    const month = monthNames[ist.getUTCMonth()]
    const dom = ist.getUTCDate()
    const year = ist.getUTCFullYear()
    let h = ist.getUTCHours()
    const m = ist.getUTCMinutes()
    const period = h >= 12 ? "PM" : "AM"
    h = h % 12 || 12
    const minStr = m.toString().padStart(2, "0")

    // Same year compact form
    const now = new Date()
    if (year === now.getUTCFullYear()) {
        return `${dayName} ${month} ${dom}, ${h}:${minStr} ${period} IST`
    }
    return `${dayName} ${month} ${dom} ${year}, ${h}:${minStr} ${period} IST`
}

// ─── Builder mode encoders ────────────────────────────────────────────────────
//
// Each "tab" exposes a small UI that produces a string for that cron field.
// The output of all tabs is concatenated into the 6-field cron expression.

type MinuteMode = "every" | "step" | "specific" | "expr"
type HourMode = "every" | "step" | "specific" | "expr"
type DomMode = "any" | "every" | "specific" | "expr"
type MonthMode = "every" | "specific"
type DowMode = "any" | "weekdays" | "every" | "specific" | "expr"
type YearMode = "every" | "specific"

interface BuilderState {
    minuteMode: MinuteMode
    minuteStep: number
    minuteSet: Set<number>
    minuteExpr: string

    hourMode: HourMode
    hourStep: number
    hourSet: Set<number>
    hourExpr: string

    domMode: DomMode  // "any" → "?"
    domSet: Set<number>
    domExpr: string

    monthMode: MonthMode
    monthSet: Set<number>

    dowMode: DowMode  // "any" → "?"
    dowSet: Set<number>  // 1=SUN..7=SAT
    dowExpr: string

    yearMode: YearMode
    yearValue: string
}

/** Default builder state corresponds to "Every minute, every day" → `* * * * ? *`. */
function defaultBuilderState(): BuilderState {
    return {
        minuteMode: "every",
        minuteStep: 5,
        minuteSet: new Set([0]),
        minuteExpr: "*",

        hourMode: "every",
        hourStep: 2,
        hourSet: new Set([9]),
        hourExpr: "*",

        domMode: "any",
        domSet: new Set([1]),
        domExpr: "*",

        monthMode: "every",
        monthSet: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),

        dowMode: "every",
        dowSet: new Set([2, 3, 4, 5, 6]),
        dowExpr: "*",

        yearMode: "every",
        yearValue: String(new Date().getFullYear()),
    }
}

/** Convert builder state → 6-field cron string. */
function buildCron(s: BuilderState): string {
    // minute
    let minStr = "*"
    if (s.minuteMode === "every") minStr = "*"
    else if (s.minuteMode === "step") minStr = `0/${Math.max(1, Math.min(59, s.minuteStep || 1))}`
    else if (s.minuteMode === "specific") {
        const arr = [...s.minuteSet].sort((a, b) => a - b)
        minStr = arr.length ? arr.join(",") : "0"
    } else if (s.minuteMode === "expr") minStr = s.minuteExpr.trim() || "*"

    // hour
    let hourStr = "*"
    if (s.hourMode === "every") hourStr = "*"
    else if (s.hourMode === "step") hourStr = `0/${Math.max(1, Math.min(23, s.hourStep || 1))}`
    else if (s.hourMode === "specific") {
        const arr = [...s.hourSet].sort((a, b) => a - b)
        hourStr = arr.length ? arr.join(",") : "0"
    } else if (s.hourMode === "expr") hourStr = s.hourExpr.trim() || "*"

    // day-of-month
    let domStr = "?"
    if (s.domMode === "any") domStr = "?"
    else if (s.domMode === "every") domStr = "*"
    else if (s.domMode === "specific") {
        const arr = [...s.domSet].sort((a, b) => a - b)
        domStr = arr.length ? arr.join(",") : "1"
    } else if (s.domMode === "expr") domStr = s.domExpr.trim() || "*"

    // month
    let monthStr = "*"
    if (s.monthMode === "every") monthStr = "*"
    else {
        const arr = [...s.monthSet].sort((a, b) => a - b)
        monthStr = arr.length ? arr.map(i => MONTH_NAMES[i - 1]).join(",") : "*"
    }

    // day-of-week
    let dowStr = "?"
    if (s.dowMode === "any") dowStr = "?"
    else if (s.dowMode === "every") dowStr = "*"
    else if (s.dowMode === "weekdays") dowStr = "MON-FRI"
    else if (s.dowMode === "specific") {
        const arr = [...s.dowSet].sort((a, b) => a - b)
        dowStr = arr.length ? arr.map(i => WEEKDAY_IDX_TO_NAME[i]).join(",") : "MON"
    } else if (s.dowMode === "expr") dowStr = s.dowExpr.trim() || "*"

    // Mutual-exclusion guard: if both dom and dow are non-`?`, force dow → ?
    if (domStr !== "?" && dowStr !== "?") {
        dowStr = "?"
    }
    // If both are `?`, force dom → *
    if (domStr === "?" && dowStr === "?") {
        domStr = "*"
    }

    // year
    const yearStr = s.yearMode === "every"
        ? "*"
        : (s.yearValue.trim() || String(new Date().getFullYear()))

    return `${minStr} ${hourStr} ${domStr} ${monthStr} ${dowStr} ${yearStr}`
}

/**
 * Best-effort: parse an existing cron string and seed the builder's mode/set
 * state. Falls back to "expr" mode if a field is too complex to back-fit.
 */
function seedFromCron(cron: string): BuilderState {
    const base = defaultBuilderState()
    const tokens = cron.trim().split(/\s+/)
    if (tokens.length !== 6) return base
    const [minTok, hourTok, domTok, monTok, dowTok, yearTok] = tokens

    // minute
    if (minTok === "*") base.minuteMode = "every"
    else if (/^\d+\/\d+$/.test(minTok) || /^\*\/\d+$/.test(minTok)) {
        base.minuteMode = "step"
        const step = parseInt(minTok.split("/")[1], 10)
        if (Number.isFinite(step)) base.minuteStep = step
    } else if (/^\d+(,\d+)*$/.test(minTok)) {
        base.minuteMode = "specific"
        base.minuteSet = new Set(minTok.split(",").map(n => parseInt(n, 10)))
    } else {
        base.minuteMode = "expr"
        base.minuteExpr = minTok
    }

    // hour
    if (hourTok === "*") base.hourMode = "every"
    else if (/^\d+\/\d+$/.test(hourTok) || /^\*\/\d+$/.test(hourTok)) {
        base.hourMode = "step"
        const step = parseInt(hourTok.split("/")[1], 10)
        if (Number.isFinite(step)) base.hourStep = step
    } else if (/^\d+(,\d+)*$/.test(hourTok)) {
        base.hourMode = "specific"
        base.hourSet = new Set(hourTok.split(",").map(n => parseInt(n, 10)))
    } else {
        base.hourMode = "expr"
        base.hourExpr = hourTok
    }

    // dom
    if (domTok === "?") base.domMode = "any"
    else if (domTok === "*") base.domMode = "every"
    else if (/^\d+(,\d+)*$/.test(domTok)) {
        base.domMode = "specific"
        base.domSet = new Set(domTok.split(",").map(n => parseInt(n, 10)))
    } else {
        base.domMode = "expr"
        base.domExpr = domTok
    }

    // month
    if (monTok === "*") base.monthMode = "every"
    else {
        base.monthMode = "specific"
        const set = new Set<number>()
        for (const t of monTok.split(",")) {
            const tk = t.trim().toUpperCase()
            if (/^\d+$/.test(tk)) set.add(parseInt(tk, 10))
            else if (tk in MONTH_NAME_TO_IDX) set.add(MONTH_NAME_TO_IDX[tk])
        }
        if (set.size > 0) base.monthSet = set
    }

    // dow
    if (dowTok === "?") base.dowMode = "any"
    else if (dowTok === "*") base.dowMode = "every"
    else if (dowTok.toUpperCase() === "MON-FRI") base.dowMode = "weekdays"
    else if (/^[A-Z]+(,[A-Z]+)*$/i.test(dowTok)) {
        base.dowMode = "specific"
        const set = new Set<number>()
        for (const t of dowTok.split(",")) {
            const tk = t.trim().toUpperCase()
            if (tk in WEEKDAY_NAME_TO_IDX) set.add(WEEKDAY_NAME_TO_IDX[tk])
        }
        if (set.size > 0) base.dowSet = set
    } else if (/^\d+(,\d+)*$/.test(dowTok)) {
        base.dowMode = "specific"
        base.dowSet = new Set(dowTok.split(",").map(n => parseInt(n, 10)))
    } else {
        base.dowMode = "expr"
        base.dowExpr = dowTok
    }

    // year
    if (yearTok === "*") base.yearMode = "every"
    else {
        base.yearMode = "specific"
        base.yearValue = yearTok
    }

    return base
}

// ─── Reusable bits ────────────────────────────────────────────────────────────

interface NumGridProps {
    min: number
    max: number
    selected: Set<number>
    onToggle: (n: number) => void
    formatLabel?: (n: number) => string
    columns?: string
}

function NumGrid({ min, max, selected, onToggle, formatLabel, columns = "grid-cols-6 sm:grid-cols-10" }: NumGridProps) {
    const items: number[] = []
    for (let i = min; i <= max; i++) items.push(i)
    return (
        <div className={cn("grid gap-1.5", columns)}>
            {items.map(n => {
                const on = selected.has(n)
                return (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onToggle(n)}
                        className={cn(
                            "h-7 rounded-md border text-[11px] font-medium transition-colors",
                            on
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground/70 hover:bg-accent hover:text-foreground"
                        )}
                    >
                        {formatLabel ? formatLabel(n) : n}
                    </button>
                )
            })}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface CronBuilderProps {
    value: string
    onChange: (cron: string, isValid: boolean) => void
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
    const [state, setState] = useState<BuilderState>(() => seedFromCron(value || "0 9 * * ? *"))
    const [activeTab, setActiveTab] = useState<string>("minute")
    const [copied, setCopied] = useState(false)

    // Re-emit cron whenever state changes
    const cron = useMemo(() => buildCron(state), [state])
    const parsed = useMemo(() => parseCron(cron), [cron])
    const isValid = !parsed.error
    const nextFires = useMemo(
        () => (isValid ? getNextFireTimes(parsed, 5) : []),
        [parsed, isValid],
    )

    useEffect(() => {
        onChange(cron, isValid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cron, isValid])

    // Copy helper
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(cron)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
        } catch {
            /* noop — older browsers */
        }
    }

    // Apply preset
    const applyPreset = (preset: CronPreset) => {
        setState(seedFromCron(preset.cron))
    }

    // Mutex handling: when user picks specific dom, force dow → any (and vice versa)
    const setDomMode = (m: DomMode) => {
        setState(s => {
            const next = { ...s, domMode: m }
            if (m !== "any" && s.dowMode !== "any") next.dowMode = "any"
            return next
        })
    }
    const setDowMode = (m: DowMode) => {
        setState(s => {
            const next = { ...s, dowMode: m }
            if (m !== "any" && s.domMode !== "any") next.domMode = "any"
            return next
        })
    }

    // Toggle helpers — set-mutators preserve referential stability
    const toggleNum = (key: "minuteSet" | "hourSet" | "domSet" | "monthSet" | "dowSet", n: number) => {
        setState(s => {
            const set = new Set(s[key])
            if (set.has(n)) set.delete(n)
            else set.add(n)
            return { ...s, [key]: set } as BuilderState
        })
    }

    // Detect which preset (if any) currently matches the cron
    const matchingPresetIdx = CRON_PRESETS.findIndex(p => normalizeCron(p.cron) === normalizeCron(cron))

    return (
        <div className="space-y-3">
            {/* ── Presets ───────────────────────────────────────────────────── */}
            <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Quick presets</Label>
                <div className="flex flex-wrap gap-1.5">
                    {CRON_PRESETS.map((p, i) => {
                        const active = i === matchingPresetIdx
                        return (
                            <button
                                key={p.cron}
                                type="button"
                                onClick={() => applyPreset(p)}
                                className={cn(
                                    "px-2.5 py-1 rounded-full border text-[11px] transition-colors",
                                    active
                                        ? "border-primary bg-primary/10 text-primary font-medium"
                                        : "border-border bg-background text-foreground/70 hover:bg-accent hover:text-foreground"
                                )}
                            >
                                {p.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Tabs: per-unit fine grain ─────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-6 h-9">
                    <TabsTrigger value="minute" className="text-xs">Minute</TabsTrigger>
                    <TabsTrigger value="hour" className="text-xs">Hour</TabsTrigger>
                    <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                    <TabsTrigger value="weekday" className="text-xs">Weekday</TabsTrigger>
                    <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
                </TabsList>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 mt-2 min-h-[150px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                        >
                            {/* MINUTE */}
                            <TabsContent value="minute" forceMount={activeTab === "minute" ? true : undefined} className="m-0 space-y-3">
                                <RadioGroup
                                    value={state.minuteMode}
                                    onValueChange={(v) => setState(s => ({ ...s, minuteMode: v as MinuteMode }))}
                                    className="grid gap-2"
                                >
                                    <RadioRow value="every" id="min-every" label="Every minute" />
                                    <RadioRow value="step" id="min-step" label="Every N minutes">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={59}
                                            value={state.minuteStep}
                                            onChange={e => setState(s => ({ ...s, minuteStep: Math.max(1, Math.min(59, parseInt(e.target.value || "1", 10))) }))}
                                            disabled={state.minuteMode !== "step"}
                                            className="h-7 w-16 text-xs ml-2"
                                        />
                                        <span className="text-xs text-muted-foreground">minutes</span>
                                    </RadioRow>
                                    <RadioRow value="specific" id="min-specific" label="At specific minutes" />
                                    {state.minuteMode === "specific" && (
                                        <div className="ml-6">
                                            <NumGrid
                                                min={0} max={59}
                                                selected={state.minuteSet}
                                                onToggle={n => toggleNum("minuteSet", n)}
                                                formatLabel={n => n.toString().padStart(2, "0")}
                                            />
                                        </div>
                                    )}
                                    <RadioRow value="expr" id="min-expr" label="Cron expression">
                                        <Input
                                            value={state.minuteExpr}
                                            onChange={e => setState(s => ({ ...s, minuteExpr: e.target.value }))}
                                            disabled={state.minuteMode !== "expr"}
                                            className="h-7 text-xs ml-2 font-mono w-32"
                                            placeholder="*"
                                        />
                                    </RadioRow>
                                </RadioGroup>
                            </TabsContent>

                            {/* HOUR */}
                            <TabsContent value="hour" forceMount={activeTab === "hour" ? true : undefined} className="m-0 space-y-3">
                                <RadioGroup
                                    value={state.hourMode}
                                    onValueChange={(v) => setState(s => ({ ...s, hourMode: v as HourMode }))}
                                    className="grid gap-2"
                                >
                                    <RadioRow value="every" id="hr-every" label="Every hour" />
                                    <RadioRow value="step" id="hr-step" label="Every N hours">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={23}
                                            value={state.hourStep}
                                            onChange={e => setState(s => ({ ...s, hourStep: Math.max(1, Math.min(23, parseInt(e.target.value || "1", 10))) }))}
                                            disabled={state.hourMode !== "step"}
                                            className="h-7 w-16 text-xs ml-2"
                                        />
                                        <span className="text-xs text-muted-foreground">hours</span>
                                    </RadioRow>
                                    <RadioRow value="specific" id="hr-specific" label="At specific hours" />
                                    {state.hourMode === "specific" && (
                                        <div className="ml-6">
                                            <NumGrid
                                                min={0} max={23}
                                                selected={state.hourSet}
                                                onToggle={n => toggleNum("hourSet", n)}
                                                formatLabel={n => {
                                                    const h12 = n % 12 || 12
                                                    return `${h12}${n < 12 ? "a" : "p"}`
                                                }}
                                                columns="grid-cols-6 sm:grid-cols-12"
                                            />
                                        </div>
                                    )}
                                    <RadioRow value="expr" id="hr-expr" label="Cron expression">
                                        <Input
                                            value={state.hourExpr}
                                            onChange={e => setState(s => ({ ...s, hourExpr: e.target.value }))}
                                            disabled={state.hourMode !== "expr"}
                                            className="h-7 text-xs ml-2 font-mono w-32"
                                            placeholder="*"
                                        />
                                    </RadioRow>
                                </RadioGroup>
                            </TabsContent>

                            {/* DAY OF MONTH */}
                            <TabsContent value="day" forceMount={activeTab === "day" ? true : undefined} className="m-0 space-y-3">
                                {state.dowMode !== "any" && (
                                    <Badge variant="secondary" className="gap-1 text-[10px]">
                                        <Wand2 className="h-2.5 w-2.5" />
                                        Day-of-month: any (because Weekday is set)
                                    </Badge>
                                )}
                                <RadioGroup
                                    value={state.domMode}
                                    onValueChange={(v) => setDomMode(v as DomMode)}
                                    className="grid gap-2"
                                >
                                    <RadioRow value="any" id="dom-any" label="Any day-of-month (?)" />
                                    <RadioRow value="every" id="dom-every" label="Every day" />
                                    <RadioRow value="specific" id="dom-specific" label="On specific days of month" />
                                    {state.domMode === "specific" && (
                                        <div className="ml-6">
                                            <NumGrid
                                                min={1} max={31}
                                                selected={state.domSet}
                                                onToggle={n => toggleNum("domSet", n)}
                                            />
                                        </div>
                                    )}
                                    <RadioRow value="expr" id="dom-expr" label="Cron expression">
                                        <Input
                                            value={state.domExpr}
                                            onChange={e => setState(s => ({ ...s, domExpr: e.target.value }))}
                                            disabled={state.domMode !== "expr"}
                                            className="h-7 text-xs ml-2 font-mono w-32"
                                            placeholder="*"
                                        />
                                    </RadioRow>
                                </RadioGroup>
                            </TabsContent>

                            {/* MONTH */}
                            <TabsContent value="month" forceMount={activeTab === "month" ? true : undefined} className="m-0 space-y-3">
                                <RadioGroup
                                    value={state.monthMode}
                                    onValueChange={(v) => setState(s => ({ ...s, monthMode: v as MonthMode }))}
                                    className="grid gap-2"
                                >
                                    <RadioRow value="every" id="mo-every" label="Every month" />
                                    <RadioRow value="specific" id="mo-specific" label="Specific months" />
                                </RadioGroup>
                                {state.monthMode === "specific" && (
                                    <div className="ml-6">
                                        <NumGrid
                                            min={1} max={12}
                                            selected={state.monthSet}
                                            onToggle={n => toggleNum("monthSet", n)}
                                            formatLabel={n => MONTH_NAMES[n - 1].slice(0, 3).toLowerCase().replace(/^./, c => c.toUpperCase())}
                                            columns="grid-cols-4 sm:grid-cols-6"
                                        />
                                    </div>
                                )}
                            </TabsContent>

                            {/* WEEKDAY */}
                            <TabsContent value="weekday" forceMount={activeTab === "weekday" ? true : undefined} className="m-0 space-y-3">
                                {state.domMode !== "any" && (
                                    <Badge variant="secondary" className="gap-1 text-[10px]">
                                        <Wand2 className="h-2.5 w-2.5" />
                                        Weekday: any (because Day-of-month is set)
                                    </Badge>
                                )}
                                <RadioGroup
                                    value={state.dowMode}
                                    onValueChange={(v) => setDowMode(v as DowMode)}
                                    className="grid gap-2"
                                >
                                    <RadioRow value="any" id="dow-any" label="Any weekday (?)" />
                                    <RadioRow value="every" id="dow-every" label="Every day" />
                                    <RadioRow value="weekdays" id="dow-weekdays" label="Weekdays only (Mon-Fri)" />
                                    <RadioRow value="specific" id="dow-specific" label="Specific weekdays" />
                                    {state.dowMode === "specific" && (
                                        <div className="ml-6">
                                            <NumGrid
                                                min={1} max={7}
                                                selected={state.dowSet}
                                                onToggle={n => toggleNum("dowSet", n)}
                                                formatLabel={n => WEEKDAY_NAMES[n - 1].slice(0, 3).toLowerCase().replace(/^./, c => c.toUpperCase())}
                                                columns="grid-cols-7"
                                            />
                                        </div>
                                    )}
                                    <RadioRow value="expr" id="dow-expr" label="Cron expression">
                                        <Input
                                            value={state.dowExpr}
                                            onChange={e => setState(s => ({ ...s, dowExpr: e.target.value }))}
                                            disabled={state.dowMode !== "expr"}
                                            className="h-7 text-xs ml-2 font-mono w-32"
                                            placeholder="*"
                                        />
                                    </RadioRow>
                                </RadioGroup>
                            </TabsContent>

                            {/* YEAR */}
                            <TabsContent value="year" forceMount={activeTab === "year" ? true : undefined} className="m-0 space-y-3">
                                <RadioGroup
                                    value={state.yearMode}
                                    onValueChange={(v) => setState(s => ({ ...s, yearMode: v as YearMode }))}
                                    className="grid gap-2"
                                >
                                    <RadioRow value="every" id="yr-every" label="Every year (*)" />
                                    <RadioRow value="specific" id="yr-specific" label="Specific year(s)">
                                        <Input
                                            value={state.yearValue}
                                            onChange={e => setState(s => ({ ...s, yearValue: e.target.value }))}
                                            disabled={state.yearMode !== "specific"}
                                            className="h-7 text-xs ml-2 font-mono w-32"
                                            placeholder="2026 or 2026-2030"
                                        />
                                    </RadioRow>
                                </RadioGroup>
                            </TabsContent>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </Tabs>

            {/* ── Live preview & validation ───────────────────────────────── */}
            <div className="space-y-2">
                {/* Cron string + copy */}
                <div className="flex items-stretch gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-border/60 bg-background">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">cron</span>
                        <code className="flex-1 font-mono text-xs text-foreground select-all break-all">
                            {cron}
                        </code>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="h-auto px-3 gap-1.5 text-xs"
                    >
                        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                </div>

                {/* Validation banner */}
                {parsed.error && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-destructive/30 bg-destructive/5 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                            <span className="font-medium">Invalid cron:</span> {parsed.error}
                            {parsed.error?.startsWith("Either day-of-month") && (
                                <button
                                    type="button"
                                    onClick={() => setState(s => ({ ...s, dowMode: "any" }))}
                                    className="ml-1 underline font-medium"
                                >
                                    Set weekday to any
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Next fire times */}
                {isValid && (
                    <div className="rounded-md border border-border/60 bg-background p-3">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 block">
                            Next 5 firing times (IST)
                        </Label>
                        {nextFires.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                                No upcoming firing times in the next 4 years
                            </p>
                        ) : (
                            <ul className="space-y-0.5">
                                {nextFires.map((d, i) => (
                                    <li key={i} className="text-xs text-foreground/80 font-mono flex items-center gap-2">
                                        <span className="text-muted-foreground/60 w-4 text-right">{i + 1}.</span>
                                        {formatIST(d)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RadioRowProps {
    value: string
    id: string
    label: string
    children?: React.ReactNode
}

function RadioRow({ value, id, label, children }: RadioRowProps) {
    return (
        <label
            htmlFor={id}
            className="flex items-center gap-2 cursor-pointer text-xs text-foreground/90"
        >
            <RadioGroupItem value={value} id={id} />
            <span>{label}</span>
            {children}
        </label>
    )
}

/** Normalize cron for preset matching: lowercase whitespace-collapsed. */
function normalizeCron(cron: string): string {
    return cron.trim().split(/\s+/).join(" ").toLowerCase()
}
