/**
 * file-version-history.tsx
 *
 * Component for displaying and managing file version history
 * Shows version lineage with download, preview and reprocess actions
 */

'use client'

import { useEffect, useState } from 'react'
import { Download, Eye, GitBranch, Loader2, Play, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/shared/hooks/use-toast'
import {
  fileManagementAPI,
  type FileVersionSummary,
} from '@/modules/files'
import { FilePreviewTab } from '@/modules/files/components/file-details/file-preview-tab'
import type { FilePreviewData } from '@/modules/files/types'

interface FileVersionHistoryProps {
  rootUploadId: string
  authToken: string
}

function dqScoreColor(score?: number | null): string {
  if (score == null) return 'text-muted-foreground'
  if (score >= 90) return 'text-green-600'
  if (score >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

function statusBadgeVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch ((status || '').toUpperCase()) {
    case 'DQ_FIXED':
    case 'COMPLETED':
      return 'default'
    case 'DQ_FAILED':
    case 'FAILED':
    case 'REJECTED':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const PROCESSABLE = new Set(['UPLOADED', 'VALIDATED'])
const PROCESSED = new Set(['DQ_FIXED', 'COMPLETED', 'DQ_COMPLETE'])

export function FileVersionHistory({ rootUploadId, authToken }: FileVersionHistoryProps) {
  const [versions, setVersions] = useState<FileVersionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [fileDownloadingId, setFileDownloadingId] = useState<string | null>(null)
  const [quarantineDownloadingId, setQuarantineDownloadingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [previewVersion, setPreviewVersion] = useState<FileVersionSummary | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  const [previewCache, setPreviewCache] = useState<Record<string, FilePreviewData>>({})
  const { toast } = useToast()

  useEffect(() => {
    if (!rootUploadId || !authToken) return
    setLoading(true)
    fileManagementAPI
      .getFileVersions(rootUploadId, authToken)
      .then((res) => setVersions(res.versions ?? []))
      .catch(() => toast({ title: 'Failed to load version history', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [rootUploadId, authToken, toast])

  async function handleProcess(uploadId: string) {
    setProcessingId(uploadId)
    try {
      await fileManagementAPI.startProcessing(uploadId, authToken)
      setVersions((prev) =>
        prev.map((v) => (v.upload_id === uploadId ? { ...v, status: 'DQ_DISPATCHED' } : v))
      )
      toast({ title: 'Processing started', description: 'DQ engine is running on this version.' })
    } catch {
      toast({ title: 'Failed to start processing', variant: 'destructive' })
    } finally {
      setProcessingId(null)
    }
  }

  async function handleDownloadVersion(v: FileVersionSummary) {
    setFileDownloadingId(v.upload_id)
    const isProcessed = PROCESSED.has((v.status ?? '').toUpperCase())
    const dataType = isProcessed ? 'clean' : 'raw'
    try {
      const blob = await fileManagementAPI.downloadFile(v.upload_id, 'csv', dataType as any, authToken)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const base = (v.original_filename ?? v.upload_id).replace(/\.[^.]+$/, '')
      a.download = `${base}_v${v.version_number}_${dataType}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' })
    } finally {
      setFileDownloadingId(null)
    }
  }

  async function handleDownloadQuarantined(uploadId: string) {
    setQuarantineDownloadingId(uploadId)
    try {
      const res = await fileManagementAPI.getQuarantinedExportUrl(uploadId, authToken)
      if (!res.url) {
        toast({
          title: 'No quarantined rows',
          description: 'This version has no quarantined data to download.',
        })
        return
      }
      const a = document.createElement('a')
      a.href = res.url
      a.download = res.filename ?? 'quarantined.csv'
      a.click()
      toast({ title: `Downloading ${res.row_count} quarantined rows` })
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' })
    } finally {
      setQuarantineDownloadingId(null)
    }
  }

  async function handleOpenPreview(v: FileVersionSummary) {
    setPreviewVersion(v)
    if (previewCache[v.upload_id]) return
    setPreviewLoadingId(v.upload_id)
    try {
      const data = await fileManagementAPI.getFilePreview(v.upload_id, authToken)
      setPreviewCache((prev) => ({ ...prev, [v.upload_id]: data as FilePreviewData }))
    } catch {
      toast({ title: 'Failed to load preview', variant: 'destructive' })
      setPreviewVersion(null)
    } finally {
      setPreviewLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading version history…
      </div>
    )
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No version history found.</p>
  }

  const previewData = previewVersion ? previewCache[previewVersion.upload_id] ?? null : null
  const isPreviewLoading = previewVersion ? previewLoadingId === previewVersion.upload_id : false

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4" />
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-2 pr-2">
            {[...versions].reverse().map((v, i) => (
              <div key={v.upload_id}>
                {i > 0 && <Separator className="my-2" />}
                <div className="flex items-start justify-between gap-3">
                  {/* Left: version info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        v{v.version_number}
                      </Badge>
                      <Badge variant={statusBadgeVariant(v.status)} className="text-xs">
                        {v.status ?? '—'}
                      </Badge>
                      {v.dq_score != null && (
                        <span className={`text-xs font-semibold ${dqScoreColor(v.dq_score)}`}>
                          {v.dq_score.toFixed(1)}% DQ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{v.original_filename}</p>
                    {v.patch_notes && (
                      <p className="text-xs text-muted-foreground italic">"{v.patch_notes}"</p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {v.rows_quarantined != null && <span>{v.rows_quarantined} quarantined</span>}
                      {v.rows_clean != null && <span>{v.rows_clean} clean</span>}
                      {v.uploaded_at && <span>{new Date(v.uploaded_at).toLocaleDateString()}</span>}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Preview */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      onClick={() => handleOpenPreview(v)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>

                    {/* Download file */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      disabled={fileDownloadingId === v.upload_id}
                      onClick={() => handleDownloadVersion(v)}
                    >
                      {fileDownloadingId === v.upload_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {PROCESSED.has((v.status ?? '').toUpperCase()) ? 'Clean CSV' : 'Raw CSV'}
                    </Button>

                    {/* Process (only for UPLOADED/VALIDATED) */}
                    {PROCESSABLE.has((v.status ?? '').toUpperCase()) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-green-600 hover:text-green-700"
                        disabled={processingId === v.upload_id}
                        onClick={() => handleProcess(v.upload_id)}
                      >
                        {processingId === v.upload_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Process
                      </Button>
                    )}

                    {/* Download quarantined (only when rows exist) */}
                    {(v.rows_quarantined ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        disabled={quarantineDownloadingId === v.upload_id}
                        onClick={() => handleDownloadQuarantined(v.upload_id)}
                      >
                        {quarantineDownloadingId === v.upload_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Quarantined
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={(open) => { if (!open) setPreviewVersion(null) }}>
        <DialogContent className="max-w-5xl w-full h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span>File Preview</span>
                  {previewVersion && (
                    <Badge variant="outline" className="font-mono text-sm">
                      v{previewVersion.version_number}
                    </Badge>
                  )}
                  {previewVersion && (
                    <Badge variant={statusBadgeVariant(previewVersion.status)}>
                      {previewVersion.status ?? '—'}
                    </Badge>
                  )}
                  {previewVersion?.dq_score != null && (
                    <span className={`text-sm font-semibold ${dqScoreColor(previewVersion.dq_score)}`}>
                      {previewVersion.dq_score.toFixed(1)}% DQ Score
                    </span>
                  )}
                </DialogTitle>
                {previewVersion && (
                  <p className="text-sm text-muted-foreground truncate">
                    {previewVersion.original_filename}
                  </p>
                )}
                {previewVersion && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {previewVersion.rows_in != null && (
                      <span>{previewVersion.rows_in} rows total</span>
                    )}
                    {previewVersion.rows_fixed != null && previewVersion.rows_fixed > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        {previewVersion.rows_fixed} fixed
                      </span>
                    )}
                    {previewVersion.rows_clean != null && previewVersion.rows_clean > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        {previewVersion.rows_clean} no issues
                      </span>
                    )}
                    {previewVersion.rows_quarantined != null && previewVersion.rows_quarantined > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                        {previewVersion.rows_quarantined} quarantined
                      </span>
                    )}
                    {previewVersion.uploaded_at && (
                      <span>{new Date(previewVersion.uploaded_at).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <FilePreviewTab
              previewLoading={isPreviewLoading}
              previewError={null}
              previewData={previewData}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
