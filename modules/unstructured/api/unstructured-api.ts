/**
 * Unstructured Import API client.
 *
 * Endpoints (all JWT-required, contract defined by BE agent C):
 *   POST   /unstructured/jobs
 *   GET    /unstructured/jobs                       (list — pagination)
 *   GET    /unstructured/jobs/{job_id}
 *   GET    /unstructured/jobs/{job_id}/files        (paginated)
 *   GET    /unstructured/jobs/{job_id}/log          (SSE — handled by useUnstructuredSSE)
 *   GET    /unstructured/jobs/{job_id}/result       (presigned S3 URL)
 *
 * Auth: ConnectorAPIBase handles `Authorization: Bearer <idToken>` + transparent
 * 401 refresh, identical to the rest of the codebase.
 */

import { ConnectorAPIBase } from "@/modules/connectors/api/base"
import { AWS_CONFIG } from "@/shared/config/aws-config"
import type {
  UnstructuredFileListResponse,
  UnstructuredJob,
  UnstructuredJobCreateResponse,
  UnstructuredJobListResponse,
  UnstructuredJobResultResponse,
  UnstructuredJobSpec,
} from "../types/unstructured.types"

class UnstructuredAPI extends ConnectorAPIBase {
  /** Create a new unstructured-import job. Returns job_id + initial status. */
  async createJob(
    spec: UnstructuredJobSpec,
  ): Promise<UnstructuredJobCreateResponse> {
    return this.makeRequest<UnstructuredJobCreateResponse>(
      "/unstructured/jobs",
      {
        method: "POST",
        body: JSON.stringify(spec),
      },
    )
  }

  /** Fetch one job by id. */
  async getJob(jobId: string): Promise<UnstructuredJob> {
    return this.makeRequest<UnstructuredJob>(
      `/unstructured/jobs/${encodeURIComponent(jobId)}`,
      { method: "GET" },
    )
  }

  /** List recent jobs for the org (most recent first). */
  async listJobs(
    pageToken?: string,
    limit: number = 50,
  ): Promise<UnstructuredJobListResponse> {
    const params = new URLSearchParams()
    params.set("limit", String(limit))
    if (pageToken) params.set("page_token", pageToken)
    return this.makeRequest<UnstructuredJobListResponse>(
      `/unstructured/jobs?${params.toString()}`,
      { method: "GET" },
    )
  }

  /** Per-file records for a job (paginated). */
  async listFiles(
    jobId: string,
    pageToken?: string,
    limit: number = 100,
  ): Promise<UnstructuredFileListResponse> {
    const params = new URLSearchParams()
    params.set("limit", String(limit))
    if (pageToken) params.set("page_token", pageToken)
    return this.makeRequest<UnstructuredFileListResponse>(
      `/unstructured/jobs/${encodeURIComponent(jobId)}/files?${params.toString()}`,
      { method: "GET" },
    )
  }

  /** Presigned S3 URL for the augmented result file. */
  async getResult(jobId: string): Promise<UnstructuredJobResultResponse> {
    return this.makeRequest<UnstructuredJobResultResponse>(
      `/unstructured/jobs/${encodeURIComponent(jobId)}/result`,
      { method: "GET" },
    )
  }

  /**
   * Build the absolute URL for the SSE log stream.
   *
   * EventSource cannot set `Authorization` headers, so the SSE handler on BE
   * accepts the token via the `access_token` query param (same pattern used
   * by the WebSocket collab API). The token getter is centralized in
   * ConnectorAPIBase.getAuthToken().
   */
  buildLogStreamUrl(jobId: string): string {
    const base = AWS_CONFIG.API_BASE_URL || ""
    const token = this.getAuthToken() || ""
    const params = new URLSearchParams()
    if (token) params.set("access_token", token)
    return `${base}/unstructured/jobs/${encodeURIComponent(jobId)}/log${
      token ? `?${params.toString()}` : ""
    }`
  }
}

export const unstructuredApi = new UnstructuredAPI()
export default unstructuredApi
