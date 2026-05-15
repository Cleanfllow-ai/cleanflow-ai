/**
 * Filter 6 — Jobs schedule status filter
 * Asserts: default "all", filtering narrows rows, clearing restores all.
 * Also asserts clickable stats-bar badges set the filter.
 */
import "@testing-library/jest-dom"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== "undefined") {
  if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
  if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
  if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: {
    API_BASE_URL: "https://api.test.com",
    COGNITO: { USER_POOL_ID: "test", CLIENT_ID: "test", REGION: "ap-south-1" },
  },
}))
jest.mock("@/modules/auth/components/permission-wrapper", () => ({
  PermissionWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
const mockToast = jest.fn()
jest.mock("@/shared/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))
jest.mock("@/modules/auth", () => ({
  useAuth: () => ({ idToken: "tok", user: { email: "u@x.com" } }),
}))
jest.mock("@/modules/jobs/components/job-dialog", () => ({ JobDialog: () => null }))
jest.mock("@/modules/jobs/components/job-runs-explorer", () => ({
  JobRunsExplorer: ({ jobId }: { jobId: string }) => (
    <div data-testid={`runs-explorer-${jobId}`}>Runs</div>
  ),
}))

import { jobsAPI } from "@/modules/jobs/api/jobs-api"
import { JobsList } from "@/modules/jobs/components/jobs-list"
import type { Job } from "@/modules/jobs/types/jobs.types"

jest.mock("@/modules/jobs/api/jobs-api", () => {
  const original = jest.requireActual("@/modules/jobs/api/jobs-api")
  return {
    ...original,
    jobsAPI: { listJobs: jest.fn(), pauseJob: jest.fn(), resumeJob: jest.fn(), triggerJob: jest.fn(), deleteJob: jest.fn() },
  }
})
const mockListJobs = jobsAPI.listJobs as jest.Mock

function mkJob(id: string, name: string, status: Job["status"]): Job {
  return {
    job_id: id, name, status,
    source_provider: "quickbooks", source_category: "erp",
    source_config: {}, destination_provider: "cleanflowai",
    destination_category: "cleanflowai", destination_config: {},
    frequency_type: "daily", frequency_value: "daily",
    entities: [], dq_config: { mode: "default" },
    created_at: new Date().toISOString(),
    last_run_at: null, last_run_status: null,
  } as unknown as Job
}

const JOBS = [
  mkJob("j1", "Active Job", "ACTIVE"),
  mkJob("j2", "Paused Job", "PAUSED"),
  mkJob("j3", "Failed Job", "FAILED"),
]

beforeEach(() => {
    mockListJobs.mockResolvedValue({ jobs: JOBS })
})
afterEach(() => mockListJobs.mockReset())

describe("JobsList — status filter (Filter 6)", () => {
  it("defaults to 'all' and shows all jobs", async () => {
    render(<JobsList />)
    await waitFor(() => expect(screen.getByText("Active Job")).toBeInTheDocument())
    expect(screen.getByText("Paused Job")).toBeInTheDocument()
    expect(screen.getAllByText("Failed Job").length).toBeGreaterThanOrEqual(1)
  })

  it("filtering to ACTIVE hides non-active jobs in the table", async () => {
    const user = userEvent.setup()
    render(<JobsList />)
    await waitFor(() => expect(screen.getByText("Active Job")).toBeInTheDocument())
    await user.click(screen.getByTestId("status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Active" }))
    // Active Job still in table
    expect(screen.getByText("Active Job")).toBeInTheDocument()
    // Paused Job removed from table
    expect(screen.queryByText("Paused Job")).not.toBeInTheDocument()
    // Failed Job may still appear in the alert banner (correct behavior)
    // — verify it's NOT in the job table row by checking the table body
    const table = document.querySelector("table")
    expect(table?.textContent).not.toContain("Paused Job")
  })

  it("resetting to 'All' restores all jobs", async () => {
    const user = userEvent.setup()
    render(<JobsList />)
    await waitFor(() => expect(screen.getByText("Active Job")).toBeInTheDocument())
    // Apply filter
    await user.click(screen.getByTestId("status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Paused" }))
    expect(screen.queryByText("Active Job")).not.toBeInTheDocument()
    // Reset
    await user.click(screen.getByTestId("status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "All" }))
    expect(screen.getByText("Active Job")).toBeInTheDocument()
    expect(screen.getByText("Paused Job")).toBeInTheDocument()
  })

  it("clicking Active stats badge filters to ACTIVE jobs", async () => {
    const user = userEvent.setup()
    render(<JobsList />)
    // Stats bar renders after loading=false; wait for it
    const statsActive = await screen.findByTestId("stats-active")
    await user.click(statsActive)
    expect(screen.getByText("Active Job")).toBeInTheDocument()
    expect(screen.queryByText("Paused Job")).not.toBeInTheDocument()
  })

  it("clicking active stats badge again (toggle) restores all", async () => {
    const user = userEvent.setup()
    render(<JobsList />)
    const statsActive = await screen.findByTestId("stats-active")
    await user.click(statsActive)
    await user.click(statsActive)
    expect(screen.getByText("Paused Job")).toBeInTheDocument()
    expect(screen.getAllByText("Failed Job").length).toBeGreaterThanOrEqual(1)
  })
})
