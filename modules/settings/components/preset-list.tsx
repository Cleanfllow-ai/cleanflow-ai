/**
 * PresetList — renders the org's DQ preset collection.
 *
 * Displays each preset as a card row with:
 *  - Preset name + "Default" badge for the active default
 *  - Edit button (calls onEdit)
 *  - Delete button (calls onDelete, hidden for default preset)
 */

"use client"

import React from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { SettingsPreset } from "@/modules/settings/api/settings-api"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PresetListProps {
    presets: SettingsPreset[]
    onEdit: (preset: SettingsPreset) => void
    onDelete: (preset: SettingsPreset) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PresetList({ presets, onEdit, onDelete }: PresetListProps) {
    if (presets.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground" data-testid="preset-list-empty">
                No presets yet. Create your first DQ preset to get started.
            </div>
        )
    }

    return (
        <ul className="divide-y divide-border" data-testid="preset-list">
            {presets.map((preset) => (
                <li
                    key={preset.preset_id}
                    className="flex items-center gap-3 py-3 px-1"
                    data-testid={`preset-row-${preset.preset_id}`}
                >
                    <span className="flex-1 font-medium text-sm">{preset.preset_name}</span>

                    {preset.is_default && (
                        <Badge
                            variant="secondary"
                            className="text-[11px]"
                            data-testid={`preset-default-badge-${preset.preset_id}`}
                        >
                            Default
                        </Badge>
                    )}

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(preset)}
                        aria-label={`Edit ${preset.preset_name}`}
                        data-testid={`edit-preset-${preset.preset_id}`}
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {!preset.is_default && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDelete(preset)}
                            aria-label={`Delete ${preset.preset_name}`}
                            data-testid={`delete-preset-${preset.preset_id}`}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    )
}
