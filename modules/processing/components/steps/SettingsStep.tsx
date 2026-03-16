"use client"

import React, { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, ArrowRight, Loader2, Plus, Settings, Star, Shield, ToggleLeft, ToggleRight, Sliders, X, Upload } from "lucide-react"
import { useProcessingWizard, type SettingsPreset } from "../WizardContext"
import { fileManagementAPI } from "@/modules/files"
import { cn } from "@/shared/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const parseListValue = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const setListValue = (setter: (value: string) => void, items: string[]) => {
  setter(items.join(", "))
}

const addListItems = (
  currentValue: string,
  setter: (value: string) => void,
  inputValue: string,
  clearInput: () => void
) => {
  const incoming = inputValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (incoming.length === 0) return
  const current = parseListValue(currentValue)
  const merged = [...current]
  incoming.forEach((item) => {
    if (!merged.includes(item)) merged.push(item)
  })
  setListValue(setter, merged)
  clearInput()
}

const removeListItem = (
  currentValue: string,
  setter: (value: string) => void,
  item: string
) => {
  const filtered = parseListValue(currentValue).filter((entry) => entry !== item)
  setListValue(setter, filtered)
}

const ChipInput = ({
  label,
  value,
  setValue,
  inputValue,
  setInputValue,
  placeholder,
}: {
  label: string
  value: string
  setValue: (value: string) => void
  inputValue: string
  setInputValue: (value: string) => void
  placeholder: string
}) => {
  const items = parseListValue(value)
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="rounded-lg border border-muted bg-muted/20 p-3">
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && (
            <span className="text-xs text-muted-foreground">No values added</span>
          )}
          {items.map((item) => (
            <span
              key={`${label}-${item}`}
              className="flex items-center gap-1 rounded-full border border-muted bg-background px-2 py-1 text-xs"
            >
              {item}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeListItem(value, setValue, item)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addListItems(value, setValue, inputValue, () => setInputValue(""))
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => addListItems(value, setValue, inputValue, () => setInputValue(""))}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_PRESET: SettingsPreset & { config: Record<string, any> } = {
  preset_id: "default_dq_rules",
  preset_name: "Default Data Quality Rules",
  is_default: true,
  config: {
    ruleset_version: "dq34_v1",
    policies: {
      allow_autofix: true,
      strictness: "balanced",
      unknown_column_behavior: "safe_cleanup_only",
    },
    rules_enabled: {
      R1: true, R2: true, R3: true, R4: true, R5: true, R6: true, R7: true, R8: true, R9: true,
      R10: true, R11: true, R12: true, R13: true, R14: true, R15: true, R16: true, R17: true,
      R18: true, R19: true, R20: false, R21: true, R22: true, R23: true, R24: true, R25: true,
      R26: true, R27: true, R28: true, R29: true, R30: true, R31: true, R32: true, R33: true, R34: true,
    },
    required_columns: [],
    required_fields: {
      placeholders_treated_as_missing: ["", "na", "n/a", "null", "none", "-", "--", "?", "NA", "N/A", "NULL", "NONE"],
    },
    currency_values: [
      "USD", "INR", "EUR", "GBP", "SGD", "AED", "AUD", "CAD", "CHF", "CNY", "JPY", "KWD", "SAR", "QAR", "BHD", "OMR"
    ],
    uom_values: [
      "EA", "PCS", "PC", "KG", "G", "LTR", "ML", "M", "CM", "MM", "FT", "IN", "YD", "SQM", "SQFT", "CBM", "CFT", "HR",
      "MIN", "SEC", "DAY", "WK", "MON", "YR", "BOX", "CTN", "PAL", "SET", "KIT", "PR", "DOZ", "GR", "UNIT", "TON", "MT"
    ],
    date_formats: ["ISO", "DMY", "MDY"],
    enum_sets: {
      status: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PENDING", "PAID", "CANCELLED", "CLOSED", "OPEN", "POSTED", "REVERSED", "ACTIVE", "INACTIVE", "COMPLETED", "YES", "NO", "Y", "N", "TRUE", "FALSE", "1", "0"]
    },
    thresholds: {
      text: {
        max_len_default: 255,
      }
    }
  },
}

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
  const [currencyValues, setCurrencyValues] = useState("")
  const [uomValues, setUomValues] = useState("")
  const [dateFormats, setDateFormats] = useState("")
  const [strictness, setStrictness] = useState("balanced")
  const [allowAutofix, setAllowAutofix] = useState(true)
  const [unknownBehavior, setUnknownBehavior] = useState("safe_cleanup_only")
  const [placeholders, setPlaceholders] = useState("")
  const [statusEnums, setStatusEnums] = useState("")
  const [maxTextLen, setMaxTextLen] = useState<number | string>(255)
  const [activeTab, setActiveTab] = useState("policies")
  const [showNewPresetDialog, setShowNewPresetDialog] = useState(false)
  const [newPresetName, setNewPresetName] = useState("")
  const [currencyInput, setCurrencyInput] = useState("")
  const [uomInput, setUomInput] = useState("")
  const [statusInput, setStatusInput] = useState("")
  const [placeholderInput, setPlaceholderInput] = useState("")
  const [uploadedConfig, setUploadedConfig] = useState<any>(null)
  const presetFileInputRef = useRef<HTMLInputElement>(null)


  // Extract repeated config → local state hydration
  const hydrateFromConfig = (rawConfig: any) => {
    const config = parsePresetConfig(rawConfig)
    setCurrencyValues((config.currency_values || []).join(", "))
    setUomValues((config.uom_values || []).join(", "))
    setDateFormats((config.date_formats || []).join(", "))
    setStrictness(config.policies?.strictness || "balanced")
    setAllowAutofix(config.policies?.allow_autofix ?? true)
    setUnknownBehavior(config.policies?.unknown_column_behavior || "safe_cleanup_only")
    setPlaceholders((config.required_fields?.placeholders_treated_as_missing || []).join(", "))
    setStatusEnums((config.enum_sets?.status || []).join(", "))
    setMaxTextLen(config.thresholds?.text?.max_len_default ?? 255)
    if (config.required_columns) setRequiredColumns(config.required_columns)
  }

  useEffect(() => {
    fetchPresets()
  }, [authToken])

  const fetchPresets = async () => {
    if (!authToken) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await fileManagementAPI.getSettingsPresets(authToken)
      const serverPresets = response.presets || []
      const hasDefault = serverPresets.some((p: any) => p.is_default)
      const finalPresets =
        serverPresets.length === 0
          ? [DEFAULT_PRESET]
          : hasDefault
            ? serverPresets
            : [...serverPresets, DEFAULT_PRESET]
      setPresets(finalPresets)
      if (!selectedPreset) {
        const defaultPreset = finalPresets.find((p: SettingsPreset) => (p as any).is_default)
        if (defaultPreset) {
          handleSelectPreset(defaultPreset.preset_id, finalPresets)
        }
      } else {
        // Returning to this step (back navigation / resume) — re-hydrate local state
        const source = Object.keys(presetOverrides).length > 0
          ? presetOverrides
          : (selectedPreset as any).config || {}
        hydrateFromConfig(source)
      }
    } catch (err: any) {
      const finalPresets = [DEFAULT_PRESET]
      setPresets(finalPresets)
      if (!selectedPreset) {
        handleSelectPreset(DEFAULT_PRESET.preset_id, finalPresets)
      } else {
        const source = Object.keys(presetOverrides).length > 0
          ? presetOverrides
          : (selectedPreset as any).config || {}
        hydrateFromConfig(source)
      }
      if (err.message?.includes("Unauthorized")) {
        setError("Authentication error. Please refresh and try again.")
      } else {
        setError(null) // hide error since we fell back to default
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle JSON/CSV file upload for preset config
  const handlePresetFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const fileName = file.name.toLowerCase()

        if (fileName.endsWith('.json')) {
          // Parse JSON and store the raw config for preset creation
          const parsed = JSON.parse(content)
          setUploadedConfig(parsed)

          // Also parse for UI display
          hydrateFromConfig(parsed)

          // Config loaded - user can now enter preset name and click Create Preset
        } else if (fileName.endsWith('.csv')) {
          // Convert CSV to JSON
          const lines = content.trim().split('\n')
          if (lines.length < 2) {
            throw new Error("CSV must have header row and at least one data row")
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
          const rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
            const obj: Record<string, string> = {}
            headers.forEach((header, index) => {
              obj[header] = values[index] || ''
            })
            return obj
          })

          // Create preset config from CSV data
          const csvConfig = {
            imported_data: rows,
            source: "csv_upload",
            headers: headers
          }
          setUploadedConfig(csvConfig)

          // CSV config loaded - user can now enter preset name and click Create Preset
        } else {
          throw new Error("Please upload a .json or .csv file")
        }
      } catch (err: any) {
        console.error("File upload error:", err)
      }
    }

    reader.readAsText(file)
    // Reset input so same file can be uploaded again
    event.target.value = ''
  }

  // Helper to parse preset config - supports both old format and DQ rules format
  const parsePresetConfig = (config: any) => {
    // Check if it's the new DQ rules format (has 'enums', 'rules', 'policy')
    const isDQRulesFormat = config.enums || config.rules || config.policy;

    if (isDQRulesFormat) {
      // Parse DQ rules format
      const currencies = config.enums?.currency?.allowed || [];
      const statuses = config.enums?.status?.allowed || [];
      const dateFormats = config.policy?.date_formats || [];
      const maxTextLen = config.policy?.max_free_text_length || "255";
      const requiredCols = config.required_columns || [];

      return {
        currency_values: currencies,
        uom_values: [], // Not in DQ rules format
        date_formats: dateFormats,
        policies: {
          strictness: "balanced",
          allow_autofix: true,
          unknown_column_behavior: "safe_cleanup_only"
        },
        required_fields: {
          placeholders_treated_as_missing: []
        },
        enum_sets: {
          status: statuses
        },
        thresholds: {
          text: {
            max_len_default: parseInt(maxTextLen) || 255
          }
        },
        required_columns: requiredCols
      };
    }

    // Return old format as-is
    return config;
  };

  const handleSelectPreset = async (presetId: string, presetList?: SettingsPreset[]) => {
    if (presetId === "none") {
      setSelectedPreset(null)
      return
    }
    const list = presetList || presets
    const localPreset = list.find((p) => p.preset_id === presetId) as any

    if (localPreset && presetId === DEFAULT_PRESET.preset_id) {
      setSelectedPreset(localPreset)
      hydrateFromConfig(localPreset.config || {})
      return
    }

    if (!authToken) return
    try {
      const response = await fileManagementAPI.getSettingsPreset(presetId, authToken)
      setSelectedPreset(response)
      hydrateFromConfig(response.config || {})
    } catch (err) {
      console.error("Failed to load preset:", err)
    }
  }

  const buildConfigFromState = (): any => ({
    currency_values: currencyValues.split(",").map((s) => s.trim()).filter(Boolean),
    uom_values: uomValues.split(",").map((s) => s.trim()).filter(Boolean),
    date_formats: dateFormats.split(",").map((s) => s.trim()).filter(Boolean),
    policies: {
      allow_autofix: allowAutofix,
      strictness,
      unknown_column_behavior: unknownBehavior,
    },
    required_fields: {
      placeholders_treated_as_missing: placeholders.split(",").map((s) => s.trim()).filter(Boolean),
    },
    enum_sets: {
      status: statusEnums.split(",").map((s) => s.trim()).filter(Boolean),
    },
    thresholds: {
      text: {
        max_len_default: Number(maxTextLen) || 255,
      },
    },
    required_columns: requiredColumns,
  })

  const handleSaveOverrides = () => {
    const overrides = buildConfigFromState()
    setPresetOverrides(overrides)
    setEditMode(false)
  }

  const toggleRequired = (col: string) => {
    if (requiredColumns.includes(col)) {
      setRequiredColumns(requiredColumns.filter((c) => c !== col))
    } else {
      setRequiredColumns([...requiredColumns, col])
    }
  }

  const handleCreatePreset = async () => {
    if (!newPresetName.trim() || !authToken) return
    setIsLoading(true)
    try {
      // Use uploaded config if available, otherwise build from current state
      const config = uploadedConfig || buildConfigFromState()
      const created = await fileManagementAPI.createSettingsPreset({
        preset_name: newPresetName.trim(),
        config,
        is_default: false
      })
      await fetchPresets()
      const newId = created?.preset_id || newPresetName.trim().toLowerCase().replace(/\s+/g, "_")
      handleSelectPreset(newId)
      setShowNewPresetDialog(false)
      setNewPresetName("")
      setUploadedConfig(null)
    } catch (err) {
      console.error("Failed to create preset", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePreset = async () => {
    if (!authToken || !selectedPreset || selectedPreset.preset_id === DEFAULT_PRESET.preset_id) return
    setIsLoading(true)
    try {
      const config = buildConfigFromState()
      await fileManagementAPI.updateSettingsPreset(
        selectedPreset.preset_id,
        { preset_name: selectedPreset.preset_name, config },
        authToken
      )
      await fetchPresets()
    } catch (err) {
      console.error("Failed to update preset", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePreset = async () => {
    if (!authToken || !selectedPreset || selectedPreset.preset_id === DEFAULT_PRESET.preset_id) return
    setIsLoading(true)
    try {
      await fileManagementAPI.deleteSettingsPreset(selectedPreset.preset_id, authToken)
      await fetchPresets()
      setSelectedPreset(null)
    } catch (err) {
      console.error("Failed to delete preset", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto p-6 pb-2">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Settings Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">Select a preset or customize policy, lookups, thresholds, and required fields for this file.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">Settings Preset</Label>
              <Select value={selectedPreset?.preset_id || "none"} onValueChange={handleSelectPreset}>
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
                        {preset.is_default && <Star className="w-3 h-3 text-amber-500" />}
                        {preset.preset_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Button variant="outline" size="sm" onClick={() => setShowNewPresetDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Preset
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedPreset || selectedPreset.preset_id === DEFAULT_PRESET.preset_id || isLoading}
                onClick={handleUpdatePreset}
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Preset
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!selectedPreset || selectedPreset.preset_id === DEFAULT_PRESET.preset_id || isLoading}
                onClick={handleDeletePreset}
              >
                Delete
              </Button>
            </div>
          </div>

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

          {!error && !isLoading && presets.length === 0 && (
            <div className="bg-muted/40 border border-muted/60 rounded-lg p-4 text-sm text-muted-foreground">
              No presets available yet. Continue with default rules or create a new preset.
            </div>
          )}

          <div className="border border-muted rounded-xl p-5 space-y-4 bg-muted/10 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedPreset ? selectedPreset.preset_name : "Default Settings"}</h3>
                  <p className="text-xs text-muted-foreground">DQ policy + lookups + hygiene defaults</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? "Cancel" : "Edit"}
              </Button>
            </div>

            {editMode ? (
              <div className="space-y-5">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-4 w-full mb-4">
                    <TabsTrigger value="policies">Policies</TabsTrigger>
                    <TabsTrigger value="lookups">Lookups</TabsTrigger>
                    <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
                    <TabsTrigger value="required">Required</TabsTrigger>
                  </TabsList>

                  <TabsContent value="policies" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Strictness</Label>
                        <Select value={strictness} onValueChange={setStrictness}>
                          <SelectTrigger><SelectValue placeholder="Select strictness" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lenient">Lenient</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="strict">Strict</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">Auto-fix</Label>
                        <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setAllowAutofix(!allowAutofix)}>
                          <span>{allowAutofix ? "Enabled" : "Disabled"}</span>
                          {allowAutofix ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Unknown Column Behavior</Label>
                        <Select value={unknownBehavior} onValueChange={setUnknownBehavior}>
                          <SelectTrigger><SelectValue placeholder="Select behavior" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="safe_cleanup_only">Safe cleanup only</SelectItem>
                            <SelectItem value="quarantine">Quarantine unknowns</SelectItem>
                            <SelectItem value="ignore">Ignore</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="lookups" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ChipInput
                        label="Currencies"
                        value={currencyValues}
                        setValue={setCurrencyValues}
                        inputValue={currencyInput}
                        setInputValue={setCurrencyInput}
                        placeholder="Type USD, EUR, etc. and press Enter"
                      />
                      <ChipInput
                        label="UOM"
                        value={uomValues}
                        setValue={setUomValues}
                        inputValue={uomInput}
                        setInputValue={setUomInput}
                        placeholder="Type EA, PCS, KG, etc. and press Enter"
                      />
                      <ChipInput
                        label="Status Enum"
                        value={statusEnums}
                        setValue={setStatusEnums}
                        inputValue={statusInput}
                        setInputValue={setStatusInput}
                        placeholder="Type DRAFT, APPROVED, etc. and press Enter"
                      />
                      <ChipInput
                        label="Placeholders treated as missing"
                        value={placeholders}
                        setValue={setPlaceholders}
                        inputValue={placeholderInput}
                        setInputValue={setPlaceholderInput}
                        placeholder="Type na, n/a, null, -, -- and press Enter"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="thresholds" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Max text length</Label>
                        <Input type="number" min={1} value={maxTextLen} onChange={(e) => setMaxTextLen(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Date formats</Label>
                        <Input value={dateFormats} onChange={(e) => setDateFormats(e.target.value)} placeholder="ISO, DMY, MDY" />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="required" className="space-y-3">
                    <p className="text-sm text-muted-foreground">Mark columns as required; they will be checked for null values.</p>
                    {selectedColumns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Select columns first.</p>
                    ) : (
                      <div className="border border-muted rounded-lg p-3 max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {selectedColumns.map((col) => (
                            <label key={col} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={requiredColumns.includes(col)}
                                onChange={() => toggleRequired(col)}
                                className="h-4 w-4"
                              />
                              <span>{col}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveOverrides}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="border border-muted rounded-lg p-4 bg-white/60">
                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
                      <Shield className="w-4 h-4" /> Policies
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">Strictness: {strictness}</Badge>
                      <Badge variant={allowAutofix ? "default" : "outline"}>{allowAutofix ? "Auto-fix On" : "Auto-fix Off"}</Badge>
                      <Badge variant="outline">Unknown: {unknownBehavior}</Badge>
                    </div>
                  </div>
                  <div className="border border-muted rounded-lg p-4 bg-white/60">
                    <div className="text-sm font-medium mb-2">Lookups</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Currencies:</span> {currencyValues || "n/a"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">UOM:</span> {uomValues || "n/a"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Status:</span> {statusEnums || "n/a"}
                    </p>
                  </div>
                  <div className="border border-muted rounded-lg p-4 bg-white/60">
                    <div className="text-sm font-medium mb-2">Data Hygiene</div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Placeholders:</span> {placeholders || "n/a"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Date formats:</span> {dateFormats || "n/a"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Max text length:</span> {maxTextLen}
                    </p>
                  </div>
                </div>
                {!selectedPreset && <p className="text-muted-foreground text-sm">Using default validation rules</p>}
              </div>
            )}
          </div>



          <Dialog open={showNewPresetDialog} onOpenChange={(open) => {
            setShowNewPresetDialog(open)
            if (!open) {
              setUploadedConfig(null)
              setNewPresetName("")
            }
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Preset</DialogTitle>
                <DialogDescription>
                  Define global DQ settings to reuse across workflows.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Preset Name</Label>
                  <Input
                    placeholder="e.g., Automobile DQ Settings"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Preset Config (JSON)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={presetFileInputRef}
                        onChange={handlePresetFileUpload}
                        accept=".json,.csv"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => presetFileInputRef.current?.click()}
                        className="gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload JSON/CSV
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={uploadedConfig ? JSON.stringify(uploadedConfig, null, 2) : ""}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setUploadedConfig(parsed)
                      } catch {
                        // Allow invalid JSON while typing
                      }
                    }}
                    placeholder="Upload a JSON/CSV file or paste your config here..."
                    className="min-h-[220px] font-mono text-xs"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewPresetDialog(false)
                    setUploadedConfig(null)
                    setNewPresetName("")
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePreset}
                  disabled={!newPresetName.trim() || isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Preset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-muted/40 flex items-center justify-between">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={nextStep}>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
