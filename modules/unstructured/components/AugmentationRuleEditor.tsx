"use client"

/**
 * AugmentationRuleEditor — Step 4 of the wizard.
 *
 * Optional English-language rule that the BE compiles to a Polars expression
 * (LLM round-trip, cached by org_id+rule_hash). Toggle off → null.
 */

import { Wand2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface AugmentationRuleEditorProps {
  value: string | null
  onChange: (next: string | null) => void
}

const EXAMPLE_RULES = [
  "If country is India, add 18% GST to total",
  "Normalize all currency values to USD using the invoice_date FX rate",
  "Set status to 'review' when amount > 100000",
]

export function AugmentationRuleEditor({
  value,
  onChange,
}: AugmentationRuleEditorProps) {
  const enabled = value !== null

  const setEnabled = (next: boolean) => {
    onChange(next ? value || "" : null)
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Step 4: Augmentation (optional)
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add an English rule that the AI compiles into a deterministic transform.
        </p>
      </div>

      <Label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => setEnabled(Boolean(c))}
          data-testid="unstructured-aug-toggle"
        />
        <span className="text-sm">Apply business rule</span>
      </Label>

      {enabled && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <Label
            htmlFor="aug-rule"
            className="text-xs font-medium flex items-center gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Rule in English
          </Label>
          <Textarea
            id="aug-rule"
            data-testid="unstructured-aug-rule"
            rows={3}
            placeholder="If country is India, add 18% GST to total"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Examples
            </summary>
            <ul className="mt-1 space-y-0.5 pl-4 list-disc">
              {EXAMPLE_RULES.map((ex) => (
                <li key={ex}>{ex}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}

export default AugmentationRuleEditor
