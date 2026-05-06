"use client"

import { useState } from "react"
import { Calculator, ChevronRight, Loader2, Plus, Shield, ShieldCheck, FileWarning, Globe, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible"
import { cn } from "@/shared/lib/utils"
import { DQ_RULE_NAMES } from "@/shared/lib/dq-rules"
import type { SettingsPreset } from "@/modules/files/types"
import type { OrgMembership } from "@/modules/auth/api/org-api"

/** A single formula rule editable in the DQ config panel.
 *  Mirrors the backend FormulaRule shape from
 *  `contexts/dq/.../dq_engine/rules/formula_rules.py`. */
export interface FormulaRuleDraft {
    target: string
    expression: string
    on_error?: "violate" | "skip"
}

/** ISO 4217 quick-pick list. Common currencies first; the input
 *  accepts any 3-letter code so unlisted currencies work too. */
const CURRENCY_CODE_OPTIONS = [
    { code: "USD", name: "US Dollar (2 dp)" },
    { code: "EUR", name: "Euro (2 dp)" },
    { code: "GBP", name: "British Pound (2 dp)" },
    { code: "INR", name: "Indian Rupee (2 dp)" },
    { code: "AUD", name: "Australian Dollar (2 dp)" },
    { code: "CAD", name: "Canadian Dollar (2 dp)" },
    { code: "JPY", name: "Japanese Yen (0 dp)" },
    { code: "KRW", name: "South Korean Won (0 dp)" },
    { code: "VND", name: "Vietnamese Dong (0 dp)" },
    { code: "BHD", name: "Bahraini Dinar (3 dp)" },
    { code: "JOD", name: "Jordanian Dinar (3 dp)" },
    { code: "KWD", name: "Kuwaiti Dinar (3 dp)" },
    { code: "OMR", name: "Omani Rial (3 dp)" },
    { code: "TND", name: "Tunisian Dinar (3 dp)" },
]

/** strftime/strptime quick-pick list for the date-formats editor (#9). */
const DATE_FORMAT_PRESETS: Array<{ pattern: string; label: string }> = [
    { pattern: "%Y-%m-%d", label: "%Y-%m-%d  (ISO — 2026-05-07)" },
    { pattern: "%d/%m/%Y", label: "%d/%m/%Y  (DMY — 07/05/2026)" },
    { pattern: "%m/%d/%Y", label: "%m/%d/%Y  (MDY — 05/07/2026)" },
    { pattern: "%d-%m-%Y", label: "%d-%m-%Y  (DMY dashed)" },
    { pattern: "%Y/%m/%d", label: "%Y/%m/%d  (ISO slashed)" },
    { pattern: "%d.%m.%Y", label: "%d.%m.%Y  (European dotted)" },
    { pattern: "%Y-%m-%dT%H:%M:%SZ", label: "%Y-%m-%dT%H:%M:%SZ  (ISO 8601 with time)" },
]

// ─── Rule Categories ─────────────────────────────────────────────────────────

const RULE_CATEGORIES: { label: string; icon: React.ReactNode; rules: string[] }[] = [
    {
        label: "Data Integrity",
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
        rules: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"],
    },
    {
        label: "Security",
        icon: <Shield className="h-3.5 w-3.5" />,
        rules: ["R23", "R24", "R25", "R26"],
    },
    {
        label: "Format Validation",
        icon: <FileWarning className="h-3.5 w-3.5" />,
        rules: ["R9", "R10", "R11", "R12", "R13", "R14", "R15", "R16"],
    },
    {
        label: "Domain Rules",
        icon: <Globe className="h-3.5 w-3.5" />,
        rules: ["R17", "R18", "R19", "R20", "R21", "R22", "R27", "R28", "R29", "R30", "R31", "R32", "R33", "R34"],
    },
]

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DQConfigPanelProps {
    dqPolicy: "block_and_notify" | "export_all"
    onPolicyChange: (policy: "block_and_notify" | "export_all") => void
    presetId: string
    onPresetChange: (id: string) => void
    responsibleUserId: string
    onResponsibleUserChange: (userId: string) => void
    rulesEnabled: Record<string, boolean>
    onRulesChange: (rules: Record<string, boolean>) => void
    allowAutofix: boolean
    onAutofixChange: (v: boolean) => void
    // Data from parent hook
    presets: SettingsPreset[]
    presetsLoading: boolean
    orgMembers: OrgMembership[]
    orgMembersLoading: boolean
    /** Formula rules edited inline in the panel (#11). When the consumer
     *  doesn't pass these, the Formula Columns section is hidden. */
    formulaRules?: FormulaRuleDraft[]
    onFormulaRulesChange?: (rules: FormulaRuleDraft[]) => void
    /** #9 — Strptime patterns the org accepts for dates (e.g.
     *  ["%d/%m/%Y", "%Y.%m.%d"]). Passed through to backend as
     *  preset_overrides.date_formats. */
    dateFormats?: string[]
    onDateFormatsChange?: (formats: string[]) => void
    /** #9 — Where R12 normalizes dates to. strptime pattern or "ISO" |
     *  "DMY" | "MDY" alias. Passed as preset_overrides.target_date_format. */
    targetDateFormat?: string
    onTargetDateFormatChange?: (format: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DQConfigPanel({
    dqPolicy,
    onPolicyChange,
    presetId,
    onPresetChange,
    responsibleUserId,
    onResponsibleUserChange,
    rulesEnabled,
    onRulesChange,
    allowAutofix,
    onAutofixChange,
    presets,
    presetsLoading,
    orgMembers,
    orgMembersLoading,
    formulaRules,
    onFormulaRulesChange,
    dateFormats,
    onDateFormatsChange,
    targetDateFormat,
    onTargetDateFormatChange,
}: DQConfigPanelProps) {
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

    const toggleCategory = (label: string) => {
        setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }))
    }

    const toggleCategoryMaster = (rules: string[], enabled: boolean) => {
        const updated = { ...rulesEnabled }
        for (const r of rules) {
            updated[r] = enabled
        }
        onRulesChange(updated)
    }

    const toggleRule = (ruleId: string) => {
        onRulesChange({ ...rulesEnabled, [ruleId]: !rulesEnabled[ruleId] })
    }

    const getCategoryEnabledCount = (rules: string[]) => {
        return rules.filter(r => rulesEnabled[r] !== false).length
    }

    const isCategoryFullyEnabled = (rules: string[]) => {
        return rules.every(r => rulesEnabled[r] !== false)
    }

    return (
        <div className="space-y-4 border-t border-border/50 pt-4">
            <div>
                <Label className="text-sm font-medium">Data Quality</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                    DQ validation runs on all transferred data
                </p>
            </div>

            {/* ── DQ Policy ─────────────────────────────────────────────── */}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Policy</Label>
                <RadioGroup
                    value={dqPolicy}
                    onValueChange={(v) => onPolicyChange(v as "block_and_notify" | "export_all")}
                    className="gap-2"
                >
                    <label
                        className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                            dqPolicy === "block_and_notify"
                                ? "border-primary/40 bg-primary/5"
                                : "border-border/50 hover:bg-muted/30"
                        )}
                    >
                        <RadioGroupItem value="block_and_notify" className="mt-0.5" />
                        <div>
                            <span className="text-sm font-medium">Block & Notify</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Stop on quarantine, email authorized person for review
                            </p>
                        </div>
                    </label>
                    <label
                        className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                            dqPolicy === "export_all"
                                ? "border-primary/40 bg-primary/5"
                                : "border-border/50 hover:bg-muted/30"
                        )}
                    >
                        <RadioGroupItem value="export_all" className="mt-0.5" />
                        <div>
                            <span className="text-sm font-medium">Export All</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Validate but export regardless, DQ score shown as info badge
                            </p>
                        </div>
                    </label>
                </RadioGroup>
            </div>

            {/* ── Preset Selector ───────────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Preset</Label>
                {presetsLoading ? (
                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading presets...
                    </div>
                ) : (
                    <Select value={presetId} onValueChange={onPresetChange}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Default" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            {presets.map(p => (
                                <SelectItem key={p.preset_id} value={p.preset_id}>
                                    {p.preset_name}
                                    {p.is_default && (
                                        <span className="text-xs text-muted-foreground ml-1">(default)</span>
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* ── Authorized Person (Block & Notify only) ───────────────── */}
            {dqPolicy === "block_and_notify" && (
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Authorized Person</Label>
                    {orgMembersLoading ? (
                        <div className="flex items-center gap-2 h-9 px-3 border rounded-md text-muted-foreground text-sm">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading members...
                        </div>
                    ) : orgMembers.length === 0 ? (
                        <div className="flex items-center h-9 px-3 border rounded-md text-muted-foreground text-xs border-dashed">
                            No organization members found
                        </div>
                    ) : (
                        <Select value={responsibleUserId} onValueChange={onResponsibleUserChange}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select authorized person" />
                            </SelectTrigger>
                            <SelectContent>
                                {orgMembers.map(m => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                        {m.email || m.user_id}
                                        <span className="text-xs text-muted-foreground ml-1">({m.role})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            {/* ── Allow Autofix ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between py-1">
                <div>
                    <Label className="text-xs text-muted-foreground">Allow Autofix</Label>
                    <p className="text-[11px] text-muted-foreground/70">
                        Automatically fix minor issues (whitespace, casing, etc.)
                    </p>
                </div>
                <Switch
                    checked={allowAutofix}
                    onCheckedChange={onAutofixChange}
                />
            </div>

            {/* ── Rule Categories ───────────────────────────────────────── */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rules</Label>
                <div className="space-y-1">
                    {RULE_CATEGORIES.map(cat => {
                        const isOpen = !!openCategories[cat.label]
                        const enabledCount = getCategoryEnabledCount(cat.rules)
                        const allEnabled = isCategoryFullyEnabled(cat.rules)

                        return (
                            <Collapsible
                                key={cat.label}
                                open={isOpen}
                                onOpenChange={() => toggleCategory(cat.label)}
                            >
                                <div className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/20 transition-colors">
                                    <CollapsibleTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex items-center gap-2 flex-1 text-left"
                                        >
                                            <ChevronRight className={cn(
                                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                                isOpen && "rotate-90"
                                            )} />
                                            {cat.icon}
                                            <span className="text-sm font-medium">{cat.label}</span>
                                            <Badge variant="outline" className="text-[10px] ml-auto mr-2">
                                                {enabledCount}/{cat.rules.length}
                                            </Badge>
                                        </button>
                                    </CollapsibleTrigger>
                                    <Switch
                                        checked={allEnabled}
                                        onCheckedChange={(checked) => toggleCategoryMaster(cat.rules, checked)}
                                        className="scale-75"
                                    />
                                </div>
                                <CollapsibleContent>
                                    <div className="ml-5 border-l border-border/30 pl-4 py-1 space-y-0.5">
                                        {cat.rules.map(ruleId => {
                                            const enabled = rulesEnabled[ruleId] !== false
                                            const name = DQ_RULE_NAMES[ruleId] || `Rule ${ruleId}`
                                            return (
                                                <button
                                                    type="button"
                                                    key={ruleId}
                                                    onClick={() => toggleRule(ruleId)}
                                                    className={cn(
                                                        "flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors",
                                                        enabled
                                                            ? "text-foreground hover:bg-muted/30"
                                                            : "text-muted-foreground/50 hover:bg-muted/20"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "h-3 w-3 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors",
                                                        enabled
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground/30"
                                                    )}>
                                                        {enabled && (
                                                            <span className="h-1.5 w-1.5 rounded-sm bg-white" />
                                                        )}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-muted-foreground w-6">{ruleId}</span>
                                                    <span>{name}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )
                    })}
                </div>
            </div>

            {/* ── Date Formats (#9) ────────────────────────────────────────── */}
            {onDateFormatsChange && (
                <DateFormatsSection
                    formats={dateFormats || []}
                    onChange={onDateFormatsChange}
                    targetFormat={targetDateFormat || "ISO"}
                    onTargetChange={onTargetDateFormatChange || (() => {})}
                />
            )}

            {/* ── Formula Columns (#11) ────────────────────────────────────── */}
            {onFormulaRulesChange && (
                <FormulaColumnsSection
                    rules={formulaRules || []}
                    onChange={onFormulaRulesChange}
                />
            )}
        </div>
    )
}


// ─── DateFormatsSection (#9) ────────────────────────────────────────────────

interface DateFormatsSectionProps {
    formats: string[]
    onChange: (formats: string[]) => void
    targetFormat: string
    onTargetChange: (format: string) => void
}

function DateFormatsSection({
    formats,
    onChange,
    targetFormat,
    onTargetChange,
}: DateFormatsSectionProps) {
    const [draft, setDraft] = useState("")

    const addFormat = (pattern: string) => {
        const trimmed = pattern.trim()
        if (!trimmed) return
        if (formats.includes(trimmed)) return
        onChange([...formats, trimmed])
        setDraft("")
    }

    const removeFormat = (idx: number) => {
        const next = formats.slice()
        next.splice(idx, 1)
        onChange(next)
    }

    return (
        <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Date Formats</Label>
                {formats.length > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {formats.length}
                    </Badge>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                Strptime patterns the engine accepts as valid dates. Empty list
                means {`"use the built-in DMY/MDY detector"`}. Values matching
                <span className="font-mono"> any </span>
                listed format are accepted; everything else flags as
                <span className="font-mono"> R-FORMULA-* </span>
                or <span className="font-mono">R14</span>.
            </p>

            {/* Existing formats */}
            {formats.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {formats.map((f, idx) => (
                        <Badge
                            key={`${f}-${idx}`}
                            variant="secondary"
                            className="h-6 gap-1 px-2 font-mono text-[10px]"
                        >
                            {f}
                            <button
                                type="button"
                                onClick={() => removeFormat(idx)}
                                className="ml-0.5 text-muted-foreground hover:text-destructive"
                                title="Remove format"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Quick-pick row */}
            <div className="flex flex-wrap items-center gap-2">
                <Select value="" onValueChange={addFormat}>
                    <SelectTrigger className="h-8 w-72 text-xs">
                        <SelectValue placeholder="Quick-pick a format..." />
                    </SelectTrigger>
                    <SelectContent>
                        {DATE_FORMAT_PRESETS.map((p) => (
                            <SelectItem key={p.pattern} value={p.pattern} className="text-xs">
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Custom strptime pattern"
                    className="h-8 max-w-[220px] font-mono text-xs"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            addFormat(draft)
                        }
                    }}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => addFormat(draft)}
                    disabled={!draft.trim()}
                >
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                </Button>
            </div>

            {/* Target format */}
            <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                <Label className="text-xs text-muted-foreground">Normalize to:</Label>
                <Select value={targetFormat} onValueChange={onTargetChange}>
                    <SelectTrigger className="h-7 w-44 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ISO" className="text-xs">ISO (%Y-%m-%d)</SelectItem>
                        <SelectItem value="DMY" className="text-xs">DMY (%d-%m-%Y)</SelectItem>
                        <SelectItem value="MDY" className="text-xs">MDY (%m-%d-%Y)</SelectItem>
                        {DATE_FORMAT_PRESETS.map((p) => (
                            <SelectItem
                                key={`target-${p.pattern}`}
                                value={p.pattern}
                                className="text-xs"
                            >
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}


// ─── FormulaColumnsSection (#11) ────────────────────────────────────────────
//
// Minimum-viable inline editor: list of rules + add/delete + per-rule
// target/expression/on_error inputs. Validation is light (non-empty
// target + expression with at least one `{...}` placeholder); the
// backend's `parse_formula_rule` is the source of truth — this UI just
// surfaces obvious typos before the user submits.

const PLACEHOLDER_REGEX = /\{[^{}\n]+\}/

interface FormulaColumnsSectionProps {
    rules: FormulaRuleDraft[]
    onChange: (rules: FormulaRuleDraft[]) => void
}

function FormulaColumnsSection({ rules, onChange }: FormulaColumnsSectionProps) {
    const [draftTarget, setDraftTarget] = useState("")
    const [draftExpression, setDraftExpression] = useState("")
    const [error, setError] = useState<string | null>(null)

    const handleAdd = () => {
        const target = draftTarget.trim()
        const expression = draftExpression.trim()
        if (!target) {
            setError("Target column name is required")
            return
        }
        if (!expression) {
            setError("Expression is required")
            return
        }
        if (!PLACEHOLDER_REGEX.test(expression)) {
            setError("Expression must reference at least one column via {column_name}")
            return
        }
        if (rules.some((r) => r.target === target)) {
            setError(`A formula already targets column \`${target}\``)
            return
        }
        onChange([...rules, { target, expression, on_error: "violate" }])
        setDraftTarget("")
        setDraftExpression("")
        setError(null)
    }

    const handleRemove = (idx: number) => {
        const next = rules.slice()
        next.splice(idx, 1)
        onChange(next)
    }

    const handleEditExpression = (idx: number, expression: string) => {
        const next = rules.slice()
        next[idx] = { ...next[idx], expression }
        onChange(next)
    }

    const handleEditOnError = (idx: number, on_error: "violate" | "skip") => {
        const next = rules.slice()
        next[idx] = { ...next[idx], on_error }
        onChange(next)
    }

    return (
        <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm font-medium">Formula Columns</Label>
                {rules.length > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {rules.length}
                    </Badge>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                Synthesise new columns from existing data, e.g.{" "}
                <code className="rounded bg-muted px-1 font-mono text-[10px]">
                    {"{quantity} * {unit_price}"}
                </code>
                . Failed evaluations emit{" "}
                <code className="rounded bg-muted px-1 font-mono text-[10px]">R-FORMULA-*</code>{" "}
                violations.
            </p>

            {/* Existing rules */}
            {rules.length > 0 && (
                <div className="space-y-2">
                    {rules.map((rule, idx) => (
                        <div
                            key={`${rule.target}-${idx}`}
                            className="rounded-md border bg-card/50 p-2 text-xs"
                        >
                            <div className="flex items-start gap-2">
                                <span className="mt-0.5 shrink-0 font-mono font-medium">
                                    {rule.target}
                                </span>
                                <span className="mt-0.5 shrink-0 text-muted-foreground">:=</span>
                                <Textarea
                                    value={rule.expression}
                                    onChange={(e) => handleEditExpression(idx, e.target.value)}
                                    rows={1}
                                    className="min-h-[28px] flex-1 resize-y font-mono text-[11px]"
                                />
                                <Select
                                    value={rule.on_error || "violate"}
                                    onValueChange={(v) =>
                                        handleEditOnError(idx, v as "violate" | "skip")
                                    }
                                >
                                    <SelectTrigger className="h-7 w-24 text-[11px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="violate" className="text-[11px]">
                                            Violate
                                        </SelectItem>
                                        <SelectItem value="skip" className="text-[11px]">
                                            Skip
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleRemove(idx)}
                                    title="Remove formula"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add new rule */}
            <div className="space-y-2 border-t border-border/40 pt-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-start">
                    <Input
                        value={draftTarget}
                        onChange={(e) => setDraftTarget(e.target.value)}
                        placeholder="target_column"
                        className="h-8 md:max-w-[180px] font-mono text-xs"
                    />
                    <Input
                        value={draftExpression}
                        onChange={(e) => setDraftExpression(e.target.value)}
                        placeholder="{quantity} * {unit_price}"
                        className="h-8 flex-1 font-mono text-xs"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                handleAdd()
                            }
                        }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 text-xs"
                        onClick={handleAdd}
                    >
                        <Plus className="mr-1 h-3 w-3" />
                        Add formula
                    </Button>
                </div>
                {error && (
                    <p className="text-[11px] text-destructive">{error}</p>
                )}
            </div>
        </div>
    )
}
