import { Cpu, Database, Layers, GitBranch, AlertTriangle } from "lucide-react"

import type { DqReportResponse } from "@/modules/files"

interface DqDetectionInfoProps {
  dqReport: DqReportResponse | null
}

export function DqDetectionInfo({ dqReport }: DqDetectionInfoProps) {
  const si = dqReport?.schema_intelligence
  const hasBasicDetection = dqReport?.detected_erp || dqReport?.detected_entity
  const hasSchemaIntelligence = si?.file_structure || si?.schema_match

  if (!hasBasicDetection && !hasSchemaIntelligence) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dqReport?.detected_erp && (
          <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
            <div className="p-2 bg-sky-100 rounded-lg">
              <Cpu className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Detected ERP</p>
              <p className="font-medium">{dqReport.detected_erp}</p>
            </div>
          </div>
        )}
        {dqReport?.detected_entity && (
          <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Database className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Detected Entity</p>
              <p className="font-medium capitalize">{dqReport.detected_entity.replace(/_/g, " ")}</p>
            </div>
          </div>
        )}
        {si?.file_structure && (
          <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Layers className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">File Structure</p>
              <p className="font-medium capitalize">{si.file_structure.pattern}</p>
              {si.file_structure.object_prefixes?.length ? (
                <p className="text-xs text-muted-foreground">
                  {si.file_structure.object_prefixes.length} objects
                </p>
              ) : null}
            </div>
          </div>
        )}
        {si?.schema_match && (
          <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <GitBranch className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Matched Schema</p>
              <p className="font-medium">{si.schema_match.schema_name}</p>
              <p className="text-xs text-muted-foreground">
                {si.schema_match.domain}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Schema Intelligence violation summary */}
      {si && ((si.hierarchy_violations ?? 0) > 0 || (si.invariant_violations ?? 0) > 0 || (si.si_cross_violations ?? 0) > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">Business Rule Violations</p>
            <div className="flex gap-4 text-xs text-amber-700 dark:text-amber-300">
              {(si.hierarchy_violations ?? 0) > 0 && (
                <span>Hierarchy: {si.hierarchy_violations}</span>
              )}
              {(si.invariant_violations ?? 0) > 0 && (
                <span>Invariants: {si.invariant_violations}</span>
              )}
              {(si.si_cross_violations ?? 0) > 0 && (
                <span>Cross-column: {si.si_cross_violations}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Row type distribution */}
      {si?.row_types && Object.keys(si.row_types).length > 1 && (
        <div className="bg-muted/30 p-3 rounded-lg border">
          <p className="text-xs text-muted-foreground mb-2">Row Type Distribution</p>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(si.row_types).map(([type, count]) => (
              <div key={type} className="text-xs bg-muted/50 px-2 py-1 rounded">
                <span className="font-medium">{type}</span>: {count} rows
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

