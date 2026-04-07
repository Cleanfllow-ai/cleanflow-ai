"use client"

import { useState } from "react"
import { ChevronRight, Loader2, Shield, ShieldCheck, FileWarning, Globe } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
                                Stop on quarantine, email responsible person for review
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

            {/* ── Responsible Person (Block & Notify only) ──────────────── */}
            {dqPolicy === "block_and_notify" && (
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Responsible Person</Label>
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
                                <SelectValue placeholder="Select responsible person" />
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
        </div>
    )
}
