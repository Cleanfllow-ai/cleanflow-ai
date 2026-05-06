/**
 * quarantine-version-lineage.tsx
 *
 * Version lineage display component
 * Shows file version history in quarantine editor
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, GitCompareArrows } from 'lucide-react'
import type { FileVersionSummary } from '@/modules/files/types'

interface QuarantineVersionLineageProps {
  lineage: FileVersionSummary[]
  baseUploadId?: string
  /** Optional callback to open the between-versions compare dialog. */
  onCompareVersions?: () => void
}

export function QuarantineVersionLineage({
  lineage,
  baseUploadId,
  onCompareVersions,
}: QuarantineVersionLineageProps) {
  if (!lineage.length) return null

  // Compare button only makes sense when there are at least two versions to diff.
  const showCompare = Boolean(onCompareVersions) && lineage.length >= 2

  return (
    <div className="px-4 py-2 border-b bg-muted/20">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-1 min-w-0">
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
        {showCompare && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCompareVersions}
            className="h-7 text-xs font-medium px-2.5 shrink-0"
            title="Compare two versions of this file"
          >
            <GitCompareArrows className="w-3 h-3 mr-1.5" />
            Compare versions
          </Button>
        )}
      </div>
    </div>
  )
}
