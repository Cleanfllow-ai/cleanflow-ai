"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Download, Plus, RefreshCw, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/modules/auth"
import {
    getAugmentationJobOutput, listAugmentationJobs,
} from "@/modules/augmentation/api/augmentation-api"
import type { AugmentationJob, AugmentationJobStatus } from "@/modules/augmentation/types"
import { NewJobForm } from "./new-job-form"
import { PromptTemplateManager } from "./prompt-template-manager"

/** Scrub raw AWS / APIG internal error strings that must never reach the DOM. */
function sanitizeErrorMessage(raw: string): string {
    // AWS SigV4 parse error: "Invalid key=value pair (missing equal-sign) in Authorization header..."
    if (/Invalid key=value pair.*Authorization header/i.test(raw)) {
        return "Unable to reach the augmentation service. Please refresh and try again."
    }
    // Generic APIG / IAM auth rejection bleed
    if (/Authorization header.*SHA-256.*Base64/i.test(raw) || /hashed with SHA-256/i.test(raw)) {
        return "Authentication error. Please sign out and sign in again."
    }
    return raw
}

const TONE: Record<AugmentationJobStatus, string> = {
    PENDING: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    RUNNING: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    SUCCEEDED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    FAILED: "bg-red-500/10 text-red-500 border-red-500/30",
}

const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant="outline"
        className={`uppercase tracking-wide text-[11px] ${TONE[status as AugmentationJobStatus] || "border"}`}
        data-testid={`aug-status-${status}`}>{status}</Badge>
)

export function AugmentationPage() {
    const { idToken } = useAuth()
    const [jobs, setJobs] = useState<AugmentationJob[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newOpen, setNewOpen] = useState(false)
    const [selected, setSelected] = useState<AugmentationJob | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>("all")

    const refresh = useCallback(async () => {
        if (!idToken) return
        setLoading(true)
        try { setJobs(await listAugmentationJobs(idToken, 50)); setError(null) }
        catch (err) { setError(sanitizeErrorMessage((err as Error).message)) }
        finally { setLoading(false) }
    }, [idToken])

    useEffect(() => { void refresh() }, [refresh])

    const downloadOutput = async (j: AugmentationJob) => {
        if (!idToken) return
        try {
            const out = await getAugmentationJobOutput(j.job_id, idToken)
            window.open(out.presigned_url, "_blank", "noopener,noreferrer")
        } catch (err) { setError(sanitizeErrorMessage((err as Error).message)) }
    }

    return (
        <div className="space-y-6 p-6" data-testid="augmentation-page">
            <header className="flex items-center justify-between gap-2">
                <h1 className="text-2xl font-semibold">AI Data Augmentation</h1>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
                    </Button>
                    <Button size="sm" onClick={() => setNewOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />New job
                    </Button>
                </div>
            </header>
            <Tabs defaultValue="jobs">
                <TabsList>
                    <TabsTrigger value="jobs">Jobs</TabsTrigger>
                    <TabsTrigger value="templates">Prompt templates</TabsTrigger>
                </TabsList>
                <TabsContent value="jobs" className="mt-4">
                    {error && <p className="text-sm text-red-500 mb-2" role="alert">{error}</p>}
                    <div className="mb-3">
                        <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="aug-status-filter-select">
                            <SelectTrigger className="w-[160px] h-8 text-sm" data-testid="aug-status-filter-trigger">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="RUNNING">Running</SelectItem>
                                <SelectItem value="SUCCEEDED">Completed</SelectItem>
                                <SelectItem value="FAILED">Failed</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Job ID</TableHead><TableHead>Status</TableHead>
                                <TableHead>Template</TableHead><TableHead className="text-right">Rows out</TableHead>
                                <TableHead className="text-right">Cost (USD)</TableHead><TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jobs.length === 0 && !loading && (
                                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">
                                    No augmentation jobs yet.</TableCell></TableRow>
                            )}
                            {jobs
                            .filter((j) => statusFilter === "all" || j.status === statusFilter)
                            .map((j) => (
                                <TableRow key={j.job_id} data-testid={`aug-row-${j.job_id}`}
                                    onClick={() => setSelected(j)} className="cursor-pointer">
                                    <TableCell className="font-mono text-xs">
                                        <Link href={`/augmentation/jobs/${j.job_id}`} onClick={(e) => e.stopPropagation()}>
                                            {j.job_id.slice(0, 12)}…</Link>
                                    </TableCell>
                                    <TableCell><StatusBadge status={j.status} /></TableCell>
                                    <TableCell className="text-xs">{j.template_id || "—"}</TableCell>
                                    <TableCell className="text-right">{j.output_rows_count ?? "—"}</TableCell>
                                    <TableCell className="text-right">
                                        {j.cost_actual_usd != null ? `$${j.cost_actual_usd.toFixed(4)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {j.created_at?.slice(0, 19).replace("T", " ")}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="ghost"
                                            disabled={j.status !== "SUCCEEDED"}
                                            onClick={(e) => { e.stopPropagation(); void downloadOutput(j) }}
                                            aria-label={`Download ${j.job_id}`}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
                <TabsContent value="templates" className="mt-4"><PromptTemplateManager /></TabsContent>
            </Tabs>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>New augmentation job</DialogTitle></DialogHeader>
                    <NewJobForm onSuccess={() => { setNewOpen(false); void refresh() }}
                        onCancel={() => setNewOpen(false)} />
                </DialogContent>
            </Dialog>
            <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <SheetContent className="w-[480px] sm:max-w-md">
                    <SheetHeader><SheetTitle className="font-mono text-sm">{selected?.job_id}</SheetTitle></SheetHeader>
                    {selected && (
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <StatusBadge status={selected.status} />
                                {selected.sox_audit_enabled && (
                                    <Badge variant="outline" className="gap-1" data-testid="sox-badge">
                                        <ShieldCheck className="h-3 w-3" />SOX lineage</Badge>
                                )}
                            </div>
                            <div><span className="text-muted-foreground">Template: </span>{selected.template_id || "—"}</div>
                            <div><span className="text-muted-foreground">Rows: </span>{selected.output_rows_count ?? "—"}</div>
                            <div><span className="text-muted-foreground">Cost: </span>
                                {selected.cost_actual_usd != null ? `$${selected.cost_actual_usd}` : "—"}</div>
                            {selected.error_message && <p className="text-red-500">{sanitizeErrorMessage(selected.error_message)}</p>}
                            <Link href={`/augmentation/jobs/${selected.job_id}`}
                                className="text-blue-500 underline text-xs">Open full detail →</Link>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
