/**
 * quarantine-version-lineage.tsx
 *
 * Version lineage display component
 * Shows file version history in quarantine editor
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import type { FileVersionSummary } from '@/modules/files/types'

interface QuarantineVersionLineageProps {
  lineage: FileVersionSummary[]
  baseUploadId?: string
}

export function QuarantineVersionLineage({ lineage, baseUploadId }: QuarantineVersionLineageProps) {
  if (!lineage.length) return null

  return (
    <div className="px-4 py-2 border-b bg-muted/20">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {lineage.map((v, idx) => {
          const isBase = baseUploadId === v.upload_id
          const isLatest = Boolean(v.is_latest)
          return (
            <div key={v.upload_id} className="flex items-center gap-1 shrink-0">
              <Badge variant={isBase || isLatest ? 'default' : 'outline'} className="text-[11px]">
                v{v.version_number}
                {isBase ? ' base' : ''}
                {isLatest ? ' latest' : ''}
              </Badge>
              {idx < lineage.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
