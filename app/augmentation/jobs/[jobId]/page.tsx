"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, RefreshCw, ShieldCheck } from "lucide-react"

import { AuthGuard, useAuth } from "@/modules/auth"
import { MainLayout } from "@/shared/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    getAugmentationJob, getAugmentationJobOutput,
} from "@/modules/augmentation/api/augmentation-api"
import type { AugmentationJob } from "@/modules/augmentation/types"
import { isTerminalJobStatus } from "@/modules/augmentation/types"

function JobDetail({ jobId }: { jobId: string }) {
    const { idToken } = useAuth()
    const [job, setJob] = useState<AugmentationJob | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const refresh = useCallback(async () => {
        if (!idToken) return
        setBusy(true)
        try { setJob(await getAugmentationJob(jobId, idToken)); setErr(null) }
        catch (e) { setErr((e as Error).message) }
        finally { setBusy(false) }
    }, [idToken, jobId])

    useEffect(() => { void refresh() }, [refresh])
    useEffect(() => {
        if (!job || isTerminalJobStatus(job.status)) return
        const t = setInterval(refresh, 1000)
        return () => clearInterval(t)
    }, [job, refresh])

    const download = async () => {
        if (!idToken || !job) return
        try {
            const out = await getAugmentationJobOutput(job.job_id, idToken)
            window.open(out.presigned_url, "_blank", "noopener,noreferrer")
        } catch (e) { setErr((e as Error).message) }
    }

    return (
        <div className="space-y-4 p-6" data-testid="aug-job-detail">
            <div className="flex items-center gap-2">
                <Link href="/augmentation" className="text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="inline h-4 w-4 mr-1" />Back
                </Link>
                <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${busy ? "animate-spin" : ""}`} />Refresh
                </Button>
            </div>
            <h1 className="text-xl font-semibold font-mono">{jobId}</h1>
            {err && <p className="text-red-500 text-sm" role="alert">{err}</p>}
            {!job ? <p className="text-muted-foreground">Loading…</p> : (
                <div className="space-y-2 text-sm">
                    <p>
                        <Badge variant="outline" className="uppercase">{job.status}</Badge>
                        {job.sox_audit_enabled && (
                            <Badge variant="outline" className="ml-2 gap-1">
                                <ShieldCheck className="h-3 w-3" />SOX lineage
                            </Badge>
                        )}
                    </p>
                    <p><span className="text-muted-foreground">Template: </span>{job.template_id ?? "—"}</p>
                    <p><span className="text-muted-foreground">Input: </span>{job.input_dataset_key ?? "—"}</p>
                    <p><span className="text-muted-foreground">Output: </span>{job.output_dataset_key ?? "—"}</p>
                    <p><span className="text-muted-foreground">Rows: </span>{job.output_rows_count ?? "—"}</p>
                    <p><span className="text-muted-foreground">Cost: </span>
                        {job.cost_actual_usd != null ? `$${job.cost_actual_usd}` : "—"}</p>
                    <p><span className="text-muted-foreground">Created: </span>{job.created_at}</p>
                    {job.error_message && <p className="text-red-500">{job.error_message}</p>}
                    {job.status === "SUCCEEDED" && (
                        <Button size="sm" onClick={download}>
                            <Download className="h-4 w-4 mr-1" />Download output
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

export default function Page({ params }: { params: Promise<{ jobId: string }> }) {
    const { jobId } = use(params)
    return (
        <AuthGuard><MainLayout><JobDetail jobId={jobId} /></MainLayout></AuthGuard>
    )
}
