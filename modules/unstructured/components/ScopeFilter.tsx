"use client"

/**
 * ScopeFilter — Step 2 of the wizard.
 *
 * Manual: glob pattern + optional date range.
 * Agentic: free-text prompt — server-side LLM resolves to a concrete file set.
 */

import { Filter, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/shared/lib/utils"
import type {
  UnstructuredFilterMode,
  UnstructuredJobFilter,
} from "../types/unstructured.types"

interface ScopeFilterProps {
  value: UnstructuredJobFilter
  onChange: (next: UnstructuredJobFilter) => void
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ScopeFilter({ value, onChange }: ScopeFilterProps) {
  const setMode = (mode: UnstructuredFilterMode) => {
    onChange({ ...value, mode })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Step 2: Pick scope</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose which files to process. Manual = pattern + dates, Agentic = describe what you want.
        </p>
      </div>

      <RadioGroup
        value={value.mode}
        onValueChange={(v) => setMode(v as UnstructuredFilterMode)}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <Label
          htmlFor="mode-manual"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
            value.mode === "manual"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <RadioGroupItem value="manual" id="mode-manual" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Manual filter</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pattern (glob) plus optional modified-date range.
            </p>
          </div>
        </Label>

        <Label
          htmlFor="mode-agentic"
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
            value.mode === "agentic"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <RadioGroupItem value="agentic" id="mode-agentic" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Agentic AI</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Describe what you want; the agent picks the files.
            </p>
          </div>
        </Label>
      </RadioGroup>

      {value.mode === "manual" && (
        <div className="rounded-md border border-border p-3 space-y-3">
          <div>
            <Label htmlFor="scope-glob" className="text-xs font-medium">
              File pattern
            </Label>
            <Input
              id="scope-glob"
              data-testid="unstructured-glob"
              className="mt-1"
              placeholder="*.pdf,*.docx,*.xlsx"
              value={value.glob}
              onChange={(e) => onChange({ ...value, glob: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Comma-separated globs. Default matches the three most common formats.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="modified-after" className="text-xs font-medium">
                Modified after
              </Label>
              <Input
                id="modified-after"
                data-testid="unstructured-modified-after"
                type="date"
                className="mt-1"
                value={value.modified_after || ""}
                max={todayIso()}
                onChange={(e) =>
                  onChange({
                    ...value,
                    modified_after: e.target.value || null,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="modified-before" className="text-xs font-medium">
                Modified before
              </Label>
              <Input
                id="modified-before"
                data-testid="unstructured-modified-before"
                type="date"
                className="mt-1"
                value={value.modified_before || ""}
                max={todayIso()}
                onChange={(e) =>
                  onChange({
                    ...value,
                    modified_before: e.target.value || null,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {value.mode === "agentic" && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <Label htmlFor="agentic-prompt" className="text-xs font-medium">
            Tell the AI what to find
          </Label>
          <Textarea
            id="agentic-prompt"
            data-testid="unstructured-agentic-prompt"
            rows={3}
            placeholder="Get all Q1 invoices from partner submissions"
            value={value.agentic_prompt || ""}
            onChange={(e) =>
              onChange({
                ...value,
                agentic_prompt: e.target.value || null,
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">
            The agent reads file names and metadata to decide. Costs ~$0.001 per
            file inspected.
          </p>
        </div>
      )}
    </div>
  )
}

export default ScopeFilter
