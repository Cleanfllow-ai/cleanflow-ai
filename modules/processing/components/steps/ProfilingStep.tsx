"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, ArrowRight, RefreshCw, Check, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useProcessingWizard } from "../WizardContext"
import { fileManagementAPI } from "@/modules/files"
import { getRuleLabel } from "@/shared/lib/dq-rules"

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
  } = useProcessingWizard()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeColumn, setActiveColumn] = useState<string | null>(null)

  useEffect(() => {
    if (selectedColumns.length > 0 && Object.keys(columnProfiles).length === 0 && authToken) {
      fetchProfiling()
    }
  }, [selectedColumns, authToken])

  const fetchProfiling = async () => {
    if (!authToken) return
    setLoading(true)
    setError(null)
    try {
      const response = await fileManagementAPI.getColumnProfilingPreview(uploadId, authToken, selectedColumns, 200)
      const profiles = (response as any)?.profiles || (response as any)?.column_profiles || {}
      if (profiles && Object.keys(profiles).length > 0) {
        setColumnProfiles(profiles)
      }
      const inferredRequired = (response as any)?.required_columns
      if (Array.isArray(inferredRequired) && inferredRequired.length > 0) {
        setRequiredColumns(inferredRequired)
      }

      // Store backend version
      const summary = (response as any)?.summary || {}
      setBackendVersion(summary.backend_version)

      // Store cross-field rules from CleanAI
      const cfr = (response as any)?.cross_field_rules || []
      setCrossFieldRules(cfr.map((r: any) => ({ ...r, enabled: true })))

      // Store key_type and nullable into wizard state
      Object.entries(profiles).forEach(([col, p]: [string, any]) => {
        if (p.key_type) setColumnKeyType(col, p.key_type)
        if (p.nullable_suggested !== undefined) setColumnNullable(col, p.nullable_suggested)
      })
    } catch (err: any) {
      setError(err.message || "Failed to fetch profiling data")
    } finally {
      setLoading(false)
    }
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
        setColumnProfiles({
          ...columnProfiles,
          [column]: profiles[column],
        })
      }
    } catch (err) {
      console.error("Failed to profile column", column, err)
    }
  }

  const hasProfiles = Object.keys(columnProfiles).length > 0
  const canProceed = selectedColumns.length > 0 && hasProfiles && !loading

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Column Profiling</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review data types and quality metrics for selected columns
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProfiling} disabled={loading || !authToken}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Main content area with two separate scrollable boxes */}
      <div className="flex gap-4 flex-1 min-h-0 mt-6">
        {/* Left sidebar - Column list (separate box with internal scrolling) */}
        <div className="w-64 border border-muted rounded-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-muted/40 bg-muted/20">
            <h3 className="font-medium text-sm">Columns</h3>
            <p className="text-xs text-muted-foreground mt-1">Click to toggle selection</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1">
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
                      "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm",
                      isActive && "bg-primary/10 border-l-2 border-primary",
                      !isActive && isSelected && "bg-muted/50",
                      !isActive && !isSelected && "hover:bg-muted/30 opacity-60"
                    )}
                  >
                    {isSelected ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <X className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="truncate">{col}</span>
                    {!hasProfile && isSelected && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="p-3 border-t border-muted/40 text-xs text-muted-foreground bg-muted/20">
            {selectedColumns.length} of {allColumns.length} selected
          </div>
        </div>

        {/* Main content - Profiling results (separate box with internal scrolling) */}
        <div className="flex-1 border border-muted rounded-lg overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {loading && !hasProfiles ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center text-destructive p-8">
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={fetchProfiling}>
                  Retry
                </Button>
              </div>
            ) : !hasProfiles ? (
              <div className="text-center text-muted-foreground p-8">
                No profiling data returned. Refresh or adjust column selection.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {selectedColumns.length === 0 ? (
                  <div className="col-span-2 text-center py-12">
                    <p className="text-muted-foreground">No columns selected for profiling</p>
                    <p className="text-sm text-muted-foreground mt-2">Go back to select columns</p>
                  </div>
                ) : selectedColumns.map((col) => {
                    const profile = columnProfiles[col]
                    if (!profile) return null
                    return (
                      <div
                        key={col}
                        className={cn("border border-muted rounded-lg p-4 space-y-3", activeColumn === col && "border-primary")}
                        onClick={() => setActiveColumn(col)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{col}</h4>
                            {profile.key_type === "primary_key" && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">PK</Badge>
                            )}
                            {profile.key_type === "unique" && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">UNIQUE</Badge>
                            )}
                          </div>
                          <Badge variant="outline">
                            {profile.type_guess}
                            {profile.type_confidence && (
                              <span className="ml-1 opacity-70">{Math.round(profile.type_confidence * 100)}%</span>
                            )}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Null Rate:</span>
                            <span className={profile.null_rate > 0.1 ? "text-yellow-500" : "text-green-500"}>
                              {(profile.null_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                          {profile.unique_ratio !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Unique:</span>
                              <span>{(profile.unique_ratio * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                        {profile.rules && profile.rules.length > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Auto Rules: </span>
                            {profile.rules
                              .filter((r: any) => r.decision === "auto")
                              .map((r: any) => getRuleLabel(r.rule_id))
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Cross-field Rules Panel */}
            {hasProfiles && (
              <div className="mt-4 border border-muted rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-medium text-sm">Cross-column Rules (CleanAI suggested)</h3>
                  <Badge variant="outline" className="text-xs">{crossFieldRules.length}</Badge>
                </div>
                {crossFieldRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cross-field rules returned by CleanAI</p>
                ) : (
                  <div className="space-y-2">
                    {crossFieldRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                        <span className="font-mono text-xs">{rule.rule_id}</span>
                        <span className="text-muted-foreground">{rule.condition || rule.predicate}</span>
                        {rule.relationship && (
                          <Badge variant="secondary" className="text-[10px]">
                            {rule.relationship}
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          {rule.cols?.map((c: string) => (
                            <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                          ))}
                        </div>
                        {rule.confidence != null && (
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            {Math.round(rule.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
