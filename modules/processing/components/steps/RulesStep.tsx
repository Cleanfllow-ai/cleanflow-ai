"use client"

import React, { useEffect, useRef, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ArrowLeft, Play, ChevronDown, ChevronRight, Plus, Trash2, Sparkles, Loader2, Code, ArrowRight } from "lucide-react"
import { useProcessingWizard, type RuleWithState, type CrossFieldRuleWithState } from "../WizardContext"
import { fileManagementAPI, type CustomRuleDefinition } from "@/modules/files"
import { cn } from "@/shared/lib/utils"
import { getRuleLabel } from "@/shared/lib/dq-rules"
import { deriveRulesV2, CORE_TYPES, TYPE_ALIASES } from "@/shared/lib/type-catalog"

// ── @ mention helpers ──────────────────────────────────────────────────────────

function parseDescriptionTokens(text: string): Array<{ type: 'text' | 'mention'; value: string }> {
  const tokens: Array<{ type: 'text' | 'mention'; value: string }> = []
  const regex = /@\w*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    tokens.push({ type: 'mention', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) })
  return tokens
}

const CROSS_TEXTAREA_STYLE: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  lineHeight: '1.5rem',
  padding: '0.5rem 0.75rem',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
}

export function RulesStep() {
  const {
    uploadId,
    authToken,
    selectedColumns,
    columnProfiles,
    columnCoreTypes,
    columnTypeAliases,
    columnKeyTypes,
    columnNullable,
    setColumnCoreType,
    setColumnTypeAlias,
    setColumnKeyType,
    setColumnNullable,
    crossFieldRules,
    setCrossFieldRules,
    customRules,
    addCustomRule,
    removeCustomRule,
    nextStep,
    prevStep,
    globalRules,
    setGlobalRules,
    columnRules,
    setColumnRules,
  } = useProcessingWizard()

  const [expandedColumns, setExpandedColumns] = useState<string[]>([])
  const [customRuleColumn, setCustomRuleColumn] = useState("")
  const [customRulePrompt, setCustomRulePrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState<CustomRuleDefinition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)

  // AI cross-column rule suggestion state
  const [showCrossRuleForm, setShowCrossRuleForm] = useState(false)
  const [crossRulePrompt, setCrossRulePrompt] = useState("")
  const [isGeneratingCross, setIsGeneratingCross] = useState(false)
  const [pendingCrossRules, setPendingCrossRules] = useState<CrossFieldRuleWithState[] | null>(null)
  const [crossRuleError, setCrossRuleError] = useState<string | null>(null)

  // @ mention state for cross-rule textarea
  const crossTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionQuery, setMentionQuery] = useState("")
  const [showMention, setShowMention] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)

  const filteredMentionCols = useMemo(() => {
    const showAll = !mentionQuery || "all".startsWith(mentionQuery.toLowerCase())
    const base = mentionQuery
      ? selectedColumns.filter((c) => c.toLowerCase().includes(mentionQuery.toLowerCase()))
      : selectedColumns
    const cols = base.slice(0, showAll ? 7 : 8)
    return showAll ? ["all", ...cols] : cols
  }, [selectedColumns, mentionQuery])

  const closeMention = () => { setShowMention(false); setMentionStart(-1); setMentionQuery("") }

  const insertColumn = (colName: string) => {
    if (mentionStart < 0) return
    const before = crossRulePrompt.slice(0, mentionStart)
    const after = crossRulePrompt.slice(mentionStart + 1 + mentionQuery.length)
    const newText = before + "@" + colName + after
    setCrossRulePrompt(newText)
    closeMention()
    setTimeout(() => {
      if (crossTextareaRef.current) {
        const pos = mentionStart + 1 + colName.length
        crossTextareaRef.current.setSelectionRange(pos, pos)
        crossTextareaRef.current.focus()
      }
    }, 0)
  }

  const handleCrossPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setCrossRulePrompt(val)
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length)
      setMentionQuery(atMatch[1])
      setShowMention(true)
      setMentionIndex(0)
    } else {
      closeMention()
    }
  }

  const handleCrossPromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMention && filteredMentionCols.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredMentionCols.length - 1)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertColumn(filteredMentionCols[mentionIndex]); return }
      if (e.key === "Escape") { e.preventDefault(); closeMention(); return }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleGenerateCrossRule()
  }

  useEffect(() => {
    // Seed rules from derived types (catalog) if not already set
    if (selectedColumns.length > 0 && Object.keys(columnRules).length === 0) {
      const defaults: Record<string, RuleWithState[]> = {}
      selectedColumns.forEach((col) => {
        const profile = columnProfiles[col]
        if (!profile) return
        // initialize type state from profile if present
        const core = profile.type_guess || columnCoreTypes[col] || "string"
        if (!columnCoreTypes[col]) {
          setColumnCoreType(col, core)
        }
        if (profile.key_type && !columnKeyTypes[col]) {
          setColumnKeyType(col, profile.key_type as "none" | "primary_key" | "unique")
        }
        if (profile.nullable_suggested !== undefined && columnNullable[col] === undefined) {
          setColumnNullable(col, !!profile.nullable_suggested)
        }
        const rawType = columnTypeAliases[col] || core
        const finalType = (CORE_TYPES as any)[rawType] || (TYPE_ALIASES as any)[rawType] ? rawType : "string"
        const keyType = (columnKeyTypes[col] as "none" | "primary_key" | "unique") || "none"
        const nullable = columnNullable[col] !== undefined ? columnNullable[col] : true
        const derived = deriveRulesV2(finalType, keyType, nullable)
        defaults[col] = derived.rules.map((id) => ({
          rule_id: id,
          rule_name: getRuleLabel(id),
          category: "auto" as const,
          selected: true,
          column: col,
          source: derived.ruleSources[id],
        }))
      })
      setColumnRules(defaults)
      setGlobalRules([]) // keep empty by default
    }
  }, [selectedColumns, columnProfiles, columnCoreTypes, columnTypeAliases, columnKeyTypes, columnNullable])

  const toggleColumnExpand = (col: string) => {
    setExpandedColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]))
  }

  const toggleGlobalRule = (ruleId: string) => {
    setGlobalRules(globalRules.map((r) => (r.rule_id === ruleId ? { ...r, selected: !r.selected } : r)))
  }

  const toggleColumnRule = (column: string, ruleId: string) => {
    const rules = columnRules[column] || []
    setColumnRules({
      ...columnRules,
      [column]: rules.map((r) => (r.rule_id === ruleId ? { ...r, selected: !r.selected } : r)),
    })
  }

  const handleTypeChange = (column: string, core: string, alias: string | null, key: "none" | "primary_key" | "unique", nullable: boolean) => {
    setColumnCoreType(column, core)
    setColumnTypeAlias(column, alias)
    setColumnKeyType(column, key)
    setColumnNullable(column, nullable)
    const rawType = alias || core
    const finalType = (CORE_TYPES as any)[rawType] || (TYPE_ALIASES as any)[rawType] ? rawType : "string"
    const derived = deriveRulesV2(finalType, key, nullable)
    setColumnRules({
      ...columnRules,
      [column]: derived.rules.map((id) => ({
        rule_id: id,
        rule_name: getRuleLabel(id),
        category: "auto" as const,
        selected: true,
        column,
        source: derived.ruleSources[id],
      })),
    })
  }

  const handleGenerateCustomRule = async () => {
    if (!customRuleColumn || !customRulePrompt.trim() || !authToken) return
    setIsGenerating(true)
    setError(null)
    setRawResponse(null)
    try {
      const response = await fileManagementAPI.suggestCustomRule(uploadId, authToken, {
        column: customRuleColumn,
        prompt: customRulePrompt.trim(),
      })
      if (response?.raw_response) {
        const raw = typeof response.raw_response === "string" ? response.raw_response : JSON.stringify(response.raw_response, null, 2)
        setRawResponse(raw)
      }
      if (response?.error || !response?.suggestion) {
        setError(response?.error || "CleanAI did not return a usable rule. Please adjust the prompt.")
        setPendingSuggestion(null)
        return
      }
      setPendingSuggestion(response.suggestion)
    } catch (err: any) {
      setError(err.message || "Failed to generate rule")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApproveCustomRule = () => {
    if (!pendingSuggestion) return
    const ruleId = pendingSuggestion.rule_id || `CUST_${Date.now().toString(36)}`
    addCustomRule({
      ...pendingSuggestion,
      rule_id: ruleId,
      column: customRuleColumn,
    })
    setPendingSuggestion(null)
    setCustomRulePrompt("")
  }

  const handleGenerateCrossRule = async () => {
    if (!crossRulePrompt.trim() || !authToken) return
    setIsGeneratingCross(true)
    setCrossRuleError(null)
    setPendingCrossRules(null)
    try {
      const response = await fileManagementAPI.suggestCrossColumnRule(uploadId, authToken, {
        prompt: crossRulePrompt.trim(),
        columns: /@all\b/i.test(crossRulePrompt)
          ? []
          : Array.from(new Set((crossRulePrompt.match(/@(\S+)/g) ?? []).map((m) => m.slice(1)).filter((c) => selectedColumns.includes(c)))),
      })
      const rules: CrossFieldRuleWithState[] = (response?.rules ?? []).map((r) => ({
        rule_id: r.rule_id,
        cols: r.cols,
        relationship: r.relationship,
        condition: r.condition,
        predicate: r.predicate,
        tolerance: r.tolerance,
        confidence: r.confidence,
        reasoning: r.reasoning,
        enabled: true,
      }))
      if (rules.length === 0) {
        setCrossRuleError("CleanAI could not find a matching cross-column rule. Try a more specific description.")
      } else {
        setPendingCrossRules(rules)
      }
    } catch (err: unknown) {
      setCrossRuleError(err instanceof Error ? err.message : "Failed to generate cross-column rule")
    } finally {
      setIsGeneratingCross(false)
    }
  }

  const handleApproveCrossRules = () => {
    if (!pendingCrossRules) return
    // Merge: skip any rule that is already in crossFieldRules (same rule_id + cols)
    const existing = new Set(crossFieldRules.map((r) => `${r.rule_id}:${r.cols.join(",")}`))
    const toAdd = pendingCrossRules.filter((r) => !existing.has(`${r.rule_id}:${r.cols.join(",")}`))
    setCrossFieldRules([...crossFieldRules, ...toAdd])
    setPendingCrossRules(null)
    setCrossRulePrompt("")
    closeMention()
    setShowCrossRuleForm(false)
  }

  const canProceed = true // rules optional

  // Calculate rule statistics
  const totalAutoRules = Object.values(columnRules).flat().filter(r => r.category === "auto").length
  const totalSelectedRules = Object.values(columnRules).flat().filter(r => r.selected).length
  const totalCustomRules = customRules.length
  const totalCrossRules = crossFieldRules.length
  const totalSelectedCrossRules = crossFieldRules.filter((r) => r.enabled).length

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Rule Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure which rules to apply during processing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            AI: {totalAutoRules}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Custom: {totalCustomRules}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Cross: {totalSelectedCrossRules}/{totalCrossRules}
          </Badge>
          <Badge variant="default" className="text-xs">
            Selected: {totalSelectedRules + totalCustomRules + totalSelectedCrossRules}
          </Badge>
        </div>
      </div>

      {/* Main content area with internal scrolling */}
      <div className="border border-muted rounded-lg overflow-hidden flex-1 min-h-0 mt-6">
        <div className="h-full overflow-y-auto p-4">
          <div className="space-y-3">
            <div className="border border-muted rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Cross-column Rules</h3>
                <div className="flex items-center gap-2">
                  {totalCrossRules > 0 && (
                    <Badge variant="outline" className="text-xs">{totalSelectedCrossRules}/{totalCrossRules} enabled</Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setShowCrossRuleForm(true); setPendingCrossRules(null); setCrossRuleError(null); closeMention() }}
                  >
                    <Sparkles className="w-3 h-3" />
                    Add AI Rule
                  </Button>
                </div>
              </div>

              {/* Existing rules */}
              {crossFieldRules.length > 0 && (
                <div className="space-y-2 mb-3">
                  {crossFieldRules.map((rule) => (
                    <div
                      key={rule.rule_id + rule.cols.join(".")}
                      className="p-2 rounded border border-muted/60 bg-muted/20"
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={rule.enabled}
                          onCheckedChange={() =>
                            setCrossFieldRules(
                              crossFieldRules.map((item) =>
                                item.rule_id === rule.rule_id && item.cols.join(".") === rule.cols.join(".")
                                  ? { ...item, enabled: !item.enabled }
                                  : item
                              )
                            )
                          }
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{rule.rule_id}</span>
                            {rule.relationship && <Badge variant="secondary" className="text-[10px]">{rule.relationship}</Badge>}
                            {rule.confidence !== undefined && (
                              <Badge variant="outline" className="text-[10px]">{Math.round((rule.confidence || 0) * 100)}%</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {rule.condition || rule.predicate || "No condition provided"}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.cols.map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setCrossFieldRules(crossFieldRules.filter((r) => !(r.rule_id === rule.rule_id && r.cols.join(".") === rule.cols.join("."))))}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {crossFieldRules.length === 0 && !showCrossRuleForm && (
                <p className="text-xs text-muted-foreground">No cross-column rules detected. Click &quot;Add AI Rule&quot; to describe one.</p>
              )}

              {/* AI cross-rule suggestion form */}
              {showCrossRuleForm && (
                <div className="border border-dashed border-muted rounded-md p-3 space-y-3 mt-1">
                  <p className="text-xs text-muted-foreground font-medium">Describe the cross-column rule in plain language:</p>

                  {/* Textarea with @ mention highlight overlay */}
                  <div className="relative rounded-lg border border-violet-200 bg-violet-50/40 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-violet-400 focus-within:bg-white">
                    {/* Mirror div — highlight backgrounds only */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none"
                      style={CROSS_TEXTAREA_STYLE}
                    >
                      {parseDescriptionTokens(crossRulePrompt).map((token, i) =>
                        token.type === "mention" ? (
                          <mark key={i} style={{ background: "rgb(221 214 254 / 0.8)", color: "transparent", borderRadius: "4px", padding: "1px 3px" }}>
                            {token.value}
                          </mark>
                        ) : (
                          <span key={i} style={{ color: "transparent" }}>{token.value}</span>
                        )
                      )}
                      <span style={{ color: "transparent" }}>{"\u200b"}</span>
                    </div>

                    {/* Real textarea */}
                    <textarea
                      ref={crossTextareaRef}
                      value={crossRulePrompt}
                      onChange={handleCrossPromptChange}
                      onKeyDown={handleCrossPromptKeyDown}
                      onBlur={() => setTimeout(closeMention, 150)}
                      placeholder={`e.g. CREATED_TS must be before UPDATED_TS — type @ to insert a column`}
                      rows={2}
                      className="relative w-full bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground/50"
                      style={{ ...CROSS_TEXTAREA_STYLE, caretColor: "currentColor" }}
                    />

                    {/* @ mention dropdown */}
                    {showMention && filteredMentionCols.length > 0 && (
                      <div className="absolute left-0 z-50 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/50">
                          <span className="text-[11px] font-semibold text-violet-600 bg-violet-100 rounded px-1 leading-5">@</span>
                          <span className="text-[11px] text-muted-foreground">
                            {mentionQuery ? `Columns matching "${mentionQuery}"` : "Insert column name"}
                          </span>
                          <span className="ml-auto text-[10px] text-muted-foreground/60">↑↓ · ↵ insert</span>
                        </div>
                        <div className="max-h-[140px] overflow-y-auto py-0.5">
                          {filteredMentionCols.map((col, idx) => (
                            <button
                              key={col}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); insertColumn(col) }}
                              className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors ${
                                idx === mentionIndex
                                  ? "bg-violet-50 text-violet-700"
                                  : "hover:bg-muted/60"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${idx === mentionIndex ? "bg-violet-500" : "bg-muted-foreground/30"}`} />
                              {col === "all" ? <span className="text-violet-600 font-semibold not-italic">all <span className="font-normal text-muted-foreground">— all columns</span></span> : col}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px] font-mono">@</kbd> to insert a column name · Cmd/Ctrl+Enter to generate
                  </p>

                  {/* Pending suggestions */}
                  {pendingCrossRules && pendingCrossRules.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Suggested rules — approve to add:</p>
                      {pendingCrossRules.map((rule, i) => (
                        <div key={i} className="p-2 rounded border border-primary/30 bg-primary/5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{rule.rule_id}</span>
                            {rule.relationship && <Badge variant="secondary" className="text-[10px]">{rule.relationship}</Badge>}
                            {rule.confidence !== undefined && (
                              <Badge variant="outline" className="text-[10px]">{Math.round((rule.confidence || 0) * 100)}%</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{rule.condition || rule.predicate}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.cols.map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                          {rule.reasoning && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">{rule.reasoning}</p>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleApproveCrossRules}>
                          Add {pendingCrossRules.length === 1 ? "Rule" : `${pendingCrossRules.length} Rules`}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPendingCrossRules(null)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {crossRuleError && <p className="text-sm text-destructive">{crossRuleError}</p>}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleGenerateCrossRule()}
                      disabled={isGeneratingCross || !crossRulePrompt.trim()}
                    >
                      {isGeneratingCross ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Generate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowCrossRuleForm(false); setPendingCrossRules(null); setCrossRuleError(null); setCrossRulePrompt(""); closeMention() }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <h3 className="font-medium">Column Rules</h3>
            {selectedColumns.length === 0 && (
              <p className="text-sm text-muted-foreground">Select columns and profile them to see suggested rules.</p>
            )}
            {selectedColumns.map((col) => {
              const isExpanded = expandedColumns.includes(col)
              const rules = columnRules[col] || []
              const columnCustomRules = customRules.filter((r) => r.column === col)
              const autoCount = rules.filter(r => r.category === "auto").length
              const selectedCount = rules.filter((r) => r.selected).length + columnCustomRules.length
          return (
            <Collapsible key={col} open={isExpanded} onOpenChange={() => toggleColumnExpand(col)}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-md border border-muted hover:bg-muted/30">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-medium">{col}</span>
                <div className="text-xs text-muted-foreground ml-2">
                  {columnKeyTypes[col] && columnKeyTypes[col] !== "none" ? columnKeyTypes[col] : "type"} | {columnCoreTypes[col] || columnProfiles[col]?.type_guess}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">AI:{autoCount}</Badge>
                  <Badge variant="outline" className="text-xs">C:{columnCustomRules.length}</Badge>
                  <Badge variant="default" className="text-xs">S:{selectedCount}</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 ml-6 space-y-3">
                    {rules.length === 0 && columnCustomRules.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No suggested rules for this column. You can add custom rules below.
                      </div>
                    )}
                    {rules.filter((r) => r.category === "auto").length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">AI Rules (recommended)</p>
                        <div className="space-y-1">
                          {rules
                            .filter((r) => r.category === "auto")
                            .map((rule) => (
                              <div
                                key={rule.rule_id}
                                onClick={() => toggleColumnRule(col, rule.rule_id)}
                                className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer"
                              >
                                <Checkbox checked={rule.selected} />
                                <span className="text-sm">
                                  {rule.rule_name}
                                  {rule.source && <span className="ml-1 text-[10px] text-muted-foreground">({rule.source})</span>}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {columnCustomRules.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Custom Rules</p>
                        <div className="space-y-2">
                          {columnCustomRules.map((rule) => (
                            <div key={rule.rule_id} className="flex items-start gap-2 p-2 rounded border border-muted">
                              <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                              <div className="flex-1">
                                <span className="text-sm font-medium">{rule.rule_name}</span>
                                {rule.code && (
                                  <details className="mt-1">
                                    <summary className="text-xs text-primary cursor-pointer">
                                      <Code className="w-3 h-3 inline mr-1" />
                                      View Code
                                    </summary>
                                    <pre className="mt-1 p-2 bg-zinc-900 text-green-400 text-xs rounded overflow-x-auto">
                                      {rule.code}
                                    </pre>
                                  </details>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCustomRule(rule.rule_id!)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {customRuleColumn === col ? (
                      <div className="p-3 border border-dashed border-muted rounded-md space-y-3">
                        <Textarea value={customRulePrompt} onChange={(e) => setCustomRulePrompt(e.target.value)} placeholder="Describe your rule in natural language..." rows={2} />
                    {pendingSuggestion && (
                      <div className="p-2 border border-primary/30 rounded bg-primary/5">
                        <div className="font-medium text-sm">{pendingSuggestion.rule_name}</div>
                        <p className="text-xs text-muted-foreground">{pendingSuggestion.explanation}</p>
                        <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={handleApproveCustomRule}>
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPendingSuggestion(null)}>
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        {rawResponse && (
                          <div className="text-xs bg-muted/40 border rounded p-2 max-h-32 overflow-y-auto text-muted-foreground">
                            <div className="font-medium text-foreground mb-1">CleanAI raw response</div>
                            <pre className="whitespace-pre-wrap break-all">{rawResponse}</pre>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleGenerateCustomRule} disabled={isGenerating || !customRulePrompt.trim()}>
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Generate Rule
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setCustomRuleColumn("")}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setCustomRuleColumn(col)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Custom Rule
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer with navigation buttons - fixed at bottom */}
      <div className="flex items-center justify-between pt-4 border-t border-muted/40 mt-6">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed}>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
