"use client"

/**
 * SchemaSelector — Step 3 of the wizard.
 *
 * Phase 1 ships three canonical schemas (invoice_standard, contract_v1,
 * receipt_v1). Custom-schema design is out of scope until BE registry work
 * lands.
 */

import { FileCheck2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/shared/lib/utils"
import {
  UNSTRUCTURED_SCHEMAS,
  type UnstructuredSchemaId,
} from "../types/unstructured.types"

interface SchemaSelectorProps {
  value: UnstructuredSchemaId
  onChange: (next: UnstructuredSchemaId) => void
}

export function SchemaSelector({ value, onChange }: SchemaSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Step 3: Pick schema</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          The schema controls which fields the AI extracts from each document.
        </p>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as UnstructuredSchemaId)}
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        {UNSTRUCTURED_SCHEMAS.map((schema) => (
          <Label
            key={schema.id}
            htmlFor={`schema-${schema.id}`}
            data-testid={`unstructured-schema-${schema.id}`}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
              value === schema.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50",
            )}
          >
            <RadioGroupItem
              value={schema.id}
              id={`schema-${schema.id}`}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{schema.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {schema.description}
              </p>
            </div>
          </Label>
        ))}
      </RadioGroup>
    </div>
  )
}

export default SchemaSelector
