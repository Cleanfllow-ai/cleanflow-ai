"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/modules/auth"
import { listPromptTemplates } from "@/modules/augmentation/api/augmentation-api"
import { useAugmentationJob } from "@/modules/augmentation/hooks/use-augmentation-job"
import type { AugmentationJob, PromptTemplate, SubmitJobBody } from "@/modules/augmentation/types"

interface Props { onSuccess?: (job: AugmentationJob) => void; onCancel?: () => void }

export function NewJobForm({ onSuccess, onCancel }: Props) {
    const { idToken } = useAuth()
    const { state, submitAndWatch, cancel } = useAugmentationJob()
    const [templates, setTemplates] = useState<PromptTemplate[]>([])
    const [templateId, setTemplateId] = useState("")
    const [inputKey, setInputKey] = useState("")
    const [outputKey, setOutputKey] = useState("")
    const [soxAudit, setSoxAudit] = useState(true)
    const [dryRun, setDryRun] = useState(false)
    const [loadingTpl, setLoadingTpl] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    useEffect(() => {
        if (!idToken) return
        setLoadingTpl(true)
        listPromptTemplates(idToken, { active: true })
            .then(setTemplates)
            .catch((err) => { console.error("Failed to load templates:", err); setFormError("Could not load templates. Please refresh and try again.") })
            .finally(() => setLoadingTpl(false))
    }, [idToken])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!templateId) return setFormError("Select a prompt template")
        if (!inputKey.trim()) return setFormError("Input dataset key is required")
        if (!outputKey.trim()) return setFormError("Output dataset key is required")
        setFormError(null)
        const body: SubmitJobBody = {
            prompt_template_id: templateId,
            input_dataset_key: inputKey.trim(), output_dataset_key: outputKey.trim(),
            sox_audit_enabled: soxAudit, dry_run: dryRun,
        }
        try { onSuccess?.(await submitAndWatch(body)) } catch { /* state captured */ }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4" data-testid="new-job-form">
            <div className="space-y-2">
                <Label htmlFor="aug-template">Prompt template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger id="aug-template" disabled={loadingTpl}>
                        <SelectValue placeholder={loadingTpl ? "Loading…" : "Select template"} />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map((t) => (
                            <SelectItem key={`${t.template_id}-v${t.version}`} value={t.template_id}>
                                {t.template_id} (v{t.version}) · {t.cardinality}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="aug-input">Input dataset S3 key</Label>
                <Input id="aug-input" value={inputKey} onChange={(e) => setInputKey(e.target.value)}
                    placeholder="data/{org_id}/{upload_id}/result.parquet" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="aug-output">Output dataset S3 key</Label>
                <Input id="aug-output" value={outputKey} onChange={(e) => setOutputKey(e.target.value)}
                    placeholder="data/{org_id}/augmentation/{job_id}/output.parquet" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                    <Label htmlFor="aug-sox" className="font-medium">SOX audit lineage</Label>
                    <p className="text-xs text-muted-foreground">Persist immutable input → output lineage rows.</p>
                </div>
                <Switch id="aug-sox" checked={soxAudit} onCheckedChange={setSoxAudit} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                    <Label htmlFor="aug-dry" className="font-medium">Dry run</Label>
                    <p className="text-xs text-muted-foreground">Validate inputs without writing output.</p>
                </div>
                <Switch id="aug-dry" checked={dryRun} onCheckedChange={setDryRun} />
            </div>
            {(formError || state.error) && (
                <p className="text-sm text-red-500" role="alert">{formError || state.error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
                {state.isPolling
                    ? <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
                    : onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
                <Button type="submit" disabled={state.isPolling || loadingTpl}>
                    {state.isPolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {state.isPolling ? `Status: ${state.status}` : "Submit job"}
                </Button>
            </div>
        </form>
    )
}
