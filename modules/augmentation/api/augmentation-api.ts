/**
 * augmentation-api.ts — typed client for the 6 backend routes shipping the
 * RightRev data augmentation feature. Mirrors file-quarantine-api: stateless
 * functions that take the auth token + payload, return parsed JSON.
 */
import { makeRequest } from "@/modules/files/api/file-upload-api"
import type {
    AugmentationJob, JobOutputResponse, PromptTemplate, RegisterTemplateBody,
    SubmitJobBody, SubmitJobResponse,
} from "@/modules/augmentation/types"
import { isTerminalJobStatus } from "@/modules/augmentation/types"

const E = {
    JOBS: "/augmentation/jobs",
    JOB: (id: string) => `/augmentation/jobs/${id}`,
    JOB_OUTPUT: (id: string) => `/augmentation/jobs/${id}/output`,
    TEMPLATES: "/augmentation/prompt-templates",
    TEMPLATE_VERSION: (tid: string, v: number | string) =>
        `/augmentation/prompt-templates/${tid}/versions/${v}`,
}

export const submitAugmentationJob = (authToken: string, body: SubmitJobBody): Promise<SubmitJobResponse> =>
    makeRequest(E.JOBS, authToken, { method: "POST", body: JSON.stringify(body) })

export const getAugmentationJob = (jobId: string, authToken: string): Promise<AugmentationJob> =>
    makeRequest(E.JOB(jobId), authToken, { method: "GET" })

export const getAugmentationJobOutput = (jobId: string, authToken: string): Promise<JobOutputResponse> =>
    makeRequest(E.JOB_OUTPUT(jobId), authToken, { method: "GET" })

export async function listAugmentationJobs(authToken: string, limit = 50): Promise<AugmentationJob[]> {
    const qs = new URLSearchParams({ limit: String(limit) }).toString()
    const resp = await makeRequest(`${E.JOBS}?${qs}`, authToken, { method: "GET" })
    if (Array.isArray(resp)) return resp
    if (Array.isArray(resp?.jobs)) return resp.jobs
    return []
}

export const registerPromptTemplate = (authToken: string, body: RegisterTemplateBody): Promise<PromptTemplate> =>
    makeRequest(E.TEMPLATES, authToken, { method: "POST", body: JSON.stringify(body) })

export async function listPromptTemplates(
    authToken: string, opts: { template_id?: string; active?: boolean } = {},
): Promise<PromptTemplate[]> {
    const params = new URLSearchParams()
    if (opts.template_id) params.set("template_id", opts.template_id)
    if (opts.active !== undefined) params.set("active", String(opts.active))
    const qs = params.toString()
    const ep = qs ? `${E.TEMPLATES}?${qs}` : E.TEMPLATES
    const resp = await makeRequest(ep, authToken, { method: "GET" })
    if (Array.isArray(resp)) return resp
    if (Array.isArray(resp?.templates)) return resp.templates
    return []
}

export async function deletePromptTemplateVersion(
    templateId: string, version: number | string, authToken: string,
): Promise<void> {
    await makeRequest(E.TEMPLATE_VERSION(templateId, version), authToken, { method: "DELETE" })
}

export interface SubmitJobAndPollOptions {
    body: SubmitJobBody
    authToken: string
    signal?: AbortSignal
    pollIntervalMs?: number
    onUpdate?: (job: AugmentationJob) => void
}

/** Submit a job, poll status every `pollIntervalMs` (default 1000) until
 *  terminal (SUCCEEDED/FAILED) or until aborted via AbortSignal. */
export async function submitJobAndPoll(opts: SubmitJobAndPollOptions): Promise<AugmentationJob> {
    const { body, authToken, signal, pollIntervalMs = 1000, onUpdate } = opts
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const submitted = await submitAugmentationJob(authToken, body)
    const jobId = submitted.job_id
    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
        const job = await getAugmentationJob(jobId, authToken)
        onUpdate?.(job)
        if (isTerminalJobStatus(job.status)) return job
        await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, pollIntervalMs)
            signal?.addEventListener("abort", () => {
                clearTimeout(t); reject(new DOMException("Aborted", "AbortError"))
            }, { once: true })
        })
    }
}
