'use client'

import { useState, useMemo } from 'react'
import { ArrowRight, Search, X, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export interface FieldDef {
    key: string
    label?: string
    data_type?: string
    required?: boolean
}

interface ColumnMappingEditorProps {
    sourceFields: FieldDef[]
    destFields: FieldDef[]
    mapping: Record<string, string>
    onMappingChange: (mapping: Record<string, string>) => void
    onClose: () => void
    onAutoMap?: () => void
    autoMapLoading?: boolean
    sourceLabel?: string
    destLabel?: string
}

export function ColumnMappingEditor({
    sourceFields,
    destFields,
    mapping,
    onMappingChange,
    onClose,
    onAutoMap,
    autoMapLoading,
    sourceLabel = 'Source',
    destLabel = 'Destination',
}: ColumnMappingEditorProps) {
    const [search, setSearch] = useState('')

    const mappedCount = useMemo(
        () => Object.values(mapping).filter(Boolean).length,
        [mapping],
    )

    const usedDestKeys = useMemo(
        () => new Set(Object.values(mapping).filter(Boolean)),
        [mapping],
    )

    const filteredSourceFields = useMemo(() => {
        if (!search) return sourceFields
        const q = search.toLowerCase()
        return sourceFields.filter(
            f => (f.key || '').toLowerCase().includes(q)
                || (f.label || '').toLowerCase().includes(q),
        )
    }, [sourceFields, search])

    const handleFieldMap = (sourceKey: string, destKey: string) => {
        const next = { ...mapping }
        if (destKey === '__none__') {
            delete next[sourceKey]
        } else {
            next[sourceKey] = destKey
        }
        onMappingChange(next)
    }

    const handleClearAll = () => {
        onMappingChange({})
    }

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">Column Mapping</h4>
                    <Badge variant="outline" className="text-xs">
                        {mappedCount} / {sourceFields.length} mapped
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {onAutoMap && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAutoMap}
                            disabled={autoMapLoading}
                            className="text-xs"
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {autoMapLoading ? 'Mapping...' : 'Auto-map'}
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs text-muted-foreground">
                        Clear All
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Filter fields..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                />
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_30px_1fr] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                <span>{sourceLabel} Field</span>
                <span />
                <span>{destLabel} Field</span>
            </div>

            {/* Field mapping rows */}
            <div className="max-h-[300px] overflow-y-auto space-y-1.5">
                {filteredSourceFields.map(srcField => {
                    const currentDest = mapping[srcField.key] || ''
                    const isMapped = Boolean(currentDest)

                    return (
                        <div
                            key={srcField.key}
                            className={`grid grid-cols-[1fr_30px_1fr] gap-2 items-center px-1 py-1 rounded text-xs ${
                                isMapped ? 'bg-emerald-500/5' : ''
                            }`}
                        >
                            {/* Source field */}
                            <div className="truncate" title={srcField.key}>
                                <span className="font-medium">{srcField.label || srcField.key}</span>
                                {srcField.label && srcField.label !== srcField.key && (
                                    <span className="text-muted-foreground ml-1 text-[10px]">
                                        {srcField.key}
                                    </span>
                                )}
                                {srcField.required && (
                                    <span className="text-red-500 ml-0.5">*</span>
                                )}
                            </div>

                            {/* Arrow */}
                            <ArrowRight className={`h-3 w-3 mx-auto ${
                                isMapped ? 'text-emerald-500' : 'text-muted-foreground/30'
                            }`} />

                            {/* Destination dropdown */}
                            <Select
                                value={currentDest || '__none__'}
                                onValueChange={val => handleFieldMap(srcField.key, val)}
                            >
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="Select field..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    <SelectItem value="__none__" className="text-xs text-muted-foreground">
                                        — Not mapped —
                                    </SelectItem>
                                    {destFields.map(df => {
                                        const isUsed = usedDestKeys.has(df.key) && df.key !== currentDest
                                        return (
                                            <SelectItem
                                                key={df.key}
                                                value={df.key}
                                                className="text-xs"
                                                disabled={isUsed}
                                            >
                                                {df.label || df.key}
                                                {isUsed && ' (used)'}
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    )
                })}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t">
                <Button size="sm" onClick={onClose}>
                    Done
                </Button>
            </div>
        </div>
    )
}
