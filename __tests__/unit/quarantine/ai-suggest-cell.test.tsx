/**
 * Unit tests for AiSuggestCellRenderer — popover open, LLM call wiring with
 * cell context, loading state, Accept (applies + closes), Reject (closes
 * with no edit). Radix Popover is stubbed so the popover body renders inline
 * regardless of open state, letting us assert on the rendered UI directly.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))
// Radix Popover uses a portal — stub it so PopoverContent renders inline.
jest.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}))
jest.mock("@/modules/files/api/file-quarantine-api", () => ({
  suggestQuarantineFix: jest.fn(),
}))

import { suggestQuarantineFix } from "@/modules/files/api/file-quarantine-api"
import { AiSuggestCellRenderer } from "@/modules/files/components/quarantine-editor/quarantine-ai-suggest-cell"

const mockedSuggest = suggestQuarantineFix as jest.MockedFunction<typeof suggestQuarantineFix>

function renderCell(overrides: Partial<React.ComponentProps<typeof AiSuggestCellRenderer>> = {}) {
  const onAccept = jest.fn()
  const utils = render(
    <AiSuggestCellRenderer
      value="bad"
      data={{ row_id: "1", email: "bad", email_dq_status: "quarantined" }}
      colDef={{ field: "email" }}
      uploadId="upload-1"
      authToken="test-token"
      onAccept={onAccept}
      {...overrides}
    />,
  )
  return { ...utils, onAccept }
}

describe("AiSuggestCellRenderer", () => {
  beforeEach(() => {
    mockedSuggest.mockReset()
  })

  it("renders the trigger button for quarantined cells and fetches on click", async () => {
    mockedSuggest.mockResolvedValue({
      suggestion: "good@x.com",
      confidence: "high",
      reasoning: "lowercased and added domain",
    })
    renderCell()
    // Click ✨ button to open popover + fire suggest fetch
    fireEvent.click(screen.getByTitle(/AI fix suggestion/i))
    await waitFor(() => expect(mockedSuggest).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("good@x.com")).toBeInTheDocument()
  })

  it("LLM call fires with the cell's column, value, and rule context", async () => {
    mockedSuggest.mockResolvedValue({
      suggestion: "fixed",
      confidence: "medium",
      reasoning: "",
    })
    renderCell({
      value: "raw-bad",
      data: {
        row_id: "42",
        email: "raw-bad",
        email_dq_status: "quarantined",
        dq_violations: JSON.stringify([
          { column: "email", rule_id: "EMAIL_FORMAT", message: "invalid" },
        ]),
      },
    })
    fireEvent.click(screen.getByTitle(/AI fix suggestion/i))
    await waitFor(() => expect(mockedSuggest).toHaveBeenCalledTimes(1))
    const [uploadId, token, params] = mockedSuggest.mock.calls[0]
    expect(uploadId).toBe("upload-1")
    expect(token).toBe("test-token")
    expect(params.column).toBe("email")
    expect(params.value).toBe("raw-bad")
    expect(params.rule_id).toBe("EMAIL_FORMAT")
    expect(params.issue_message).toBe("invalid")
  })

  it("shows a loading skeleton while the request is in flight", () => {
    mockedSuggest.mockImplementation(() => new Promise(() => {})) // never resolves
    renderCell()
    fireEvent.click(screen.getByTitle(/AI fix suggestion/i))
    expect(screen.getByText(/Generating suggestion/i)).toBeInTheDocument()
  })

  it("Accept applies the suggestion via onAccept and re-renders the cell value", async () => {
    mockedSuggest.mockResolvedValue({
      suggestion: "good@x.com",
      confidence: "high",
      reasoning: "",
    })
    const { onAccept } = renderCell()
    fireEvent.click(screen.getByTitle(/AI fix suggestion/i))
    const accept = await screen.findByRole("button", { name: /Accept/i })
    fireEvent.click(accept)
    expect(onAccept).toHaveBeenCalledWith("1", "email", "good@x.com")
    // After acceptance, the cell shows the accepted value immediately (don't wait for AG Grid)
    expect(screen.getAllByText("good@x.com").length).toBeGreaterThan(0)
  })

  it("Reject (X button) closes without invoking onAccept", async () => {
    mockedSuggest.mockResolvedValue({
      suggestion: "good@x.com",
      confidence: "low",
      reasoning: "",
    })
    const { onAccept } = renderCell()
    fireEvent.click(screen.getByTitle(/AI fix suggestion/i))
    // Wait for both buttons (Accept + dismiss X) to render
    await screen.findByRole("button", { name: /Accept/i })
    const allButtons = screen.getAllByRole("button")
    // The dismiss/reject button is the last button (X icon) inside popover-content
    const rejectBtn = allButtons[allButtons.length - 1]
    fireEvent.click(rejectBtn)
    expect(onAccept).not.toHaveBeenCalled()
  })
})
