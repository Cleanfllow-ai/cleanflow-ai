/**
 * Jobs error-handling unit tests.
 *
 * Tests the 5 structured failure modes for the JobRuns dashboard:
 *   1. JOB_CRON_INVALID            — banner shows "Edit Schedule" action
 *   2. JOB_PREVIOUS_STILL_RUNNING  — banner shows info copy, no action button
 *   3. JOB_DOWNSTREAM_UNAVAILABLE  — banner shows "View Logs" action
 *   4. JOB_RETRIES_EXHAUSTED       — banner shows "Re-run Now" action
 *   5. JOB_QUOTA_EXCEEDED          — banner shows "Manage Schedules" action
 *
 * Also tests that JobRun type accepts error_code / error_message fields.
 */

import "@testing-library/jest-dom"
import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { JobErrorBanner } from "@/modules/jobs/components/job-error-banner"
import type { JobRun, JobErrorCode } from "@/modules/jobs/types/jobs.types"

// ─── Type-level test: JobRun accepts error_code ───────────────────────────────

describe("JobRun type", () => {
    it("accepts error_code and error_message fields", () => {
        const run: JobRun = {
            run_id: "r1",
            status: "FAILED",
            started_at: "2026-05-14T10:00:00Z",
            duration_ms: 1234,
            total_imported: 100,
            total_exported: 0,
            total_quarantined: 0,
            entity_results: {},
            pipeline_logs: [],
            error_code: "JOB_RETRIES_EXHAUSTED",
            error_message: "Job failed after 3 retries.",
        }
        expect(run.error_code).toBe("JOB_RETRIES_EXHAUSTED")
        expect(run.error_message).toBe("Job failed after 3 retries.")
    })

    it("does not require error_code (backwards compat)", () => {
        const run: JobRun = {
            run_id: "r2",
            status: "SUCCESS",
            started_at: "2026-05-14T10:00:00Z",
            duration_ms: 500,
            total_imported: 50,
            total_exported: 50,
            total_quarantined: 0,
            entity_results: {},
            pipeline_logs: [],
        }
        expect(run.error_code).toBeUndefined()
    })
})

// ─── JobErrorBanner rendering ─────────────────────────────────────────────────

describe("JobErrorBanner", () => {
    it("renders cron-invalid copy with Edit Schedule button", () => {
        const onAction = jest.fn()
        render(
            <JobErrorBanner
                errorCode="JOB_CRON_INVALID"
                onAction={onAction}
            />
        )
        expect(screen.getByText(/malformed/i)).toBeInTheDocument()
        expect(screen.getByText(/cron\(0 9 \* \* \? \*\)/)).toBeInTheDocument()
        const btn = screen.getByRole("button", { name: /edit schedule/i })
        expect(btn).toBeInTheDocument()
    })

    it("calls onAction('edit') when Edit Schedule clicked", async () => {
        const onAction = jest.fn()
        render(<JobErrorBanner errorCode="JOB_CRON_INVALID" onAction={onAction} />)
        await userEvent.click(screen.getByRole("button", { name: /edit schedule/i }))
        expect(onAction).toHaveBeenCalledWith("edit")
    })

    it("renders previous-still-running copy without action button", () => {
        render(<JobErrorBanner errorCode="JOB_PREVIOUS_STILL_RUNNING" />)
        expect(screen.getByText(/didn't finish/i)).toBeInTheDocument()
        expect(screen.queryByRole("button")).toBeNull()
    })

    it("renders downstream-unavailable with connector name and View Logs", () => {
        const onAction = jest.fn()
        render(
            <JobErrorBanner
                errorCode="JOB_DOWNSTREAM_UNAVAILABLE"
                connector="QuickBooks"
                onAction={onAction}
            />
        )
        expect(screen.getByText(/QuickBooks/)).toBeInTheDocument()
        expect(screen.getByText(/Auto-retrying/i)).toBeInTheDocument()
        const btn = screen.getByRole("button", { name: /view logs/i })
        expect(btn).toBeInTheDocument()
    })

    it("calls onAction('view_logs') when View Logs clicked", async () => {
        const onAction = jest.fn()
        render(
            <JobErrorBanner errorCode="JOB_DOWNSTREAM_UNAVAILABLE" connector="Snowflake" onAction={onAction} />
        )
        await userEvent.click(screen.getByRole("button", { name: /view logs/i }))
        expect(onAction).toHaveBeenCalledWith("view_logs")
    })

    it("renders retries-exhausted with Re-run Now button", () => {
        const onAction = jest.fn()
        render(
            <JobErrorBanner errorCode="JOB_RETRIES_EXHAUSTED" connector="zoho" onAction={onAction} />
        )
        expect(screen.getByText(/3 retries/i)).toBeInTheDocument()
        expect(screen.getByText(/zoho/i)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /re-run now/i })).toBeInTheDocument()
    })

    it("calls onAction('rerun') when Re-run Now clicked", async () => {
        const onAction = jest.fn()
        render(<JobErrorBanner errorCode="JOB_RETRIES_EXHAUSTED" connector="zoho" onAction={onAction} />)
        await userEvent.click(screen.getByRole("button", { name: /re-run now/i }))
        expect(onAction).toHaveBeenCalledWith("rerun")
    })

    it("renders quota-exceeded with active count and Manage Schedules", () => {
        const onAction = jest.fn()
        render(
            <JobErrorBanner errorCode="JOB_QUOTA_EXCEEDED" activeCount={10} onAction={onAction} />
        )
        expect(screen.getByText(/10 active schedules/i)).toBeInTheDocument()
        expect(screen.getByText(/Pause or upgrade/i)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /manage schedules/i })).toBeInTheDocument()
    })

    it("renders quota-exceeded without count when activeCount is -1", () => {
        render(<JobErrorBanner errorCode="JOB_QUOTA_EXCEEDED" activeCount={-1} />)
        expect(screen.getByText(/Pause or upgrade/i)).toBeInTheDocument()
        // Should NOT mention a specific number
        expect(screen.queryByText(/-1 active/i)).toBeNull()
    })

    it("calls onAction('manage') when Manage Schedules clicked", async () => {
        const onAction = jest.fn()
        render(<JobErrorBanner errorCode="JOB_QUOTA_EXCEEDED" activeCount={5} onAction={onAction} />)
        await userEvent.click(screen.getByRole("button", { name: /manage schedules/i }))
        expect(onAction).toHaveBeenCalledWith("manage")
    })

    it("renders compact pill variant without action button", () => {
        const { container } = render(
            <JobErrorBanner errorCode="JOB_RETRIES_EXHAUSTED" connector="qb" compact />
        )
        // Compact mode renders a span, not a full banner div with button
        expect(screen.queryByRole("button")).toBeNull()
        // Should still render a readable token
        expect(container.textContent).toMatch(/RETRIES EXHAUSTED/)
    })

    it("renders generic fallback for unknown error codes", () => {
        render(
            <JobErrorBanner
                errorCode="SOME_UNKNOWN_CODE"
                errorMessage="Something broke internally"
            />
        )
        expect(screen.getByText(/Something broke internally/i)).toBeInTheDocument()
    })
})
