/**
 * Tests for the ApiError migration in JobsAPI (commit
 * "fix(fe/jobs): distinguish 401 / 403 / 409 / 5xx in pause-resume + trigger
 * + delete toasts").
 *
 * Previously JobsAPI threw a flat `Error` with just the server message, so
 * callers couldn't distinguish 401 (session expired → re-login) from 403
 * (insufficient role → no point re-logging in). After the migration the
 * error is an `ApiError` carrying `status` + `code` + `action` fields.
 */
import "@testing-library/jest-dom"

jest.mock("@/shared/config/aws-config", () => ({
    AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}))

import { isApiError } from "@/modules/shared/api-error"

function mockFetch(status: number, body: unknown) {
    return jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
    })
}

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

describe("JobsAPI throws ApiError preserving status", () => {
    it("401 → ApiError with status=401 so caller can branch on session-expired", async () => {
        global.fetch = mockFetch(401, { error: "Token expired" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        const promise = jobsAPI.listJobs()
        await expect(promise).rejects.toThrow("Token expired")
        try {
            await jobsAPI.listJobs()
        } catch (e) {
            expect(isApiError(e)).toBe(true)
            // @ts-expect-error narrowed via runtime check above
            expect(e.status).toBe(401)
            // 401 without explicit code/action → infers action="signin"
            // @ts-expect-error narrowed via runtime check above
            expect(e.action).toBe("signin")
        }
    })

    it("403 → ApiError with status=403, distinct from 401", async () => {
        global.fetch = mockFetch(403, { error: "Insufficient role" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        try {
            await jobsAPI.deleteJob("jid")
            fail("expected to throw")
        } catch (e) {
            expect(isApiError(e)).toBe(true)
            // @ts-expect-error narrowed via runtime check above
            expect(e.status).toBe(403)
            // 403 is NOT a signin signal — caller should show "permission denied", not redirect.
            // @ts-expect-error narrowed via runtime check above
            expect(e.action).not.toBe("signin")
        }
    })

    it("409 (conflict) preserves status so caller can show conflict copy", async () => {
        global.fetch = mockFetch(409, { error: "Job already paused" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        try {
            await jobsAPI.pauseJob("jid")
            fail("expected to throw")
        } catch (e) {
            expect(isApiError(e)).toBe(true)
            // @ts-expect-error narrowed via runtime check above
            expect(e.status).toBe(409)
        }
    })

    it("500 → ApiError with status>=500 so caller can show 'server error' copy", async () => {
        global.fetch = mockFetch(500, { error: "Internal error" })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        try {
            await jobsAPI.triggerJob("jid")
            fail("expected to throw")
        } catch (e) {
            expect(isApiError(e)).toBe(true)
            // @ts-expect-error narrowed via runtime check above
            expect(e.status).toBe(500)
        }
    })

    it("preserves BE-supplied `fields` map for inline validation rendering", async () => {
        global.fetch = mockFetch(400, {
            error: "Validation failed",
            fields: { name: "Name must be unique", entities: "At least one required" },
        })
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        try {
            await jobsAPI.createJob({} as any)
            fail("expected to throw")
        } catch (e) {
            expect(isApiError(e)).toBe(true)
            // @ts-expect-error narrowed via runtime check above
            expect(e.fields).toEqual({
                name: "Name must be unique",
                entities: "At least one required",
            })
        }
    })

    it("handles non-JSON error bodies without crashing", async () => {
        // Fetch returns ok=false with no JSON body (e.g. proxy 502)
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: jest.fn().mockRejectedValue(new Error("Unexpected token")),
        }) as any
        const { jobsAPI } = await import("@/modules/jobs/api/jobs-api")
        try {
            await jobsAPI.listJobs()
            fail("expected to throw")
        } catch (e) {
            expect(isApiError(e)).toBe(true)
            // @ts-expect-error narrowed via runtime check above
            expect(e.status).toBe(502)
            // @ts-expect-error narrowed via runtime check above
            expect(e.message).toBe("HTTP 502")
        }
    })
})
