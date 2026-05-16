/**
 * Filter 5 — Augmentation status filter
 * Asserts: default "all", filtering narrows rows, clearing restores all.
 * Note: AUGMENTATION_ENABLED = false so tab is hidden in production but filter ships.
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
  AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}))
jest.mock("@/modules/files/api/file-upload-api", () => ({
  makeRequest: jest.fn(),
}))
jest.mock("@/modules/auth", () => ({
  useAuth: () => ({ idToken: "tok-123" }),
}))

import { fireEvent, render as _r } from "@testing-library/react"
import { AugmentationPage } from "@/modules/augmentation/components/augmentation-page"
import { makeRequest } from "@/modules/files/api/file-upload-api"

const mockMakeRequest = makeRequest as jest.Mock

const JOBS = [
  { job_id: "job-running", status: "RUNNING", template_id: "t1", created_at: "2026-05-13T10:00:00Z" },
  { job_id: "job-succeeded", status: "SUCCEEDED", template_id: "t2", output_rows_count: 50, cost_actual_usd: 0.01, created_at: "2026-05-12T10:00:00Z" },
  { job_id: "job-failed", status: "FAILED", template_id: "t3", created_at: "2026-05-11T10:00:00Z" },
]

afterEach(() => mockMakeRequest.mockReset())

describe("AugmentationPage — status filter (Filter 5)", () => {
  it("defaults to 'all' and shows all jobs", async () => {
    mockMakeRequest.mockResolvedValue(JOBS)
    render(<AugmentationPage />)
    await waitFor(() => expect(screen.getByTestId("aug-row-job-running")).toBeInTheDocument())
    expect(screen.getByTestId("aug-row-job-succeeded")).toBeInTheDocument()
    expect(screen.getByTestId("aug-row-job-failed")).toBeInTheDocument()
  })

  it("filtering to RUNNING hides other rows", async () => {
    const user = userEvent.setup()
    mockMakeRequest.mockResolvedValue(JOBS)
    render(<AugmentationPage />)
    await waitFor(() => expect(screen.getByTestId("aug-row-job-running")).toBeInTheDocument())
    await user.click(screen.getByTestId("aug-status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Running" }))
    expect(screen.getByTestId("aug-row-job-running")).toBeInTheDocument()
    expect(screen.queryByTestId("aug-row-job-succeeded")).not.toBeInTheDocument()
    expect(screen.queryByTestId("aug-row-job-failed")).not.toBeInTheDocument()
  })

  it("filtering to SUCCEEDED hides others", async () => {
    const user = userEvent.setup()
    mockMakeRequest.mockResolvedValue(JOBS)
    render(<AugmentationPage />)
    await waitFor(() => expect(screen.getByTestId("aug-row-job-succeeded")).toBeInTheDocument())
    await user.click(screen.getByTestId("aug-status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Completed" }))
    expect(screen.getByTestId("aug-row-job-succeeded")).toBeInTheDocument()
    expect(screen.queryByTestId("aug-row-job-running")).not.toBeInTheDocument()
    expect(screen.queryByTestId("aug-row-job-failed")).not.toBeInTheDocument()
  })

  it("resetting to 'All statuses' restores all rows", async () => {
    const user = userEvent.setup()
    mockMakeRequest.mockResolvedValue(JOBS)
    render(<AugmentationPage />)
    await waitFor(() => expect(screen.getByTestId("aug-row-job-running")).toBeInTheDocument())
    await user.click(screen.getByTestId("aug-status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "Failed" }))
    expect(screen.queryByTestId("aug-row-job-running")).not.toBeInTheDocument()
    // Reset
    await user.click(screen.getByTestId("aug-status-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "All statuses" }))
    expect(screen.getByTestId("aug-row-job-running")).toBeInTheDocument()
    expect(screen.getByTestId("aug-row-job-succeeded")).toBeInTheDocument()
    expect(screen.getByTestId("aug-row-job-failed")).toBeInTheDocument()
  })
})
