/**
 * Filter 3 — Wizard Step 2 Profiling type filter
 * Asserts: default "all", filtering narrows rows, clearing restores all.
 */
import "@testing-library/jest-dom"
import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== "undefined") {
  if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
  if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
  if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

jest.mock("@/shared/lib/rule-metadata", () => ({
  getRuleMeta: () => ({ name: "Test Rule", description: "desc", severity: "info" }),
}))

import { ColumnProfilingPanel } from "@/modules/files/components/column-profiling-panel"
import type { ProfilingResponse } from "@/modules/files/api/file-management-api"

const makeProfile = (type: string, rules: unknown[] = []) => ({
  type_guess: type,
  rules,
  null_rate: 0,
  unique_ratio: 1,
  profile_time_sec: 0.1,
  llm_time_sec: 0.05,
})

const data: ProfilingResponse = {
  summary: { total_columns: 3, total_rules: 0 },
  profiles: {
    email_col: makeProfile("email"),
    amount_col: makeProfile("numeric"),
    name_col: makeProfile("string"),
  },
}

describe("ColumnProfilingPanel — type filter (Filter 3)", () => {
  it("defaults to 'all' and shows all columns", () => {
    render(<ColumnProfilingPanel data={data} loading={false} />)
    expect(screen.getByText("email_col")).toBeInTheDocument()
    expect(screen.getByText("amount_col")).toBeInTheDocument()
    expect(screen.getByText("name_col")).toBeInTheDocument()
  })

  it("filter to 'email' hides non-email columns", async () => {
    const user = userEvent.setup()
    render(<ColumnProfilingPanel data={data} loading={false} />)
    const trigger = screen.getByTestId("type-filter-trigger")
    await user.click(trigger)
    const emailOption = await screen.findByRole("option", { name: "email" })
    await user.click(emailOption)
    expect(screen.getByText("email_col")).toBeInTheDocument()
    expect(screen.queryByText("amount_col")).not.toBeInTheDocument()
    expect(screen.queryByText("name_col")).not.toBeInTheDocument()
  })

  it("switching back to 'All types' restores all columns", async () => {
    const user = userEvent.setup()
    render(<ColumnProfilingPanel data={data} loading={false} />)
    // Select email filter
    await user.click(screen.getByTestId("type-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "email" }))
    // Reset to all
    await user.click(screen.getByTestId("type-filter-trigger"))
    await user.click(await screen.findByRole("option", { name: "All types" }))
    expect(screen.getByText("email_col")).toBeInTheDocument()
    expect(screen.getByText("amount_col")).toBeInTheDocument()
    expect(screen.getByText("name_col")).toBeInTheDocument()
  })
})
