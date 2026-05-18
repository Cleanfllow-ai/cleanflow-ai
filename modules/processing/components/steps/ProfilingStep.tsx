"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, ArrowRight, RefreshCw, Check, X, Layers, Database, ChevronRight, Sparkles } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useProcessingWizard } from "../WizardContext"
import { fileManagementAPI } from "@/modules/files"
import { getRuleLabel } from "@/shared/lib/dq-rules"

// Map a cross-field rule_id to a human title + a Tailwind colour stripe.
// The stripe groups visually-similar checks so a 19-rule list is scannable
// instead of a wall of repetition.
const RULE_META: Record<string, { title: string; stripe: string; label: string }> = {
  non_negative:        { title: "Non-negative",        stripe: "before:bg-emerald-400", label: "text-emerald-700 dark:text-emerald-400" },
  pct_of:              { title: "Percentage of",       stripe: "before:bg-sky-400",     label: "text-sky-700 dark:text-sky-400" },
  mutual_exclusion:    { title: "Mutually exclusive",  stripe: "before:bg-amber-400",   label: "text-amber-700 dark:text-amber-400" },
  date_order:          { title: "Date order",          stripe: "before:bg-violet-400",  label: "text-violet-700 dark:text-violet-400" },
  sum_of:              { title: "Sum of",              stripe: "before:bg-sky-400",     label: "text-sky-700 dark:text-sky-400" },
  conditional:         { title: "Conditional",         stripe: "before:bg-rose-400",    label: "text-rose-700 dark:text-rose-400" },
  range:               { title: "Range",               stripe: "before:bg-indigo-400",  label: "text-indigo-700 dark:text-indigo-400" },
}
function getRuleMeta(rule_id: string) {
  return RULE_META[rule_id] || {
    title: rule_id.replace(/_/g, " "),
    stripe: "before:bg-muted-foreground/40",
    label: "text-foreground",
  }
}

