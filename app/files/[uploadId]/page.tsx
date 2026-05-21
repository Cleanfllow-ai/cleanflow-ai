/**
 * app/files/[uploadId]/page.tsx
 *
 * W5B-3 (2026-05-19) — Dedicated file-details page route.
 *
 * Persona ask (Sarah / Emily / Marcus): "The file details dialog has 5 tabs
 * and is too cramped. I can't deep-link to a specific tab. URL doesn't change."
 *
 * Solution: a real Next.js page at `/files/{uploadId}` with the tab driven by
 * the `?tab=` search param so the user can:
 *   - Deep-link to any tab (e.g. /files/abc?tab=dq-report)
 *   - Refresh and land back on the same tab
 *   - Share a URL with a teammate
 *
 * Implementation:
 *   - Reuses the existing `useFileDetails` hook (no duplication of the
 *     download / preview / matrix wiring).
 *   - Reuses the per-tab content components from
 *     `components/file-details/*` (same as the modal).
 *   - The legacy `<FileDetailsDialog>` modal stays alive for any caller that
 *     opens it explicitly (back-compat); /files page now navigates here on
 *     row click instead.
 *
 * Allowed tabs: details | preview | dq-report | lineage | metadata | audit |
 *               versions
 * (Same set as the dialog; `audit` was added later and is not in the
 * `FileDetailsTab` type — we still cast to keep the dialog API stable.)
 */
'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  GitBranch,
  History,
  ListTree,
  Loader2,
  PieChart as PieChartIcon,
  Server,
  Table as TableIcon,
  Tags,
} from 'lucide-react'

import { AuthGuard, useAuth } from '@/modules/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/shared/lib/utils'
import { MainLayout } from '@/shared/layout/main-layout'
import {
  fileManagementAPI,
  type FileStatusResponse,
} from '@/modules/files/api/file-management-api'
import { useFileDetails } from '@/modules/files/hooks/use-file-details'

import { DqMatrixDialog } from '@/modules/files/components/dq-matrix-dialog'
import { FileAuditLogTab } from '@/modules/files/components/file-details/file-audit-log-tab'
import { FileDqReportTab } from '@/modules/files/components/file-details/file-dq-report-tab'
import { FileLineageTab } from '@/modules/files/components/file-details/file-lineage-tab'
import { FileMetadataTab } from '@/modules/files/components/file-details/file-metadata-tab'
import { FileOverviewTab } from '@/modules/files/components/file-details/file-overview-tab'
import { FilePreviewTab } from '@/modules/files/components/file-details/file-preview-tab'
import { FileVersionHistory } from '@/modules/files/components/file-version-history'
import { OptimizingBadge } from '@/modules/files/components/optimizing-badge'

type TabId =
  | 'details'
  | 'preview'
  | 'dq-report'
  | 'lineage'
  | 'metadata'
  | 'audit'
  | 'versions'

const VALID_TABS: readonly TabId[] = [
  'details',
  'preview',
  'dq-report',
  'lineage',
  'metadata',
  'audit',
  'versions',
]

interface PageProps {
  params: Promise<{ uploadId: string }>
}

export default function FileDetailsPage({ params }: PageProps) {
  return (
    <AuthGuard>
      <MainLayout>
        <FileDetailsPageContent params={params} />
      </MainLayout>
    </AuthGuard>
  )
}

