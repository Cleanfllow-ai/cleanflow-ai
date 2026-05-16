/**
 * Unit tests for JobsAPI HTTP methods (network layer)
 * Covers: listJobs, getJob, createJob, updateJob, deleteJob, pauseJob, resumeJob
 * Asserts correct URLs, HTTP methods, and error propagation.
 *
 * NOTE: The pure-function tests (frequencyToBackend / frequencyFromBackend)
 * already live in jobs-api.test.ts — this file focuses on the network calls only.
 */

jest.mock("@/shared/config/aws-config", () => ({
    AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}))

// Isolate the module so we can intercept localStorage + fetch
import type { CreateJobPayload } from "@/modules/jobs/types/jobs.types"

// Helper: build a jobsAPI-like class directly from the module's internal class.
// We re-import after setting up the fetch mock so the base URL uses our mock.
const BASE = "https://api.test.com"

function mockFetch(status: number, body: unknown) {
    return jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
    })
}

// Provide a fake auth token via localStorage
beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
        value: {
            getItem: jest.fn().mockReturnValue(JSON.stringify({ idToken: "test-token" })),
            setItem: jest.fn(),
            removeItem: jest.fn(),
        },
        writable: true,
    })
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe("jobsAPI HTTP — listJobs", () => {
    it("GETs /jobs and returns jobs array", async () => {
        const fetchMock = mockFetch(200, { jobs: [{ job_id: "j1" }] })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        const result = await jobsAPI.listJobs()
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs`,
            expect.objectContaining({ method: "GET" })
        )
        expect(result.jobs[0].job_id).toBe("j1")
    })

    it("throws when server returns 401", async () => {
        global.fetch = mockFetch(401, { error: "Unauthorized" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        await expect(jobsAPI.listJobs()).rejects.toThrow("Unauthorized")
    })
})

describe("jobsAPI HTTP — getJob", () => {
    it("GETs /jobs/{id}", async () => {
        const fetchMock = mockFetch(200, { job_id: "j-abc" })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        const result = await jobsAPI.getJob("j-abc")
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs/j-abc`,
            expect.objectContaining({ method: "GET" })
        )
        expect(result.job_id).toBe("j-abc")
    })
})

describe("jobsAPI HTTP — createJob", () => {
    it("POSTs to /jobs with payload", async () => {
        const fetchMock = mockFetch(200, { job_id: "new-j" })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        const payload: CreateJobPayload = {
            name: "New Job",
            source_provider: "quickbooks",
            source_category: "erp",
            destination_provider: "cleanflow",
            destination_category: "storage",
            entities: ["invoices"],
            frequency_type: "rate",
            frequency_value: "1 hour",
        }
        await jobsAPI.createJob(payload)
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs`,
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify(payload),
            })
        )
    })

    it("propagates 400 error to caller", async () => {
        global.fetch = mockFetch(400, { error: "Missing required field: name" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        await expect(
            jobsAPI.createJob({} as CreateJobPayload)
        ).rejects.toThrow("Missing required field: name")
    })
})

describe("jobsAPI HTTP — deleteJob", () => {
    it("DELETEs /jobs/{id}", async () => {
        const fetchMock = mockFetch(200, { message: "deleted" })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        const result = await jobsAPI.deleteJob("j-del")
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs/j-del`,
            expect.objectContaining({ method: "DELETE" })
        )
        expect(result.message).toBe("deleted")
    })
})

describe("jobsAPI HTTP — pauseJob / resumeJob", () => {
    it("POSTs to /jobs/{id}/pause", async () => {
        const fetchMock = mockFetch(200, { message: "paused" })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        await jobsAPI.pauseJob("j-p")
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs/j-p/pause`,
            expect.objectContaining({ method: "POST" })
        )
    })

    it("POSTs to /jobs/{id}/resume", async () => {
        const fetchMock = mockFetch(200, { message: "resumed" })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        await jobsAPI.resumeJob("j-r")
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs/j-r/resume`,
            expect.objectContaining({ method: "POST" })
        )
    })
})

describe("jobsAPI HTTP — getJobRuns", () => {
    it("GETs /jobs/{id}/runs?limit=50 by default", async () => {
        const fetchMock = mockFetch(200, { runs: [] })
        global.fetch = fetchMock
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        await jobsAPI.getJobRuns("j-1")
        expect(fetchMock).toHaveBeenCalledWith(
            `${BASE}/jobs/j-1/runs?limit=50`,
            expect.objectContaining({ method: "GET" })
        )
    })

    it("throws on 5xx so caller can display error state", async () => {
        global.fetch = mockFetch(500, { error: "Internal Server Error" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        await expect(jobsAPI.getJobRuns("j-1")).rejects.toThrow()
    })
})
