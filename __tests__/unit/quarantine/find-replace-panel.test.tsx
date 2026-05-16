/**
 * Unit tests for QuarantineFindReplacePanel — wiring contract between props
 * and the callbacks the panel fires on type / toggle / scope / Replace All.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))
jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

import { QuarantineFindReplacePanel } from "@/modules/files/components/quarantine-editor/quarantine-find-replace-panel"

type PanelProps = React.ComponentProps<typeof QuarantineFindReplacePanel>

function buildProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    searchTerm: "",
    replaceTerm: "",
    column: null,
    matchCase: false,
    totalMatches: 0,
    currentIndex: -1,
    truncated: false,
    loading: false,
    columns: ["row_id", "email", "phone", "country"],
    hasMoreMatches: false,
    lockedRowIds: [],
    onSearchTermChange: jest.fn(),
    onReplaceTermChange: jest.fn(),
    onColumnChange: jest.fn(),
    onMatchCaseChange: jest.fn(),
    onNext: jest.fn(),
    onPrevious: jest.fn(),
    onReplaceCurrent: jest.fn(),
    onReplaceAll: jest.fn().mockResolvedValue({ replaced: 0, skipped: 0 }),
    onClose: jest.fn(),
    ...overrides,
  }
}

describe("QuarantineFindReplacePanel", () => {
  it("renders empty state: no match summary, disabled actions", () => {
    render(<QuarantineFindReplacePanel {...buildProps()} />)
    expect(screen.getByText(/Find and Replace/i)).toBeInTheDocument()
    expect(screen.queryByText(/matches/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Replace$/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Replace All/i })).toBeDisabled()
  })

  it("fires onSearchTermChange as the user types in the Find input", () => {
    const onSearchTermChange = jest.fn()
    render(<QuarantineFindReplacePanel {...buildProps({ onSearchTermChange })} />)
    fireEvent.change(screen.getByPlaceholderText(/Find\.\.\./i), { target: { value: "foo" } })
    expect(onSearchTermChange).toHaveBeenCalledWith("foo")
  })

  it("toggles match case via the checkbox label", () => {
    const onMatchCaseChange = jest.fn()
    render(<QuarantineFindReplacePanel {...buildProps({ onMatchCaseChange })} />)
    fireEvent.click(screen.getByText(/Match case/i))
    expect(onMatchCaseChange).toHaveBeenCalledWith(true)
  })

  it("renders the match count and current index when there are matches", () => {
    render(
      <QuarantineFindReplacePanel
        {...buildProps({ searchTerm: "foo", totalMatches: 42, currentIndex: 2 })}
      />,
    )
    // currentIndex zero-based, display is +1 → "3 of 42 matches"
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/42/)).toBeInTheDocument()
    expect(screen.getByText(/matches/i)).toBeInTheDocument()
  })

  it("shows a locked-rows badge when lockedRowIds is non-empty", () => {
    render(
      <QuarantineFindReplacePanel
        {...buildProps({ searchTerm: "foo", totalMatches: 5, currentIndex: 0,
          lockedRowIds: ["r1", "r2", "r3"] })}
      />,
    )
    expect(screen.getByText(/3 locked/i)).toBeInTheDocument()
  })

  it("invokes onReplaceAll and surfaces replaced + skipped counts", async () => {
    const onReplaceAll = jest.fn().mockResolvedValue({ replaced: 7, skipped: 2 })
    render(
      <QuarantineFindReplacePanel
        {...buildProps({ searchTerm: "foo", replaceTerm: "bar",
          totalMatches: 9, currentIndex: 0, onReplaceAll })}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Replace All/i }))
    await waitFor(() => expect(onReplaceAll).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Replaced 7/i)).toBeInTheDocument()
    expect(screen.getByText(/skipped/i)).toBeInTheDocument()
  })

  it("closes via Escape key", () => {
    const onClose = jest.fn()
    render(<QuarantineFindReplacePanel {...buildProps({ onClose })} />)
    fireEvent.keyDown(screen.getByPlaceholderText(/Find\.\.\./i), { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })

  it("Enter triggers onNext; Shift+Enter triggers onPrevious", () => {
    const onNext = jest.fn()
    const onPrevious = jest.fn()
    render(
      <QuarantineFindReplacePanel
        {...buildProps({ searchTerm: "foo", totalMatches: 5, currentIndex: 0,
          onNext, onPrevious })}
      />,
    )
    const input = screen.getByPlaceholderText(/Find\.\.\./i)
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onNext).toHaveBeenCalled()
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(onPrevious).toHaveBeenCalled()
  })
})
