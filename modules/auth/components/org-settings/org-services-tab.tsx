"use client";

import { Check, Cog, Database, Edit, Loader2, Plus, Shield, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PermissionWrapper } from "@/modules/auth/components/permission-wrapper";
import type { SettingsPreset } from "@/modules/files";
import { ERP_OPTIONS, SHOW_GLOBAL_SETTINGS_PRESETS, type AppRole } from "./use-org-settings";

interface OrgServicesTabProps {
  currentUserRole: AppRole | undefined;
  canManageSettingsPermission: boolean;
  servicesSettings: {
    defaultInputErp: string;
    defaultExportErp: string;
    customInputErpName: string;
    customExportErpName: string;
    dataTransformEnabled: boolean;
    dataQualityEnabled: boolean;
    cleanDataShieldEnabled: boolean;
    preferredFormat: string;
  };
  isSavingServices: boolean;
  settingsPresets: SettingsPreset[];
  isLoadingPresets: boolean;
  isSavingPreset: boolean;
  isPresetDialogOpen: boolean;
  presetDialogMode: "create" | "edit";
  presetFormName: string;
  presetFormConfig: string;
  presetFormDefault: boolean;
  presetToDelete: SettingsPreset | null;
  isDeletePresetOpen: boolean;
  handleServicesChange: (field: string, value: string | boolean) => void;
  handleSaveServices: () => Promise<void>;
  openCreatePresetDialog: () => void;
  openEditPresetDialog: (preset: SettingsPreset) => void;
  handleSavePreset: () => Promise<void>;
  handleDeletePreset: () => Promise<void>;
  handleSetDefaultPreset: (preset: SettingsPreset) => Promise<void>;
  setIsPresetDialogOpen: (open: boolean) => void;
  setPresetFormName: (name: string) => void;
  setPresetFormConfig: (config: string) => void;
  setPresetFormDefault: (isDefault: boolean) => void;
  setPresetToDelete: (preset: SettingsPreset | null) => void;
  setIsDeletePresetOpen: (open: boolean) => void;
}

