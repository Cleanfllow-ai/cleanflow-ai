"use client"

import { useState } from 'react'
import { Network, FileSpreadsheet } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuickBooksImport } from '@/modules/quickbooks'
import { ZohoBooksImport } from '@/modules/zoho'
import { SnowflakeImport } from '@/modules/snowflake'
import SchemaDropForm from './schema-drop-form'

interface ErpSourceFormProps {
  mode?: "source" | "destination"
  uploadId?: string  // Required for export/destination mode
  token: string
  onIngestionStart: () => void
  onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
  onError: (error: string) => void
  disabled?: boolean
}

const ERP_OPTIONS = [
  { label: "QUICKBOOKS ONLINE", value: "quickbooks" },
  { label: "ZOHO BOOKS", value: "zoho-books" },
  { label: "SNOWFLAKE", value: "snowflake" },
  { label: "ORACLE FUSION", value: "oracle" },
  { label: "SAP", value: "sap" },
  { label: "MICROSOFT DYNAMICS", value: "dynamics" },
  { label: "NETSUITE", value: "netsuite" },
  { label: "WORKDAY", value: "workday" },
  { label: "INFOR M3", value: "infor-m3" },
  { label: "INFOR LN", value: "infor-ln" },
  { label: "EPICOR KINETIC", value: "epicor" },
  { label: "QAD", value: "qad" },
  { label: "IFS CLOUD", value: "ifs" },
  { label: "SAGE INTACCT", value: "sage" },
]

/** Map ERP selector values to provider keys used by the backend API */
const PROVIDER_MAP: Record<string, string> = {
  "quickbooks": "quickbooks",
  "zoho-books": "zohobooks",
  "snowflake": "snowflake",
  "netsuite": "netsuite",
  "dynamics": "dynamics",
  "sap": "sap",
}

export default function ErpSourceForm({
  mode = "source",
  uploadId,
  token,
  onIngestionStart,
  onIngestionComplete,
  onError,
  disabled,
}: ErpSourceFormProps) {
  const [selectedErp, setSelectedErp] = useState("quickbooks")
  const [importMode, setImportMode] = useState<"entity" | "schema">("entity")

  const handleNotification = (message: string, type: "success" | "error") => {
    if (type === 'error') {
      onError(message)
    } else {
      onIngestionComplete({ success: true, message })
    }
  }

  const handleImportComplete = (uploadId: string) => {
    onIngestionComplete({
      success: true,
      message: `Successfully imported data from ${ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}`,
      uploadId,
    })
  }

  const renderErpContent = () => {
    if (selectedErp === "quickbooks") {
      return (
        <QuickBooksImport
          mode={mode}
          uploadId={uploadId}
          onImportComplete={handleImportComplete}
          onNotification={handleNotification}
        />
      )
    }
    if (selectedErp === "zoho-books") {
      return (
        <ZohoBooksImport
          mode={mode}
          uploadId={uploadId}
          onImportComplete={handleImportComplete}
          onNotification={handleNotification}
        />
      )
    }
    if (selectedErp === "snowflake") {
      return (
        <SnowflakeImport
          mode={mode}
          uploadId={uploadId}
          onImportComplete={handleImportComplete}
          onNotification={handleNotification}
        />
      )
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[250px] p-8 border-2 border-dashed rounded-lg bg-muted/5">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Network className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-center">
          {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
          Connect your {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label} account to {mode === "source" ? "import" : "export"} data directly.
        </p>
        <Button disabled size="lg">Connect</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ERP System Selector */}
      <div className="space-y-2">
        <Label htmlFor="erp-system">{mode === "source" ? "Select Source System" : "Select Destination System"}</Label>
        <Select value={selectedErp} onValueChange={setSelectedErp}>
          <SelectTrigger id="erp-system" disabled={disabled} className="focus:ring-0 focus:ring-offset-0 hover:bg-background hover:text-foreground active:scale-100 transition-none">
            <SelectValue placeholder="Select ERP system" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)]">
            {ERP_OPTIONS.map((erp) => (
              <SelectItem key={erp.value} value={erp.value}>
                {erp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Import Mode: Entity vs Schema Drop (source mode only) */}
      {mode === "source" && (
        <Tabs value={importMode} onValueChange={(v) => setImportMode(v as "entity" | "schema")} className="w-full">
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
            {renderErpContent()}
          </TabsContent>

          <TabsContent value="schema" className="mt-3">
            <SchemaDropForm
              provider={PROVIDER_MAP[selectedErp] || selectedErp}
              token={token}
              onImportComplete={handleImportComplete}
              onNotification={handleNotification}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Destination mode: no schema drop, just entity-based export */}
      {mode === "destination" && renderErpContent()}
    </div>
  )
}
