"use client"

import { Loader2, Snowflake, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { WarehouseMetadataItem } from "@/modules/connectors/types"

export interface SnowflakeEntitySelectorProps {
    label: string
    connected: boolean
    isConnecting?: boolean
    onConnect?: () => void
    warehouses: WarehouseMetadataItem[]
    databases: WarehouseMetadataItem[]
    schemas: WarehouseMetadataItem[]
    tables: WarehouseMetadataItem[]
    selectedWarehouse: string
    selectedDatabase: string
    selectedSchema: string
    selectedTable: string
    onWarehouseChange: (v: string) => void
    onDatabaseChange: (v: string) => void
    onSchemaChange: (v: string) => void
    onTableChange: (v: string) => void
    loading: boolean
}

export function SnowflakeEntitySelector({
    label,
    connected,
    isConnecting,
    onConnect,
    warehouses,
    databases,
    schemas,
    tables,
    selectedWarehouse,
    selectedDatabase,
    selectedSchema,
    selectedTable,
    onWarehouseChange,
    onDatabaseChange,
    onSchemaChange,
    onTableChange,
    loading,
}: SnowflakeEntitySelectorProps) {
    if (!connected) {
        return (
            <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed rounded-lg bg-muted/5">
                <Snowflake className="h-6 w-6 text-blue-600 mb-2" />
                <p className="text-xs text-muted-foreground mb-2">
                    Connect Snowflake to select {label.toLowerCase()} table
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="h-7 text-xs"
                >
                    {isConnecting ? (
                        <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Connecting...</>
                    ) : (
                        <><Link2 className="mr-1 h-3 w-3" /> Connect</>
                    )}
                </Button>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-xs text-muted-foreground">Loading metadata...</span>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <Label className="text-xs font-medium">{label} (Snowflake)</Label>
            <div className="grid grid-cols-2 gap-2">
                {warehouses.length > 0 && (
                    <div>
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Warehouse</Label>
                        <Select value={selectedWarehouse} onValueChange={onWarehouseChange}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map((wh) => (
                                    <SelectItem key={wh.name} value={wh.name} className="text-xs">
                                        {wh.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Database</Label>
                    <Select value={selectedDatabase} onValueChange={onDatabaseChange}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Database" />
                        </SelectTrigger>
                        <SelectContent>
                            {databases.map((db) => (
                                <SelectItem key={db.name} value={db.name} className="text-xs">
                                    {db.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Schema</Label>
                    <Select
                        value={selectedSchema}
                        onValueChange={onSchemaChange}
                        disabled={!selectedDatabase}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={selectedDatabase ? "Schema" : "Select DB first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {schemas.map((sch) => (
                                <SelectItem key={sch.name} value={sch.name} className="text-xs">
                                    {sch.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Table</Label>
                    <Select
                        value={selectedTable}
                        onValueChange={onTableChange}
                        disabled={!selectedSchema}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={selectedSchema ? "Table" : "Select schema first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {tables.map((tbl) => (
                                <SelectItem key={tbl.name} value={tbl.name} className="text-xs">
                                    <span className="flex items-center gap-1">
                                        {tbl.name}
                                        {tbl.rows !== undefined && (
                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                                {tbl.rows.toLocaleString()}
                                            </Badge>
                                        )}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
