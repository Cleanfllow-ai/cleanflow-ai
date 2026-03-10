"use client"

import React, { useEffect, useState } from "react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, ArrowLeft, ArrowRight, Plus, Settings, Star } from "lucide-react"
import { useProcessingWizard, type SettingsPreset } from "./WizardContext"
import { fileManagementAPI } from "@/modules/files"

export function SettingsStep() {
    const {
        authToken,
        selectedPreset,
        setSelectedPreset,
        presetOverrides,
        setPresetOverrides,
        requiredColumns,
        setRequiredColumns,
        selectedColumns,
        prevStep,
        nextStep,
    } = useProcessingWizard()

    const [presets, setPresets] = useState<SettingsPreset[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editMode, setEditMode] = useState(false)

    // Local edit state
    const [currencyValues, setCurrencyValues] = useState("")
    const [uomValues, setUomValues] = useState("")
    const [dateFormats, setDateFormats] = useState("")

    // Fetch presets on mount
    useEffect(() => {
        fetchPresets()
    }, [])

    const fetchPresets = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await fileManagementAPI.getSettingsPresets()
            setPresets(response.presets || [])
            // Auto-select default if available
            const defaultPreset = response.presets?.find((p: SettingsPreset) => p.is_default)
            if (defaultPreset && !selectedPreset) {
                handleSelectPreset(defaultPreset.preset_id)
            }
        } catch (err: any) {
            console.error("Failed to fetch presets:", err)
            // Check if it's an auth error or just no presets
            if (err.message?.includes("Unauthorized") || err.message?.includes("401")) {
                setError("Authentication error. Please refresh the page and try again.")
            } else if (err.message?.includes("404") || err.message?.includes("Not Found")) {
                // No presets exist yet - this is fine
                setPresets([])
            } else {
                setError(err.message || "Failed to load settings presets")
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelectPreset = async (presetId: string) => {
        if (presetId === "none") {
            setSelectedPreset(null)
            return
        }
        try {
            const response = await fileManagementAPI.getSettingsPreset(presetId)
            setSelectedPreset(response)
            // Populate local edit fields
            const config = response.config || {}
            setCurrencyValues((config.currency_values || []).join(", "))
            setUomValues((config.uom_values || []).join(", "))
            setDateFormats((config.date_formats || []).join(", "))
            if (config.required_columns) {
                setRequiredColumns(config.required_columns)
            }
        } catch (err) {
            console.error("Failed to load preset:", err)
        }
    }

    const handleSaveOverrides = () => {
        const overrides = {
            currency_values: currencyValues.split(",").map((s) => s.trim()).filter(Boolean),
            uom_values: uomValues.split(",").map((s) => s.trim()).filter(Boolean),
            date_formats: dateFormats.split(",").map((s) => s.trim()).filter(Boolean),
            required_columns: requiredColumns,
        }
        setPresetOverrides(overrides)
        setEditMode(false)
    }

    const toggleRequiredColumn = (col: string) => {
        if (requiredColumns.includes(col)) {
            setRequiredColumns(requiredColumns.filter((c) => c !== col))
        } else {
            setRequiredColumns([...requiredColumns, col])
        }
    }

    return (
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Settings Configuration</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Select a preset or customize settings for this file
                    </p>
                </div>
            </div>

            {/* Preset selector */}
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <Label className="text-sm mb-2 block">Settings Preset</Label>
                    <Select
                        value={selectedPreset?.preset_id || "none"}
                        onValueChange={handleSelectPreset}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select a preset..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">
                                <span className="text-muted-foreground">No preset (default rules)</span>
                            </SelectItem>
                            {presets.map((preset) => (
                                <SelectItem key={preset.preset_id} value={preset.preset_id}>
                                    <div className="flex items-center gap-2">
                                        {preset.is_default && <Star className="w-3 h-3 text-yellow-500" />}
                                        {preset.preset_name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" size="sm" className="mt-6">
                    <Plus className="w-4 h-4 mr-2" />
                    New Preset
                </Button>
            </div>

            {/* Error display */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm text-destructive font-medium">Error loading presets</p>
                        <p className="text-xs text-destructive/80 mt-1">{error}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchPresets}>
                        Retry
                    </Button>
                </div>
            )}

            {/* Settings editor */}
            <div className="border border-muted rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        {selectedPreset ? selectedPreset.preset_name : "Default Settings"}
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditMode(!editMode)}
                    >
                        {editMode ? "Cancel" : "Edit"}
                    </Button>
                </div>

                {editMode ? (
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm">Valid Currencies (comma-separated)</Label>
                            <Input
                                value={currencyValues}
                                onChange={(e) => setCurrencyValues(e.target.value)}
                                placeholder="USD, EUR, GBP, INR..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-sm">Valid UOM Values (comma-separated)</Label>
                            <Input
                                value={uomValues}
                                onChange={(e) => setUomValues(e.target.value)}
                                placeholder="EA, PCS, KG, LBS..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-sm">Date Formats (comma-separated)</Label>
                            <Input
                                value={dateFormats}
                                onChange={(e) => setDateFormats(e.target.value)}
                                placeholder="YYYY-MM-DD, DD/MM/YYYY..."
                                className="mt-1"
                            />
                        </div>
                        <Button size="sm" onClick={handleSaveOverrides}>
                            Save Changes
                        </Button>
                    </div>
                ) : (
                    <div className="text-sm space-y-2">
                        {selectedPreset?.config?.currency_values && (
                            <div>
                                <span className="text-muted-foreground">Currencies: </span>
                                {selectedPreset.config.currency_values.join(", ")}
                            </div>
                        )}
                        {selectedPreset?.config?.uom_values && (
                            <div>
                                <span className="text-muted-foreground">UOM: </span>
                                {selectedPreset.config.uom_values.join(", ")}
                            </div>
                        )}
                        {!selectedPreset && (
                            <p className="text-muted-foreground">Using default validation rules</p>
                        )}
                    </div>
                )}
            </div>

            {/* Required columns */}
            <div className="border border-muted rounded-lg p-4 space-y-3">
                <h3 className="font-medium">Required Columns</h3>
                <p className="text-sm text-muted-foreground">
                    These columns will be marked as required and checked for null values
                </p>
                <div className="flex flex-wrap gap-2">
                    {selectedColumns.map((col) => {
                        const isRequired = requiredColumns.includes(col)
                        return (
                            <Badge
                                key={col}
                                variant={isRequired ? "default" : "outline"}
                                className={cn(
                                    "cursor-pointer transition-colors",
                                    isRequired ? "bg-primary" : "hover:bg-muted"
                                )}
                                onClick={() => toggleRequiredColumn(col)}
                            >
                                {col}
                            </Badge>
                        )
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-muted/40">
                <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
                <Button onClick={nextStep}>
                    Next: Configure Rules
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    )
}
