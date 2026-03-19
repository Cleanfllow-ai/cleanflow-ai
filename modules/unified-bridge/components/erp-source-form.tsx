"use client"

import { useState } from "react"
import { Network, FileSpreadsheet, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ERPImport, WarehouseImport, StorageImport } from "@/modules/connectors"
import { useConnectedProviders } from "@/modules/connectors/hooks/use-connected-providers"
import SchemaDropForm from "./schema-drop-form"
import SchemaExportForm from "./schema-export-form"

interface ErpSourceFormProps {
  mode?: "source" | "destination"
  uploadId?: string
  file?: any
  columns?: string[]
  token: string
  onIngestionStart: () => void
  onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
  onError: (error: string) => void
  disabled?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  erp: "ERP Systems",
  warehouse: "Data Warehouses",
  storage: "Cloud Storage",
}

export default function ErpSourceForm({
  mode = "source",
  uploadId,
  file,
  columns,
  token,
  onIngestionStart,
  onIngestionComplete,
  onError,
  disabled,
}: ErpSourceFormProps) {
  const { providers, grouped, loading } = useConnectedProviders()
  const [selectedProvider, setSelectedProvider] = useState("")
  const [importMode, setImportMode] = useState<"entity" | "schema">("entity")

  // Derive category from selection
  const selectedInfo = providers.find((p) => p.provider_id === selectedProvider)
  const category = selectedInfo?.category || ""
  const displayName = selectedInfo?.display_name || selectedProvider

  const handleNotification = (message: string, type: "success" | "error") => {
    if (type === "error") {
      onError(message)
    } else {
      onIngestionComplete({ success: true, message })
    }
  }

  const handleImportComplete = (importUploadId: string) => {
    onIngestionComplete({
      success: true,
      message: `Successfully imported data from ${displayName}`,
      uploadId: importUploadId,
    })
  }

  const renderConnectorContent = () => {
    if (!selectedProvider) {
      return (
        <div className="flex items-center justify-center min-h-[250px] text-sm text-muted-foreground">
          Select a connector above to get started.
        </div>
      )
    }

    // Route to the correct component based on category
    if (category === "storage") {
      return (
        <StorageImport
          provider={selectedProvider}
          onImportComplete={handleImportComplete}
          onNotification={handleNotification}
        />
      )
    }

    if (category === "warehouse") {
      return (
        <WarehouseImport
          provider={selectedProvider}
          mode={mode}
          uploadId={uploadId}
          onImportComplete={handleImportComplete}
          onNotification={handleNotification}
        />
      )
    }

    if (category === "erp") {
      return (
        <ERPImport
          provider={selectedProvider}
          mode={mode}
          hideAuth
          uploadId={uploadId}
          onImportComplete={handleImportComplete}
          onNotification={handleNotification}
        />
      )
    }

    // Unknown category — show placeholder
    return (
      <div className="flex flex-col items-center justify-center min-h-[250px] p-8 border-2 border-dashed rounded-lg bg-muted/5">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Network className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-center">{displayName}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
          Connect your {displayName} account to{" "}
          {mode === "source" ? "import" : "export"} data directly.
        </p>
        <Button disabled size="lg">
          Connect
        </Button>
      </div>
    )
  }

  const isStorageProvider = category === "storage"
  const showTabs = selectedProvider && !isStorageProvider

  return (
    <div className="space-y-4">
      {/* Connector Selector — grouped by category */}
      <div className="space-y-2">
        <Label htmlFor="erp-system">
          {mode === "source" ? "Select Source System" : "Select Destination System"}
        </Label>
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger
            id="erp-system"
            disabled={disabled || loading}
            className="focus:ring-0 focus:ring-offset-0 hover:bg-background hover:text-foreground active:scale-100 transition-none"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading connectors...
              </span>
            ) : (
              <SelectValue placeholder="Select connector" />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)]">
            {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
              const catList = grouped[catKey]
              if (!catList || catList.length === 0) return null
              return (
                <SelectGroup key={catKey}>
                  <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                    {catLabel}
                  </SelectLabel>
                  {catList.map((p) => (
                    <SelectItem key={p.provider_id} value={p.provider_id}>
                      {p.display_name.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )
            })}
            {providers.length === 0 && !loading && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No connectors active. Go to <span className="font-medium">Connectors</span> to connect.
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Storage providers: no tabs, render file browser directly */}
      {isStorageProvider && renderConnectorContent()}

      {/* Source mode: Entity vs Schema Drop tabs */}
      {showTabs && mode === "source" && (
        <Tabs
          value={importMode}
          onValueChange={(v) => setImportMode(v as "entity" | "schema")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entity" className="text-xs sm:text-sm">
              <Network className="h-3.5 w-3.5 mr-1.5" />
              By Entity
            </TabsTrigger>
            <TabsTrigger value="schema" className="text-xs sm:text-sm">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Schema Drop
            </TabsTrigger>
          </TabsList>
          <TabsContent value="entity" className="mt-3">
            {renderConnectorContent()}
          </TabsContent>
          <TabsContent value="schema" className="mt-3">
            <SchemaDropForm
              provider={selectedProvider}
              token={token}
              onImportComplete={handleImportComplete}
              onNotification={handleNotification}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Destination mode: By Entity / Custom Schema tabs */}
      {showTabs && mode === "destination" && (
        <Tabs
          value={importMode}
          onValueChange={(v) => setImportMode(v as "entity" | "schema")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entity" className="text-xs sm:text-sm">
              <Network className="h-3.5 w-3.5 mr-1.5" />
              By Entity
            </TabsTrigger>
            <TabsTrigger value="schema" className="text-xs sm:text-sm">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Custom Schema
            </TabsTrigger>
          </TabsList>
          <TabsContent value="entity" className="mt-3">
            {renderConnectorContent()}
          </TabsContent>
          <TabsContent value="schema" className="mt-3">
            <SchemaExportForm
              provider={selectedProvider}
              file={file}
              columns={columns || []}
              token={token}
              onNotification={handleNotification}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* No provider selected yet */}
      {!selectedProvider && !loading && renderConnectorContent()}
    </div>
  )
}
