"use client"

import { useState, useCallback, useRef, useEffect } from "react"
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
import { splitCSVLine } from "@/modules/files/utils/csv-parser"
import { getFileStatus } from "@/modules/files/api/file-upload-api"

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

    // Snowflake connection context (database + schema selectors)
    const [sfDatabase, setSfDatabase] = useState<string | null>(null)
    const [sfSchema, setSfSchema] = useState<string | null>(null)
    const [sfDatabases, setSfDatabases] = useState<string[]>([])
    const [sfSchemas, setSfSchemas] = useState<string[]>([])
    const [sfMetaLoading, setSfMetaLoading] = useState(false)

    const apiHeaders = useCallback(() => ({
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }), [token])

    // Fetch Snowflake databases + seed from connection defaults
    useEffect(() => {
        if (!isSnowflake || !token) return

        const headers = apiHeaders()

        // Load connection status (for defaults) + database list in parallel
        setSfMetaLoading(true)
        Promise.all([
            fetch(`${API_BASE}/snowflake/connections`, { method: "GET", headers })
                .then((r) => r.json()).catch(() => ({})),
            fetch(`${API_BASE}/snowflake/databases`, { method: "GET", headers })
                .then((r) => r.json()).catch(() => ({ items: [] })),
        ]).then(([status, dbResp]) => {
            const dbList = (dbResp.items || []).map((d: { name: string }) => d.name)
            setSfDatabases(dbList)

            // Seed from user's saved connection
            const defaultDb = status.sf_user_database
            const defaultSc = status.sf_user_schema
            if (defaultDb) {
                setSfDatabase(defaultDb)
                // Load schemas for the default database
                fetch(`${API_BASE}/snowflake/schemas?database=${encodeURIComponent(defaultDb)}`, { method: "GET", headers })
                    .then((r) => r.json())
                    .then((scResp) => {
                        const scList = (scResp.items || []).map((s: { name: string }) => s.name)
                        setSfSchemas(scList)
                        if (defaultSc) setSfSchema(defaultSc)
                    })
                    .catch(() => {})
            }
        }).finally(() => setSfMetaLoading(false))
    }, [isSnowflake, token, apiHeaders])

    // When user changes database, reload schemas
    const handleDatabaseChange = useCallback((db: string) => {
        setSfDatabase(db)
        setSfSchema(null)
        setSfSchemas([])
        fetch(`${API_BASE}/snowflake/schemas?database=${encodeURIComponent(db)}`, {
            method: "GET",
            headers: apiHeaders(),
        })
            .then((r) => r.json())
            .then((scResp) => {
                setSfSchemas((scResp.items || []).map((s: { name: string }) => s.name))
            })
            .catch(() => {})
    }, [apiHeaders])

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
            // Parse first line as headers (handles quoted commas, escaped quotes)
            const firstLine = text.split(/\r?\n/)[0].trim()
            const headers = splitCSVLine(firstLine).map((h) => h.trim())
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
                body: JSON.stringify({
                    provider,
                    columns: csvColumns,
                    ...(sfDatabase && { database: sfDatabase }),
                    ...(sfSchema && { schema: sfSchema }),
                }),
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
    }, [csvColumns, provider, apiHeaders, sfDatabase, sfSchema])

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
                    ...(sfDatabase && { database: sfDatabase }),
                    ...(sfSchema && { schema: sfSchema }),
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

            // Async mode: backend offloaded to Lambda, poll until done
            if (data.poll && data.upload_id) {
                const maxAttempts = 90  // 3 minutes at 2s intervals
                for (let i = 0; i < maxAttempts; i++) {
                    await new Promise((r) => setTimeout(r, 2000))
                    try {
                        const fileStatus = await getFileStatus(data.upload_id, token)
                        if (fileStatus.status === "UPLOADED") {
                            setImportResult({
                                ...data,
                                records_imported: fileStatus.rows_in || data.records_imported,
                                columns_included: fileStatus.erp_metadata?.columns_mapped,
                                message: `Imported ${fileStatus.rows_in || "?"} rows from ${data.entities_used?.length || "?"} entities`,
                                status: "done",
                            })
                            setPhase("done")
                            onNotification?.(
                                `Imported ${fileStatus.rows_in || "?"} rows`,
                                "success"
                            )
                            if (data.upload_id) {
                                onImportComplete?.(data.upload_id)
                            }
                            return
                        }
                        if (fileStatus.status === "IMPORT_FAILED") {
                            throw new Error(fileStatus.erp_metadata?.error || "Import failed")
                        }
                    } catch (pollErr: any) {
                        if (pollErr.message?.includes("Import failed")) throw pollErr
                        // Transient poll error — keep trying
                    }
                }
                throw new Error("Import timed out — check your files list, it may still complete")
            }

            // Synchronous mode: result is already complete
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
    }, [resolutions, provider, apiHeaders, onNotification, onImportComplete, sfDatabase, sfSchema])

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
                            ? "Select your Snowflake database and schema, then upload a sample CSV. The system will scan all tables to match columns and pull cross-table data via SQL."
                            : "Upload a sample CSV file with the columns you need. The system will resolve each column to the right entity and pull cross-entity data automatically."}
                    </div>

                    {/* Snowflake: Database & Schema selectors */}
                    {isSnowflake && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Database</Label>
                                <Select
                                    value={sfDatabase || ""}
                                    onValueChange={handleDatabaseChange}
                                    disabled={sfMetaLoading}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder={sfMetaLoading ? "Loading..." : "Select database"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sfDatabases.map((db) => (
                                            <SelectItem key={db} value={db}>{db}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Schema</Label>
                                <Select
                                    value={sfSchema || ""}
                                    onValueChange={(sc) => setSfSchema(sc)}
                                    disabled={!sfDatabase || sfSchemas.length === 0}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder={!sfDatabase ? "Pick database first" : "Select schema"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sfSchemas.map((sc) => (
                                            <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

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
                            disabled={isSnowflake && (!sfDatabase || !sfSchema)}
                        >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {isSnowflake && (!sfDatabase || !sfSchema)
                                ? "Select database & schema first"
                                : `Resolve Columns (${csvColumns.length})`}
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
                                {isSnowflake && sfDatabase && sfSchema && (
                                    <span className="ml-1 text-muted-foreground/70">
                                        in {sfDatabase}.{sfSchema}
                                    </span>
                                )}
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
                        <p>Columns: <span className="font-medium text-foreground">
                            {importResult.columns_included ?? importResult.columns?.length} of {importResult.columns_total ?? importResult.columns?.length}
                        </span></p>
                        <p>{isSnowflake ? "Tables" : "Entities"}: <span className="font-medium text-foreground">{importResult.entities_used?.join(", ")}</span></p>
                    </div>

                    {(importResult.entities_no_data?.length > 0 || importResult.entities_not_joined?.length > 0) && (
                        <Alert className="border-amber-200 bg-amber-50 py-2">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-xs text-amber-800 ml-2 space-y-0.5">
                                {importResult.entities_no_data?.length > 0 && (
                                    <p>No data available: {importResult.entities_no_data.join(", ")}</p>
                                )}
                                {importResult.entities_not_joined?.length > 0 && (
                                    <p>Could not join: {importResult.entities_not_joined.join(", ")}</p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <Button variant="outline" onClick={reset} className="w-full">
                        Import Another Schema
                    </Button>
                </div>
            )}
        </div>
    )
}
