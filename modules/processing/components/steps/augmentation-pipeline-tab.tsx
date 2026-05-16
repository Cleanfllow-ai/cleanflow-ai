"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, X, ChevronDown } from "lucide-react"
import { useProcessingWizard } from "../WizardContext"
import { useAugPresets } from "@/modules/files/hooks/use-aug-presets"
import type { AugmentationConfig } from "./augmentations-panel"
import { inferCardinality, CARDINALITY_LABEL } from "../../lib/infer-cardinality"
import { cn } from "@/shared/lib/utils"

const MAX_AUGMENTATIONS = 5

/**
 * B1 (2026-05-16): Fuzzy column name matcher for preset hydration.
 * Normalises by lowercasing + stripping ./_/-/whitespace so RightRev
 * presets shipped with names like ``invoice.month`` match a parquet
 * column called ``invoice_month`` (or ``INVOICE-MONTH``).  Returns the
 * original (un-normalised) selected column name on match so downstream
 * AG-Grid lookups still hit the actual parquet header.
 */
export function normalizeColName(s: string): string {
  return s.toLowerCase().replace(/[._\s-]/g, "")
}

interface AugmentationPipelineTabProps {
  selectedColumns: string[]
}

interface DestColumn {
  name: string
  is_new: boolean
}

function DestChip({ col, onRemove }: { col: DestColumn; onRemove: () => void }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
      col.is_new
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-primary/10 border-primary/30 text-primary"
    )}>
      {col.name}
      {col.is_new && <span className="text-[10px] text-amber-500 ml-0.5">(new)</span>}
      <button type="button" onClick={onRemove} className="ml-0.5 hover:text-destructive">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