export function ProfilingStep() {
  const {
    uploadId,
    authToken,
    selectedColumns,
    setSelectedColumns,
    columnProfiles,
    setColumnProfiles,
    requiredColumns,
    setRequiredColumns,
    allColumns,
    prevStep,
    nextStep,
    crossFieldRules,
    setCrossFieldRules,
    setColumnKeyType,
    setColumnNullable,
    setBackendVersion,
    fileStructure,
    setFileStructure,
    schemaMatch,
    setSchemaMatch,
    objectModel,
    setObjectModel,
    rowTypes,
    setRowTypes,
  } = useProcessingWizard()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeColumn, setActiveColumn] = useState<string | null>(null)
  const [bcrExpanded, setBcrExpanded] = useState(true)
  const pollRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  useEffect(() => {
    if (selectedColumns.length > 0 && Object.keys(columnProfiles).length === 0 && authToken) {
      fetchProfiling()
    }
  }, [selectedColumns, authToken])

  const fetchProfiling = async (forceRefresh: boolean = false) => {
    if (!authToken) return
    setLoading(true)
    setError(null)
    if (pollRef.current) clearTimeout(pollRef.current)
    try {
      const response = await fileManagementAPI.getColumnProfilingPreview(uploadId, authToken, selectedColumns, 200, forceRefresh)
      const profiles = (response as any)?.profiles || (response as any)?.column_profiles || {}
      if (profiles && Object.keys(profiles).length > 0) {
        setColumnProfiles(profiles)
        setLoading(false)
      } else {
        // Backend may still be computing (LLM calls for many columns).
        // Poll every 2s until profiles arrive, up to ~2 minutes.
        // RC-K (2026-05-18, W1 v12 C08): cap retries at 60 (2 min) so the
        // wizard doesn't hang forever when the BE silently returns empty
        // (e.g. malformed fixture columns).  Next is no longer gated on
        // hasProfiles so the user can still proceed once loading clears.
        setLoading(true)
        let attempts = 0
        const poll = async () => {
          attempts++
          if (attempts > 60) {  // 60 × 2s = 2 min
            setError("Profiling preview unavailable — you can proceed without it.")
            setLoading(false)
            return
          }
          try {
            const retry = await fileManagementAPI.getColumnProfilingPreview(uploadId, authToken!, selectedColumns, 200)
            const retryProfiles = (retry as any)?.profiles || (retry as any)?.column_profiles || {}
            if (retryProfiles && Object.keys(retryProfiles).length > 0) {
              applyProfilingResponse(retry)
              setLoading(false)
              return
            }
          } catch { /* ignore, retry */ }
          pollRef.current = setTimeout(poll, 2000)
        }
        pollRef.current = setTimeout(poll, 2000)
        return
      }
      applyProfilingResponse(response)
    } catch (err: any) {
      setError(err.message || "Failed to fetch profiling data")
      setLoading(false)
    }
  }

  const applyProfilingResponse = (response: any) => {
    const profiles = response?.profiles || response?.column_profiles || {}
    if (profiles && Object.keys(profiles).length > 0) {
      setColumnProfiles(profiles)
    }
    const inferredRequired = response?.required_columns
    if (Array.isArray(inferredRequired) && inferredRequired.length > 0) {
      setRequiredColumns(inferredRequired)
    }
    const summary = response?.summary || {}
    setBackendVersion(summary.backend_version)
    const cfr = response?.cross_field_rules || []
    setCrossFieldRules(cfr.map((r: any) => ({ ...r, enabled: true })))
    Object.entries(profiles).forEach(([col, p]: [string, any]) => {
      if (p.key_type) setColumnKeyType(col, p.key_type)
      if (p.nullable_suggested !== undefined) setColumnNullable(col, p.nullable_suggested)
    })
    if (response?.file_structure) setFileStructure(response.file_structure)
    if (response?.schema_match) setSchemaMatch(response.schema_match)
    if (response?.object_model) setObjectModel(response.object_model)
    if (response?.row_types) setRowTypes(response.row_types)
  }

  const toggleColumnSelection = (col: string) => {
    setSelectedColumns((prev) => {
      if (prev.includes(col)) {
        return prev.filter((c) => c !== col)
      }
      if (!columnProfiles[col]) {
        profileSingle(col)
      }
      return [...prev, col]
    })
  }

  const profileSingle = async (column: string) => {
    if (!authToken) return
    try {
      const response = await fileManagementAPI.getColumnProfilingPreview(uploadId, authToken, [column], 200)
      const profiles = (response as any)?.profiles || (response as any)?.column_profiles || {}
      if (profiles?.[column]) {
        setColumnProfiles(prev => ({
          ...prev,
          [column]: profiles[column],
        }))
      }
    } catch (err) {
      console.error("Failed to profile column", column, err)
    }
  }

  const hasProfiles = Object.keys(columnProfiles).length > 0
  // RC-K (2026-05-18, W1 v12 C08): allow the user to proceed even if
  // profiling is still in-flight or returned no data after the first call.
  // Previously, fixtures with intentionally-malformed values (C08's
  // invoice_id: INVOICE-..., INV-202613-...) caused the polling loop to
  // never resolve, leaving Next disabled indefinitely.  The wizard's
  // SettingsStep + RulesStep + processing path do NOT depend on
  // columnProfiles, so gating Next on `hasProfiles` is overly strict.
  // We still BLOCK on `selectedColumns.length > 0` (the genuine pre-cond).
  const canProceed = selectedColumns.length > 0

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Column Profiling</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review data types and quality metrics for selected columns
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchProfiling(true)} disabled={loading || !authToken} className="shrink-0">
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          {loading ? "Profiling…" : "Refresh"}
        </Button>
      </div>

      {/* Main content area with three separate scrollable boxes */}
      <div className="flex gap-4 flex-1 min-h-0 mt-6">
        {/* Left sidebar - Column list */}
        <div className="w-64 lg:w-72 shrink-0 border border-muted rounded-lg flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b border-muted/40 bg-muted/20">
            <h3 className="font-medium text-sm leading-none">Columns</h3>
            <p className="text-[11px] text-muted-foreground mt-1.5">Click to toggle selection</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-0.5">
              {allColumns.map((col) => {
                const isSelected = selectedColumns.includes(col)
                const hasProfile = !!columnProfiles[col]
                const isActive = activeColumn === col
                return (
                  <div
                    key={col}
                    onClick={() => {
                      toggleColumnSelection(col)
                      setActiveColumn(col)
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-sm min-w-0",
                      isActive && "bg-primary/10 border-l-2 border-primary pl-[calc(0.625rem-2px)]",
                      !isActive && isSelected && "bg-muted/50 hover:bg-muted/70",
                      !isActive && !isSelected && "hover:bg-muted/30 opacity-60"
                    )}
                  >
                    {isSelected
                      ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      : <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <span className="break-words flex-1 min-w-0" title={col}>{col}</span>
                    {!hasProfile && isSelected && <Loader2 className="w-3 h-3 animate-spin shrink-0 text-muted-foreground" />}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="px-3 py-2 border-t border-muted/40 text-[11px] text-muted-foreground bg-muted/20">
            <span className="font-medium text-foreground">{selectedColumns.length}</span> of {allColumns.length} selected
          </div>
        </div>

        {/* Main content - Profiling results */}
        <div className="flex-1 min-w-0 border border-muted rounded-lg overflow-hidden @container">
          <div className="h-full overflow-y-auto p-4">
            {loading && !hasProfiles ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Profiling…</span>
              </div>
            ) : error ? (
              <div className="text-center text-destructive p-8">
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchProfiling()}>
                  Retry
                </Button>
              </div>
            ) : !hasProfiles ? (
              <div className="text-center text-muted-foreground p-8">
                No profiling data returned. Refresh or adjust column selection.
              </div>
            ) : (
              <div className="grid grid-cols-1 @[480px]:grid-cols-2 @[820px]:grid-cols-3 gap-3">
                {selectedColumns.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground">No columns selected for profiling</p>
                    <p className="text-sm text-muted-foreground mt-2">Go back to select columns</p>
                  </div>
                ) : selectedColumns.map((col) => {
                    const profile = columnProfiles[col]
                    if (!profile) return null
                    const autoRules = (profile.rules || []).filter((r: any) => r.decision === "auto")
                    const nullPct = (profile.null_rate * 100).toFixed(1)
                    const uniquePct = profile.unique_ratio !== undefined ? (profile.unique_ratio * 100).toFixed(1) : null
                    return (
                      <div
                        key={col}
                        className={cn(
                          "group border border-muted rounded-lg p-3 space-y-3 min-w-0 cursor-pointer transition-colors hover:border-muted-foreground/30",
                          activeColumn === col && "border-primary ring-1 ring-primary/20"
                        )}
                        onClick={() => setActiveColumn(col)}
                      >
                        {/* Header: name + type */}
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-start gap-1.5 min-w-0">
                            <h4 className="font-medium text-sm leading-snug break-words flex-1 min-w-0" title={col}>{col}</h4>
                            {profile.key_type === "primary_key" && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 shrink-0">PK</Badge>
                            )}
                            {profile.key_type === "unique" && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">UNIQUE</Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                            {profile.type_guess}
                          </Badge>
                        </div>

                        {/* Stats: stacked label-above-value (no overlap on narrow cards) */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Null rate</p>
                            <p className={cn(
                              "text-sm font-semibold tabular-nums",
                              profile.null_rate > 0.1 ? "text-amber-600 dark:text-yellow-500" : "text-emerald-600 dark:text-green-500"
                            )}>
                              {nullPct}%
                            </p>
                          </div>
                          {uniquePct !== null && (
                            <div className="space-y-0.5">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unique</p>
                              <p className="text-sm font-semibold tabular-nums text-foreground">
                                {uniquePct}%
                              </p>
                            </div>
                          )}
                        </div>

                        {/* AI Rules */}
                        {autoRules.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-muted/60">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">AI rules</p>
                            <div className="flex flex-wrap gap-1">
                              {autoRules.map((r: any, idx: number) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal max-w-full"
                                >
                                  <span className="truncate">{getRuleLabel(r.rule_id)}</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Schema Intelligence Panel (V2) */}
            {hasProfiles && (fileStructure || schemaMatch) && (
              <div className="mt-4 border border-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h3 className="font-medium text-sm">File Structure Analysis</h3>
                </div>

                {fileStructure && (
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Pattern:</span>
                      <Badge variant={fileStructure.is_complex ? "default" : "secondary"}>
                        {fileStructure.pattern}
                      </Badge>
                    </div>
                    {fileStructure.object_prefixes && fileStructure.object_prefixes.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Objects:</span>
                        <div className="flex gap-1">
                          {fileStructure.object_prefixes.map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {fileStructure.discriminator_col && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Discriminator:</span>
                        <Badge variant="outline" className="text-[10px]">{fileStructure.discriminator_col}</Badge>
                      </div>
                    )}
                    {fileStructure.child_indicator && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Child Rows:</span>
                        <Badge variant="outline" className="text-[10px]">{fileStructure.child_indicator}</Badge>
                      </div>
                    )}
                  </div>
                )}

                {schemaMatch && (
                  <div className="flex items-center gap-3 text-sm p-2 rounded bg-primary/5 border border-primary/20">
                    <Database className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Matched Schema:</span>
                    <span className="font-medium">{schemaMatch.schema_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{schemaMatch.domain}</Badge>
                  </div>
                )}

                {rowTypes && rowTypes.total_types > 1 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Row Types: </span>
                    <span className="flex gap-2 mt-1 flex-wrap">
                      {Object.entries(rowTypes.row_types).map(([type, count]) => (
                        <Badge key={type} variant="outline" className="text-[10px]">
                          {type}: {count} rows
                        </Badge>
                      ))}
                    </span>
                  </div>
                )}

                {objectModel && Object.keys(objectModel.objects).length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Business Objects: </span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {Object.entries(objectModel.objects).map(([name, obj]) => (
                        <Badge key={name} variant="outline" className="text-[10px]">
                          {name} ({obj.field_count} fields)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right rail - Business Consistency Rules (always visible, glance-and-go) */}
        {hasProfiles && (
          <div
            className={cn(
              "border border-muted rounded-lg flex flex-col overflow-hidden transition-[width] duration-200 shrink-0",
              bcrExpanded ? "w-80" : "w-10"
            )}
          >
            <button
              type="button"
              onClick={() => setBcrExpanded((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 border-b border-muted/40 bg-muted/20 hover:bg-muted/30 transition-colors text-left",
                !bcrExpanded && "justify-center px-0"
              )}
              aria-expanded={bcrExpanded}
              aria-label={bcrExpanded ? "Collapse business consistency rules" : "Expand business consistency rules"}
            >
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              {bcrExpanded ? (
                <>
                  <h3 className="font-medium text-sm flex-1 truncate leading-none">Business Consistency Rules</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{crossFieldRules.length}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
                </>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{crossFieldRules.length}</Badge>
              )}
            </button>

            {bcrExpanded && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">CleanAI suggested</span>
                </div>
                {crossFieldRules.length === 0 ? (
                  <p className="px-3 pb-3 text-sm text-muted-foreground">
                    No business consistency rules returned by CleanAI
                  </p>
                ) : (
                  <div className="px-2 pb-3 space-y-2">
                    {(() => {
                      // Group consecutive rules by rule_id so repetitive families
                      // (e.g. 4× non_negative) collapse into one card.
                      const groups: { rule_id: string; rules: typeof crossFieldRules }[] = []
                      for (const r of crossFieldRules) {
                        const last = groups[groups.length - 1]
                        if (last && last.rule_id === r.rule_id) last.rules.push(r)
                        else groups.push({ rule_id: r.rule_id, rules: [r] })
                      }
                      return groups.map((group, gi) => {
                        const meta = getRuleMeta(group.rule_id)
                        const isMulti = group.rules.length > 1
                        return (
                          <div
                            key={gi}
                            className={cn(
                              "relative border border-muted rounded-md overflow-hidden hover:border-muted-foreground/30 transition-colors min-w-0",
                              "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-md",
                              meta.stripe
                            )}
                          >
                            <div className="pl-3 pr-2.5 py-2.5 space-y-2">
                              {/* Header: friendly rule label + count */}
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className={cn("text-[12px] font-semibold leading-tight truncate", meta.label)}>
                                  {meta.title}
                                </span>
                                {isMulti && (
                                  <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                                    × {group.rules.length}
                                  </span>
                                )}
                                <span className="flex-1" />
                                <code
                                  className="text-[9.5px] text-muted-foreground/70 font-mono shrink-0 hidden sm:inline"
                                  title={group.rule_id}
                                >
                                  {group.rule_id}
                                </code>
                              </div>

                              {/* Conditions — the hero of the card */}
                              <ul className={cn("space-y-2", isMulti && "list-none")}>
                                {group.rules.map((rule, ri) => (
                                  <li key={ri} className="space-y-1.5">
                                    <p className="font-mono text-[11.5px] leading-relaxed text-foreground/90 break-words">
                                      {rule.condition || rule.predicate}
                                    </p>
                                    {rule.cols && rule.cols.length > 0 && (
                                      <div className="flex gap-1 flex-wrap">
                                        {rule.cols.map((c: string) => (
                                          <Badge
                                            key={c}
                                            variant="outline"
                                            className="text-[10px] px-1.5 py-0 h-4 font-normal max-w-full bg-muted/30"
                                          >
                                            <span className="truncate">{c}</span>
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    {isMulti && ri < group.rules.length - 1 && (
                                      <div className="border-b border-dashed border-muted/60 pt-1" />
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            )}

            {!bcrExpanded && (
              <div className="flex-1 flex items-start justify-center pt-3">
                <span
                  className="text-[10px] text-muted-foreground tracking-wider"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Business Rules
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Required columns info */}
      {requiredColumns.length > 0 && (
        <div className="px-4 py-3 bg-muted/30 border border-muted rounded-lg">
          <div className="text-sm">
            <span className="text-muted-foreground">Required Columns: </span>
            <span className="font-medium">{requiredColumns.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Footer with navigation buttons - fixed at bottom */}
      <div className="flex items-center justify-between pt-4 border-t border-muted/40 mt-6">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={nextStep} disabled={!canProceed}>
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