function FileDetailsPageContent({ params }: PageProps) {
  const { uploadId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { idToken } = useAuth()

  // ── Fetch the file once on mount.  The dialog historically received the
  //    full FileStatusResponse from the parent (files-page row click), but
  //    a deep-link / refresh has no parent — so we fetch fresh here.
  const [file, setFile] = useState<FileStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Distinguish "file not found / deleted" (404) from other errors so we can
  // render the dedicated empty-state UI instead of a silent redirect or a
  // generic error string. Pre-fix behaviour was to fall through into the
  // generic `error || 'File not found.'` branch which made stale deep-links
  // look identical to network failures and offered no recovery affordance
  // beyond a Back button.
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!uploadId || !idToken) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setNotFound(false)
    fileManagementAPI
      .getFileStatus(uploadId, idToken)
      .then((resp) => {
        if (!cancelled) setFile(resp as FileStatusResponse)
      })
      .catch((err: any) => {
        if (cancelled) return
        const status = err?.status
        const msg = (err?.message || '').toLowerCase()
        const isNotFound =
          status === 404 || msg.includes('not found') || msg.includes('does not exist')
        if (isNotFound) {
          setNotFound(true)
        } else {
          setError(err?.message || 'Failed to load file')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [uploadId, idToken])

  // ── URL-driven tab.  Read `?tab=`, validate, fall back to 'details'.
  const urlTab = searchParams?.get('tab') as TabId | null
  const initialTab: TabId =
    urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'details'

  const details = useFileDetails(file, /* open */ true, initialTab as any)

  // ── Bidirectional sync: URL → activeTab (on back/forward) and
  //    activeTab → URL (on tab click).  Uses replace so the back stack
  //    doesn't fill with per-tab entries.
  useEffect(() => {
    if (!urlTab) return
    if (!VALID_TABS.includes(urlTab)) return
    if ((details.activeTab as string) === urlTab) return
    details.setActiveTab(urlTab as any)
  }, [urlTab, details])

  const setTab = useCallback(
    (next: TabId) => {
      details.setActiveTab(next as any)
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.set('tab', next)
      router.replace(`/files/${uploadId}?${params.toString()}`, {
        scroll: false,
      })
    },
    [details, router, uploadId, searchParams],
  )

  const resolvedFile = details.currentFile || file

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase() || ''
    if (
      s.includes('FIXED') ||
      s.includes('COMPLETED') ||
      s.includes('PROCESSED')
    ) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-green-500/10 dark:text-green-500 dark:border-green-500/20'
    }
    if (s.includes('FAILED'))
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20'
    if (
      s.includes('RUNNING') ||
      s.includes('PROCESSING') ||
      s.includes('QUEUED')
    ) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-yellow-500/10 dark:text-yellow-500 dark:border-yellow-500/20'
    }
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20'
  }

  const isDqMatrixReady = useMemo(() => {
    if (!resolvedFile) return false
    const status = (resolvedFile.status || '').toUpperCase()
    return (
      status.includes('DQ_COMPLETE') ||
      status.includes('DQ_FIXED') ||
      status.includes('COMPLETED') ||
      status.includes('PROCESSED')
    )
  }, [resolvedFile])

  const versionOptions = useMemo(
    () =>
      [...details.versions].sort(
        (a, b) => (b.version_number || 0) - (a.version_number || 0),
      ),
    [details.versions],
  )

  // ── Loading / error states.
  if (loading) {
    return (
      <div
        className="flex h-[60vh] items-center justify-center"
        data-testid="file-page-loading"
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  // P0 fix (Bug #1, 2026-05-21): deep-link to a deleted / stale file used to
  // fall through to the generic error branch (or, before the route existed,
  // silently redirect). Render a dedicated empty-state card so the user
  // knows *why* the file is missing and how to recover.
  if (notFound || (!error && !resolvedFile)) {
    return (
      <div
        className="flex h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
        data-testid="file-page-not-found"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/40 bg-muted/40">
          <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <div className="space-y-1.5">
          <p className="font-sans text-sm font-semibold tracking-tight">
            File not found
          </p>
          <p className="max-w-md text-xs text-muted-foreground/80">
            This file may have been deleted, or the link is no longer valid. It
            could have been removed in another session or by another user in
            your organization.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => router.push('/files')}
          data-testid="file-not-found-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to catalog
        </Button>
      </div>
    )
  }
  if (error || !resolvedFile) {
    return (
      <div
        className="flex h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
        data-testid="file-page-error"
      >
        <p>{error || 'File not found.'}</p>
        <Button variant="outline" onClick={() => router.push('/files')}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to files
        </Button>
      </div>
    )
  }

  const activeTab = details.activeTab as TabId

  return (
    <>
      <div
        className="flex h-full flex-col"
        data-testid="file-details-page"
        data-upload-id={resolvedFile.upload_id}
      >
        {/* Header */}
        <div className="border-b bg-background px-6 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => router.push('/files')}
                  data-testid="file-page-back"
                >
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Files
                </Button>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <h1 className="flex items-center gap-2.5 truncate font-sans text-base font-semibold tracking-tight">
                  <span className="truncate">
                    {resolvedFile.original_filename ||
                      resolvedFile.filename ||
                      'File'}
                  </span>
                </h1>
                {resolvedFile.status === 'OPTIMIZING' ||
                resolvedFile.status === 'OPTIMIZE_FAILED' ? (
                  <OptimizingBadge
                    status={resolvedFile.status}
                    errorReason={resolvedFile.error_reason}
                    className="shrink-0"
                  />
                ) : (
                  <Badge
                    className={cn(
                      'shrink-0 text-[10px] font-medium',
                      getStatusColor(resolvedFile.status),
                    )}
                    variant="outline"
                  >
                    {resolvedFile.status}
                  </Badge>
                )}
                {details.versionInfo && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] font-medium"
                  >
                    v{details.versionInfo.versionNumber}
                    <span className="ml-1 text-muted-foreground">
                      of {details.versionInfo.totalVersions}
                    </span>
                  </Badge>
                )}
              </div>
            </div>
            {versionOptions.length > 0 && (
              <div className="w-full shrink-0 lg:w-[320px]">
                <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Viewing Version
                </div>
                <Select
                  value={
                    details.selectedVersionUploadId || resolvedFile.upload_id
                  }
                  onValueChange={details.setSelectedVersionUploadId}
                  disabled={details.versionsLoading}
                >
                  <SelectTrigger className="h-10 bg-background/80">
                    <SelectValue
                      placeholder={
                        details.selectedVersion
                          ? `v${details.selectedVersion.version_number}`
                          : 'Select version'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {versionOptions.map((version) => (
                      <SelectItem
                        key={version.upload_id}
                        value={version.upload_id}
                      >
                        {`v${version.version_number} | ${version.status || 'Unknown'}${version.is_latest ? ' | Latest' : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="border-b bg-background px-6 py-2"
          data-testid="file-page-tabs"
        >
          <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
            {(
              [
                { id: 'details', label: 'Details', icon: Server },
                { id: 'preview', label: 'Preview', icon: TableIcon },
                ...(isDqMatrixReady
                  ? [
                      {
                        id: 'dq-report' as TabId,
                        label: 'DQ Report',
                        icon: PieChartIcon,
                      },
                    ]
                  : []),
                { id: 'lineage', label: 'Lineage', icon: ListTree },
                { id: 'metadata', label: 'Metadata', icon: Tags },
                { id: 'audit', label: 'Audit Log', icon: History },
                { id: 'versions', label: 'Versions', icon: GitBranch },
              ] as Array<{
                id: TabId
                label: string
                icon: typeof Server
              }>
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                data-testid={`file-page-tab-${id}`}
                data-active={activeTab === id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeTab === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="relative flex-1 overflow-auto">
          {activeTab === 'details' && (
            <FileOverviewTab
              file={resolvedFile}
              versionInfo={details.versionInfo}
            />
          )}
          {activeTab === 'preview' && (
            <FilePreviewTab
              previewLoading={details.previewLoading}
              previewError={details.previewError}
              previewErrorKind={details.previewErrorKind}
              previewData={details.previewData}
              synthesisedColumns={details.dqReport?.synthesised_columns}
              onRetry={details.loadPreview}
              onOpenEditor={
                resolvedFile
                  ? () =>
                      router.push(
                        `/files/${resolvedFile.upload_id}/quarantine?returnTo=/files`,
                      )
                  : undefined
              }
              onRefreshList={() => router.push('/files')}
            />
          )}
          {activeTab === 'dq-report' && (
            <FileDqReportTab
              file={resolvedFile}
              dqReport={details.dqReport}
              dqReportLoading={details.dqReportLoading}
              dqReportError={details.dqReportError}
              isDqMatrixReady={isDqMatrixReady}
              downloadingMatrix={details.downloadingMatrix}
              downloading={details.downloading}
              issues={details.issues}
              issuesTotal={details.issuesTotal}
              issuesNextOffset={details.issuesNextOffset}
              issuesLoading={details.issuesLoading}
              availableViolations={details.availableViolations}
              selectedViolations={details.selectedViolations}
              setSelectedViolations={details.setSelectedViolations}
              openMatrixDialog={details.openMatrixDialog}
              handleDownloadDqReport={details.handleDownloadDqReport}
              fetchIssues={details.fetchIssues}
            />
          )}
          {activeTab === 'lineage' && (
            <FileLineageTab
              file={resolvedFile}
              versions={details.versions}
              versionsLoading={details.versionsLoading}
              selectedUploadId={
                details.selectedVersionUploadId || resolvedFile.upload_id
              }
              onSelectVersion={details.setSelectedVersionUploadId}
            />
          )}
          {activeTab === 'metadata' && (
            <FileMetadataTab file={resolvedFile} versions={details.versions} />
          )}
          {activeTab === 'audit' && (
            <FileAuditLogTab uploadId={resolvedFile.upload_id} />
          )}
          {activeTab === 'versions' && idToken && (
            <div className="overflow-auto px-6 py-4">
              <FileVersionHistory
                rootUploadId={
                  resolvedFile.root_upload_id || resolvedFile.upload_id
                }
                authToken={idToken}
                selectedUploadId={details.selectedVersionUploadId}
                onSelectVersion={(version) =>
                  details.setSelectedVersionUploadId(version.upload_id)
                }
              />
            </div>
          )}
        </div>
      </div>

      <DqMatrixDialog
        open={details.matrixDialogOpen}
        onOpenChange={details.setMatrixDialogOpen}
        limit={details.matrixLimit}
        start={details.matrixStart}
        end={details.matrixEnd}
        setLimit={details.setMatrixLimit}
        setStart={details.setMatrixStart}
        setEnd={details.setMatrixEnd}
        totals={details.matrixTotals}
        loadingTotals={details.matrixLoadingTotals}
        onDownload={details.handleDownloadDqMatrix}
        downloading={details.downloadingMatrix}
      />
    </>
  )
}