export function OrgServicesTab({
  currentUserRole,
  canManageSettingsPermission,
  servicesSettings,
  isSavingServices,
  settingsPresets,
  isLoadingPresets,
  isSavingPreset,
  isPresetDialogOpen,
  presetDialogMode,
  presetFormName,
  presetFormConfig,
  presetFormDefault,
  presetToDelete,
  isDeletePresetOpen,
  handleServicesChange,
  handleSaveServices,
  openCreatePresetDialog,
  openEditPresetDialog,
  handleSavePreset,
  handleDeletePreset,
  handleSetDefaultPreset,
  setIsPresetDialogOpen,
  setPresetFormName,
  setPresetFormConfig,
  setPresetFormDefault,
  setPresetToDelete,
  setIsDeletePresetOpen,
}: OrgServicesTabProps) {
  return (
    <PermissionWrapper
      permission={canManageSettingsPermission}
      permissionKey="settings"
      userRole={currentUserRole}
      message="You do not have permission to manage connected services."
    >
      {/* ERP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure default input and export systems for your data
            processing workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Default Input ERP */}
            <div className="space-y-3">
              <Label>Import</Label>
              <p className="text-sm text-muted-foreground">
                Select the default source for data imports
              </p>
              <Select
                value={servicesSettings.defaultInputErp}
                onValueChange={(value) =>
                  handleServicesChange("defaultInputErp", value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select input ERP" />
                </SelectTrigger>
                <SelectContent>
                  {ERP_OPTIONS.map((erp) => (
                    <SelectItem key={erp.value} value={erp.value}>
                      {erp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {servicesSettings.defaultInputErp === "custom" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                  <Input
                    placeholder="Enter custom ERP name"
                    value={servicesSettings.customInputErpName}
                    onChange={(e) =>
                      handleServicesChange(
                        "customInputErpName",
                        e.target.value,
                      )
                    }
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" className="shrink-0">
                    <Plus className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              )}
            </div>

            {/* Default Export ERP */}
            <div className="space-y-3">
              <Label>Export</Label>
              <p className="text-sm text-muted-foreground">
                Select the default source for data exports
              </p>
              <Select
                value={servicesSettings.defaultExportErp}
                onValueChange={(value) =>
                  handleServicesChange("defaultExportErp", value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select export ERP" />
                </SelectTrigger>
                <SelectContent>
                  {ERP_OPTIONS.map((erp) => (
                    <SelectItem key={erp.value} value={erp.value}>
                      {erp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {servicesSettings.defaultExportErp === "custom" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                  <Input
                    placeholder="Enter custom ERP name"
                    value={servicesSettings.customExportErpName}
                    onChange={(e) =>
                      handleServicesChange(
                        "customExportErpName",
                        e.target.value,
                      )
                    }
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" className="shrink-0">
                    <Plus className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              )}
            </div>

            {/* Data Format */}
            <div className="space-y-3">
              <Label>Data Format</Label>
              <p className="text-sm text-muted-foreground">
                Select the preferred data format
              </p>
              <Select
                value={servicesSettings.preferredFormat}
                onValueChange={(value) =>
                  handleServicesChange("preferredFormat", value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                  <SelectItem value="sql">SQL</SelectItem>
                  <SelectItem value="parquet">Parquet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="w-5 h-5" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Transform */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm sm:text-base">
                  Data Transform
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Transform and normalize data between different ERP formats
                </p>
              </div>
            </div>
            <Switch
              checked={servicesSettings.dataTransformEnabled}
              onCheckedChange={(checked) =>
                handleServicesChange("dataTransformEnabled", checked)
              }
              className="shrink-0"
            />
          </div>

          {/* Data Quality */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg shrink-0">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm sm:text-base">
                  Data Quality
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Validate, clean, and fix data quality issues automatically
                </p>
              </div>
            </div>
            <Switch
              checked={servicesSettings.dataQualityEnabled}
              onCheckedChange={(checked) =>
                handleServicesChange("dataQualityEnabled", checked)
              }
              className="shrink-0"
            />
          </div>

          {/* CleanDataShield */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg shrink-0">
                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-sm sm:text-base">
                    CleanDataShield™
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    Premium
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Protects your data from external threats.
                </p>
              </div>
            </div>
            <Switch
              checked={servicesSettings.cleanDataShieldEnabled}
              onCheckedChange={(checked) =>
                handleServicesChange("cleanDataShieldEnabled", checked)
              }
              className="shrink-0"
            />
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={handleSaveServices} disabled={isSavingServices}>
              {isSavingServices && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isSavingServices ? "Saving..." : "Save Services"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {SHOW_GLOBAL_SETTINGS_PRESETS && (
        <>
          {/* Global Settings Presets */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Global Settings Presets
                </CardTitle>
                <CardDescription>
                  Manage global DQ settings presets used across files and workflows.
                </CardDescription>
              </div>
              <Button onClick={openCreatePresetDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                New Preset
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingPresets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading presets...
                </div>
              ) : settingsPresets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No presets yet. Create a new preset to define global defaults.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Preset Name</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settingsPresets.map((preset) => (
                      <TableRow key={preset.preset_id}>
                        <TableCell className="font-medium">
                          {preset.preset_name}
                        </TableCell>
                        <TableCell>
                          {preset.is_default ? (
                            <Badge variant="secondary">Default</Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefaultPreset(preset)}
                              disabled={isSavingPreset}
                            >
                              Set Default
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {preset.updated_at
                            ? new Date(preset.updated_at).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditPresetDialog(preset)}
                            disabled={isSavingPreset}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setPresetToDelete(preset);
                              setIsDeletePresetOpen(true);
                            }}
                            disabled={isSavingPreset}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={isPresetDialogOpen} onOpenChange={setIsPresetDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {presetDialogMode === "create" ? "Create Preset" : "Edit Preset"}
                </DialogTitle>
                <DialogDescription>
                  Define global DQ settings to reuse across workflows.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Preset Name</Label>
                  <Input
                    value={presetFormName}
                    onChange={(e) => setPresetFormName(e.target.value)}
                    placeholder="e.g. Default DQ Rules"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preset Config (JSON)</Label>
                  <Textarea
                    value={presetFormConfig}
                    onChange={(e) => setPresetFormConfig(e.target.value)}
                    className="min-h-[220px] font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={presetFormDefault}
                    onCheckedChange={setPresetFormDefault}
                  />
                  <Label>Set as default preset</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPresetDialogOpen(false)}
                  disabled={isSavingPreset}
                >
                  Cancel
                </Button>
                <Button onClick={handleSavePreset} disabled={isSavingPreset}>
                  {isSavingPreset && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {presetDialogMode === "create" ? "Create" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={isDeletePresetOpen} onOpenChange={setIsDeletePresetOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete preset?</AlertDialogTitle>
                <AlertDialogDescription>
                  {presetToDelete
                    ? `Delete preset "${presetToDelete.preset_name}"? This cannot be undone.`
                    : "This action cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSavingPreset}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeletePreset}
                  disabled={isSavingPreset}
                >
                  {isSavingPreset ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </PermissionWrapper>
  );
}