function SrcChip({ col, onRemove }: { col: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-violet-50 border-violet-200 text-violet-700">
      {col}
      <button type="button" onClick={onRemove} className="ml-0.5 hover:text-destructive">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

interface AugRowEditorProps {
  config: AugmentationConfig
  index: number
  selectedColumns: string[]
  presets: ReturnType<typeof useAugPresets>["presets"]
  onChange: (index: number, cfg: AugmentationConfig) => void
  onRemove: (index: number) => void
}

function AugRowEditor({ config, index, selectedColumns, presets, onChange, onRemove }: AugRowEditorProps) {
  const [srcOpen, setSrcOpen] = useState(false)
  const [destOpen, setDestOpen] = useState(false)
  const [destQuery, setDestQuery] = useState("")

  const cardinality = inferCardinality(
    config.source_columns.length,
    config.destination_columns.length,
    config.prompt_text
  )

  const handlePreset = (value: string) => {
    if (value === "__custom__") {
      onChange(index, { ...config, preset_id: undefined })
      return
    }
    const preset = presets.find((p) => p.preset_id === value)
    if (!preset) return
    // B1 (2026-05-16): fuzzy match — case-insensitive + dotted/underscored
    // tolerant — fixes the silent "no source columns selected" filter-drop
    // bug when preset metadata uses ``invoice.month`` but the parquet
    // header is ``invoice_month``.  We resolve each preset column to its
    // real selectedColumns counterpart so the AG-Grid lookups still hit
    // the actual on-disk header.
    const lookupMap = new Map(selectedColumns.map((c) => [normalizeColName(c), c]))
    const srcCols = preset.required_columns
      .map((c) => lookupMap.get(normalizeColName(c)))
      .filter((v): v is string => v !== undefined)
    const destCols: DestColumn[] = preset.produces_columns.map((c) => {
      const matched = lookupMap.get(normalizeColName(c))
      // If a fuzzy match exists in selectedColumns, treat as existing
      // (NOT new) and use the real header.  Otherwise it's a brand-new
      // augmented column → keep the preset's casing and flag is_new.
      return matched
        ? { name: matched, is_new: false }
        : { name: c, is_new: true }
    })
    const newCfg: AugmentationConfig = {
      mode: preset.cardinality,
      prompt_text: preset.prompt_text,
      preset_id: preset.preset_id,
      source_columns: srcCols,
      destination_columns: destCols,
    }
    onChange(index, newCfg)
  }

  const addSrc = (col: string) => {
    if (config.source_columns.includes(col)) return
    const next = { ...config, source_columns: [...config.source_columns, col] }
    next.mode = inferCardinality(next.source_columns.length, next.destination_columns.length, next.prompt_text)
    onChange(index, next)
    setSrcOpen(false)
  }

  const removeSrc = (col: string) => {
    const next = { ...config, source_columns: config.source_columns.filter((c) => c !== col) }
    next.mode = inferCardinality(next.source_columns.length, next.destination_columns.length, next.prompt_text)
    onChange(index, next)
  }

  const addDest = (name: string) => {
    if (config.destination_columns.some((d) => d.name === name)) return
    const is_new = !selectedColumns.includes(name)
    const next = { ...config, destination_columns: [...config.destination_columns, { name, is_new }] }
    next.mode = inferCardinality(next.source_columns.length, next.destination_columns.length, next.prompt_text)
    onChange(index, next)
    setDestQuery("")
    setDestOpen(false)
  }

  const removeDest = (name: string) => {
    const next = { ...config, destination_columns: config.destination_columns.filter((d) => d.name !== name) }
    next.mode = inferCardinality(next.source_columns.length, next.destination_columns.length, next.prompt_text)
    onChange(index, next)
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const prompt_text = e.target.value
    const mode = inferCardinality(config.source_columns.length, config.destination_columns.length, prompt_text)
    onChange(index, { ...config, prompt_text, mode })
  }

  const srcOptions = selectedColumns.filter((c) => !config.source_columns.includes(c))
  const destOptions = selectedColumns.filter((c) => !config.destination_columns.some((d) => d.name === c))
  const filteredDestOptions = destQuery
    ? destOptions.filter((c) => c.toLowerCase().includes(destQuery.toLowerCase()))
    : destOptions

  // B2 (2026-05-16): visual feedback when this row has a non-empty prompt
  // but zero source columns — the BE will silently filter the row out of
  // the payload (ProcessStep.tsx) and the user won't know why no
  // augmentation ran.  Render a red-tinted border + an inline warning so
  // the mistake is caught BEFORE Submit.
  const hasPromptWithoutSources =
    config.source_columns.length === 0 && config.prompt_text.trim().length > 0

  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-2",
        hasPromptWithoutSources
          ? "border-destructive bg-destructive/5"
          : "border-muted bg-muted/10",
      )}
    >
      {hasPromptWithoutSources && (
        <div className="text-[11px] text-destructive flex items-center gap-1">
          <span>⚠</span>
          <span>Pick at least one source column for this augmentation to run.</span>
        </div>
      )}
      {/* Row 1: preset + cardinality + delete */}
      <div className="flex items-center gap-2">
        <Select value={config.preset_id ?? "__custom__"} onValueChange={handlePreset}>
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder="Choose RightRev template…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__custom__" className="text-xs">Custom (no template)</SelectItem>
            {presets.map((p) => (
              <SelectItem key={p.preset_id} value={p.preset_id} className="text-xs">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-[10px] font-mono shrink-0">{CARDINALITY_LABEL[cardinality]}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(index)} type="button">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Row 2: Sources */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground shrink-0 w-20">Sources:</span>
        {config.source_columns.map((c) => (
          <SrcChip key={c} col={c} onRemove={() => removeSrc(c)} />
        ))}
        <Popover open={srcOpen} onOpenChange={setSrcOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search columns…" className="h-8 text-xs" />
              <CommandEmpty className="text-xs p-2 text-muted-foreground">No columns found.</CommandEmpty>
              <CommandGroup className="max-h-40 overflow-y-auto">
                {srcOptions.map((c) => (
                  <CommandItem key={c} value={c} onSelect={addSrc} className="text-xs">{c}</CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Row 3: Destinations */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground shrink-0 w-20">Destinations:</span>
        {config.destination_columns.map((d) => (
          <DestChip key={d.name} col={d} onRemove={() => removeDest(d.name)} />
        ))}
        <Popover open={destOpen} onOpenChange={setDestOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create column…"
                className="h-8 text-xs"
                value={destQuery}
                onValueChange={setDestQuery}
              />
              {destQuery && !filteredDestOptions.some((c) => c === destQuery) && !config.destination_columns.some((d) => d.name === destQuery) && (
                <div
                  className="px-3 py-2 text-xs cursor-pointer hover:bg-muted flex items-center gap-1 border-b border-muted"
                  onMouseDown={(e) => { e.preventDefault(); addDest(destQuery) }}
                >
                  <Plus className="w-3 h-3 text-primary" />
                  <span>Create new column &quot;{destQuery}&quot;</span>
                </div>
              )}
              <CommandEmpty className="text-xs p-2 text-muted-foreground">
                {destQuery ? "Type to create a new column." : "No columns found."}
              </CommandEmpty>
              <CommandGroup className="max-h-40 overflow-y-auto">
                {filteredDestOptions.map((c) => (
                  <CommandItem key={c} value={c} onSelect={addDest} className="text-xs">{c}</CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Row 4: Logic */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground shrink-0 w-20 pt-2">Logic:</span>
        <Textarea
          value={config.prompt_text}
          onChange={handlePromptChange}
          placeholder="Describe how to derive the destination columns from the sources…"
          rows={2}
          className="text-xs resize-none flex-1"
        />
      </div>
    </div>
  )
}

export function AugmentationPipelineTab({ selectedColumns }: AugmentationPipelineTabProps) {
  const { augmentations, setAugmentations, authToken } = useProcessingWizard()
  const { presets, isLoading } = useAugPresets(authToken)

  const handleAdd = () => {
    if (augmentations.length >= MAX_AUGMENTATIONS) return
    setAugmentations([
      ...augmentations,
      { mode: "ONE_TO_ONE", prompt_text: "", source_columns: [], destination_columns: [] },
    ])
  }

  const handleChange = (index: number, cfg: AugmentationConfig) => {
    const next = augmentations.slice()
    next[index] = cfg
    setAugmentations(next)
  }

  const handleRemove = (index: number) => {
    setAugmentations(augmentations.filter((_, i) => i !== index))
  }

  return (
    <div className="p-4 space-y-3">
      {augmentations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No augmentations yet. Pick a RightRev template or click + Add to define one. Augmentations run BEFORE data quality checks.
        </p>
      )}
      {augmentations.map((cfg, i) => (
        <AugRowEditor
          key={i}
          config={cfg}
          index={i}
          selectedColumns={selectedColumns}
          presets={isLoading ? [] : presets}
          onChange={handleChange}
          onRemove={handleRemove}
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={augmentations.length >= MAX_AUGMENTATIONS}
        type="button"
        className="w-full border-dashed text-xs gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Add augmentation
        {augmentations.length >= MAX_AUGMENTATIONS && (
          <span className="text-muted-foreground ml-1">(max {MAX_AUGMENTATIONS})</span>
        )}
      </Button>
    </div>
  )
}
