"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Plus, X, Zap } from "lucide-react"
import { useAugPresets } from "@/modules/files/hooks/use-aug-presets"
import type { AugPreset } from "@/modules/files/hooks/use-aug-presets"

export type AugmentationMode = "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY"

export interface AugmentationConfig {
  mode: AugmentationMode
  prompt_text: string
  preset_id?: string
}

const MODE_LABELS: Record<AugmentationMode, string> = {
  ONE_TO_ONE: "1-to-1",
  ONE_TO_MANY: "1-to-many",
  MANY_TO_ONE: "many-to-1",
  MANY_TO_MANY: "many-to-many",
}

const MAX_AUGMENTATIONS = 5

interface AugRowProps {
  index: number
  config: AugmentationConfig
  presets: AugPreset[]
  onChange: (index: number, config: AugmentationConfig) => void
  onRemove: (index: number) => void
}

function AugRow({ index, config, presets, onChange, onRemove }: AugRowProps) {
  const handlePresetChange = (value: string) => {
    if (value === "__custom__") {
      onChange(index, { mode: config.mode, prompt_text: "", preset_id: undefined })
      return
    }
    const preset = presets.find((p) => p.preset_id === value)
    if (preset) {
      onChange(index, {
        mode: preset.cardinality as AugmentationMode,
        prompt_text: preset.prompt_text,
        preset_id: preset.preset_id,
      })
    }
  }

  const selectedPresetId = config.preset_id ?? "__custom__"

  return (
    <div className="flex items-start gap-2 rounded-md border border-muted p-3 bg-muted/10">
      {/* Preset selector */}
      <Select value={selectedPresetId} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-8 w-44 text-xs shrink-0">
          <SelectValue placeholder="Choose preset..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__custom__" className="text-xs">Custom prompt</SelectItem>
          {presets.map((p) => (
            <SelectItem key={p.preset_id} value={p.preset_id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mode selector */}
      <Select
        value={config.mode}
        onValueChange={(v) => onChange(index, { ...config, mode: v as AugmentationMode })}
      >
        <SelectTrigger className="h-8 w-28 text-xs shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(MODE_LABELS) as AugmentationMode[]).map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              {MODE_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Prompt textarea */}
      <Textarea
        value={config.prompt_text}
        onChange={(e) => onChange(index, { ...config, prompt_text: e.target.value })}
        placeholder="Describe what to augment in plain language..."
        rows={2}
        className="text-xs resize-none flex-1 min-h-[3rem]"
      />

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
        type="button"
        aria-label="Remove augmentation"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}

interface AugmentationsPanelProps {
  authToken: string
  augmentations: AugmentationConfig[]
  onChange: (augmentations: AugmentationConfig[]) => void
}

export function AugmentationsPanel({ authToken, augmentations, onChange }: AugmentationsPanelProps) {
  const [open, setOpen] = useState(false)
  const { presets, isLoading } = useAugPresets(authToken)

  const handleAdd = () => {
    if (augmentations.length >= MAX_AUGMENTATIONS) return
    onChange([...augmentations, { mode: "ONE_TO_ONE", prompt_text: "" }])
    setOpen(true)
  }

  const handleChange = (index: number, config: AugmentationConfig) => {
    const next = augmentations.slice()
    next[index] = config
    onChange(next)
  }

  const handleRemove = (index: number) => {
    onChange(augmentations.filter((_, i) => i !== index))
  }

  const count = augmentations.length

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-muted rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">Augmentations</span>
          <span className="text-xs text-muted-foreground">(optional)</span>
          {count > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {count === 0 ? "Skipped — only DQ rules will run" : `${count} configured`}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3 border-t border-muted">
          {/* Hint */}
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-3">
            Augmentations run <strong>BEFORE</strong> data quality checks.
          </p>

          {/* Empty state */}
          {count === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Skip augmentations — only DQ rules will run.
            </p>
          )}

          {/* Augmentation rows */}
          {augmentations.map((config, i) => (
            <AugRow
              key={i}
              index={i}
              config={config}
              presets={isLoading ? [] : presets}
              onChange={handleChange}
              onRemove={handleRemove}
            />
          ))}

          {/* Add button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={count >= MAX_AUGMENTATIONS}
            type="button"
            className="w-full border-dashed text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add augmentation
            {count >= MAX_AUGMENTATIONS && (
              <span className="text-muted-foreground">(max {MAX_AUGMENTATIONS})</span>
            )}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
