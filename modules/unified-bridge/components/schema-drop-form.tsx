"use client"

import { useState, useCallback, useRef } from "react"
import {
    Loader2,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    Download,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AWS_CONFIG } from "@/shared/config/aws-config"

const API_BASE = AWS_CONFIG.API_BASE_URL || ""

interface SchemaDropFormProps {
    provider: string
    token: string
    onImportComplete?: (uploadId: string) => void
    onNotification?: (message: string, type: "success" | "error") => void
}

interface ColumnResolution {
    column: string
    entity: string
    cdf_field: string
    confidence: number
    method: string
}

interface ResolveResult {
    resolutions: ColumnResolution[]
    unmapped: string[]
    entities_needed: string[]
    sf_tables?: Record<string, number>  // Snowflake: {table_name: col_count}
}

type Phase = "upload" | "resolving" | "review" | "importing" | "done"

export default function SchemaDropForm({
    provider,
    token,
    onImportComplete,
    onNotification,
}: SchemaDropFormProps) {
    const [phase, setPhase] = useState<Phase>("upload")
    const [csvColumns, setCsvColumns] = useState<string[]>([])
    const [csvFileName, setCsvFileName] = useState("")
    const [resolutions, setResolutions] = useState<ColumnResolution[]>([])
    const [unmapped, setUnmapped] = useState<string[]>([])
    const [entitiesNeeded, setEntitiesNeeded] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [importResult, setImportResult] = useState<any>(null)
    const [sfTables, setSfTables] = useState<Record<string, number> | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isSnowflake = provider === "snowflake"

    const apiHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }), [token])

    // ─── Parse CSV headers ─────────────────────────────────────────
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setCsvFileName(file.name)
        setError(null)

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            if (!text) {
                setError("Could not read file")
                return
            }
            // Parse first line as headers
            const firstLine = text.split("\n")[0].trim()
            const headers = firstLine.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""))
            if (headers.length === 0 || (headers.length === 1 && !headers[0])) {
                setError("No columns found in CSV")
                return
            }
            setCsvColumns(headers)
        }
        reader.readAsText(file)
    }, [])

    // ─── Resolve columns via API ───────────────────────────────────
    const resolveColumns = useCallback(async () => {
        if (csvColumns.length === 0) return

        setPhase("resolving")
        setError(null)

        try {
            const resp = await fetch(`${API_BASE}/erp/schema-resolve`, {
                method: "POST",
                headers: apiHeaders(),
                body: JSON.stringify({ provider, columns: csvColumns }),
            })

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}))
                throw new Error(err.error || `HTTP ${resp.status}`)
            }

            const data: ResolveResult = await resp.json()
            setResolutions(data.resolutions || [])
            setUnmapped(data.unmapped || [])
            setEntitiesNeeded(data.entities_needed || [])
            if (data.sf_tables) setSfTables(data.sf_tables)
            setPhase("review")
        } catch (err) {
            setError((err as Error).message || "Failed to resolve columns")
            setPhase("upload")
        }
    }, [csvColumns, provider, apiHeaders])

    // ─── Execute cross-entity import ───────────────────────────────
    const runImport = useCallback(async () => {
        if (resolutions.length === 0) return

        setPhase("importing")
        setError(null)

        try {
            const resp = await fetch(`${API_BASE}/erp/schema-import`, {
                method: "POST",
                headers: apiHeaders(),
                body: JSON.stringify({
                    provider,
                    resolutions: resolutions.map((r) => ({
                        column: r.column,
                        entity: r.entity,
                        cdf_field: r.cdf_field,
                    })),
                    filters: { limit: 1000 },
                }),
            })

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}))
                throw new Error(err.error || `HTTP ${resp.status}`)
            }

            const data = await resp.json()
            if (data.error) {
                throw new Error(data.error)
            }
            setImportResult(data)
            setPhase("done")
            onNotification?.(
                data.message || `Imported ${data.records_imported} rows`,
                "success"
            )
            if (data.upload_id) {
                onImportComplete?.(data.upload_id)
            }
        } catch (err) {
            setError((err as Error).message || "Import failed")
            setPhase("review")
        }
    }, [resolutions, provider, apiHeaders, onNotification, onImportComplete])

    // ─── Update a single resolution's entity ───────────────────────
    const updateResolution = (index: number, field: string, value: string) => {
        setResolutions((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
        )
    }

    const reset = () => {
        setPhase("upload")
        setCsvColumns([])
        setCsvFileName("")
        setResolutions([])
        setUnmapped([])
        setEntitiesNeeded([])
        setError(null)
        setImportResult(null)
        setSfTables(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // ─── Render ────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm ml-2">{error}</AlertDescription>
                </Alert>
            )}

            {/* Phase: Upload CSV */}
            {phase === "upload" && (
                <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                        {isSnowflake
                            ? "Upload a sample CSV with the columns you need. The system will match each column against your Snowflake tables and pull data via SQL."
                            : "Upload a sample CSV file with the columns you need. The system will resolve each column to the right entity and pull cross-entity data automatically."}
                    </div>

                    <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        {csvColumns.length > 0 ? (
                            <div className="space-y-2">
                                <FileSpreadsheet className="h-10 w-10 mx-auto text-primary" />
                                <p className="font-medium">{csvFileName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {csvColumns.length} columns detected
                                </p>
                                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                                    {csvColumns.map((col) => (
                                        <Badge key={col} variant="secondary" className="text-xs">
                                            {col}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                                <p className="font-medium">Drop your CSV template here</p>
                                <p className="text-sm text-muted-foreground">
                                    or click to browse — even a header-only file works
                                </p>
                            </div>
                        )}
                    </div>

                    {csvColumns.length > 0 && (
                        <Button
                            onClick={resolveColumns}
                            className="w-full"
                            size="lg"
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Resolve Columns ({csvColumns.length})
                        </Button>
                    )}
                </div>
            )}

            {/* Phase: Resolving */}
            {phase === "resolving" && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">
                        Resolving columns across entities...
                    </p>
                </div>
            )}

            {/* Phase: Review resolutions */}
            {phase === "review" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-sm">Column Resolution</h4>
                            <p className="text-xs text-muted-foreground">
                                {resolutions.length} mapped, {unmapped.length} unmapped
                                {entitiesNeeded.length > 0 && ` — pulling from ${entitiesNeeded.join(", ")}`}
                                {sfTables && ` (scanned ${Object.keys(sfTables).length} tables)`}
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={reset}>
                            <X className="h-3.5 w-3.5 mr-1" /> Reset
                        </Button>
                    </div>

                    {/* Entities needed */}
                    {entitiesNeeded.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                            {entitiesNeeded.map((e) => (
                                <Badge key={e} variant="outline" className="text-xs">
                                    {e}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Resolution table */}
                    <div className="border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[1fr_120px_1fr_80px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                            <span>Your Column</span>
                            <span>{isSnowflake ? "Table" : "Entity"}</span>
                            <span>{isSnowflake ? "Column" : "Maps To"}</span>
                            <span>Confidence</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y">
                            {resolutions.map((res, i) => (
                                <div
                                    key={res.column}
                                    className="grid grid-cols-[1fr_120px_1fr_80px] gap-2 px-3 py-2 items-center text-sm"
                                >
                                    <span className="font-medium truncate" title={res.column}>
                                        {res.column}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                        {res.entity}
                                    </span>
                                    <span className="text-xs truncate" title={res.cdf_field}>
                                        {res.cdf_field}
                                    </span>
                                    <Badge
                                        variant={res.confidence >= 0.9 ? "default" : res.confidence >= 0.7 ? "secondary" : "outline"}
                                        className="text-xs justify-center"
                                    >
                                        {Math.round(res.confidence * 100)}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Unmapped columns */}
                    {unmapped.length > 0 && (
                        <Alert className="py-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs ml-2">
                                Unmapped: {unmapped.join(", ")}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Import button */}
                    <Button
                        onClick={runImport}
                        className="w-full"
                        size="lg"
                        disabled={resolutions.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        {isSnowflake
                            ? `Import from Snowflake (${resolutions.length} columns, ${entitiesNeeded.length} tables)`
                            : `Import Cross-Entity Data (${resolutions.length} columns, ${entitiesNeeded.length} entities)`}
                    </Button>
                </div>
            )}

            {/* Phase: Importing */}
            {phase === "importing" && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-sm text-muted-foreground">
                        {isSnowflake
                            ? `Querying Snowflake tables: ${entitiesNeeded.join(", ")}...`
                            : `Pulling data from ${entitiesNeeded.join(", ")}...`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {isSnowflake
                            ? "Executing SQL and building your file"
                            : "Joining across entities and building your file"}
                    </p>
                </div>
            )}

            {/* Phase: Done */}
            {phase === "done" && importResult && (
                <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50 py-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <AlertDescription className="text-sm text-green-900 ml-2">
                            {importResult.message}
                        </AlertDescription>
                    </Alert>

                    <div className="text-sm space-y-1 text-muted-foreground">
                        <p>File: <span className="font-medium text-foreground">{importResult.filename}</span></p>
                        <p>Rows: <span className="font-medium text-foreground">{importResult.records_imported}</span></p>
                        <p>{isSnowflake ? "Tables" : "Entities"}: <span className="font-medium text-foreground">{importResult.entities_used?.join(", ")}</span></p>
                        <p>Columns: <span className="font-medium text-foreground">{importResult.columns?.join(", ")}</span></p>
                    </div>

                    <Button variant="outline" onClick={reset} className="w-full">
                        Import Another Schema
                    </Button>
                </div>
            )}
        </div>
    )
}
