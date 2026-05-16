/**
 * Unit tests for K5 — dry-run F&R preview + skipped-rows inspector.
 *
 * Covers:
 *  1. "Preview matches" button calls the API with `dry_run: true`.
 *  2. Sample matches render inside the side-panel.
 *  3. The "Confirm replace all" button is gated behind a successful preview.
 *  4. Skipped-rows panel renders reason chips for each row.
 *  5. The CSV export button generates the correct blob payload.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

// ── Mocks ─────────────────────────────────────────────────────────────
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))
jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

// Tabs mock — render every TabsContent so we can find the Skipped panel
// without having to drive Radix Tabs state from inside JSDOM.
jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
  TabsContent: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
}))

const mockPreview = jest.fn()
jest.mock("@/modules/files/api/file-quarantine-api", () => ({
  __esModule: true,
  previewFindReplace: (...args: any[]) => mockPreview(...args),
}))

// Provide a controllable mock for the async F&R hook so the test can flip
// the panel into "summary ready" state and exercise the Skipped tab.
const asyncHookState: any = {
  state: {
    status: "idle",
    operationId: null,
    progress: { applied: 0, total: 0, percent: 0 },
    eta_seconds: -1,
    result: null,
    error: null,
  },
  submitAndPoll: jest.fn().mockResolvedValue({}),
  reset: jest.fn(),
}
jest.mock("@/modules/files/hooks/use-quarantine-find-replace", () => ({
  __esModule: true,
  useQuarantineFindReplace: () => asyncHookState,
}))

import { QuarantineFindReplacePanel } from "@/modules/files/components/quarantine-editor/quarantine-find-replace-panel"
import {
  QuarantineSkippedRowsPanel,
  buildSkippedRowsCsv,
  classifySkippedReason,
} from "@/modules/files/components/quarantine-editor/quarantine-skipped-rows-panel"

type PanelProps = React.ComponentProps<typeof QuarantineFindReplacePanel>

function buildAsyncProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    searchTerm: "foo",
    replaceTerm: "bar",
    column: null,
    matchCase: false,
    totalMatches: 25,
    currentIndex: 0,
    truncated: false,
    loading: false,
    columns: ["row_id", "email", "country"],
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
    // Async branch — these enable the K5 preview path.
    uploadId: "upload-xyz",
    authToken: "test-token",
    sessionId: "sess-1",
    sessionEtag: "etag-1",
    asyncScope: "ENTIRE_QUARANTINE",
    ...overrides,
  }
}

beforeEach(() => {
  mockPreview.mockReset()
  asyncHookState.state = {
    status: "idle",
    operationId: null,
    progress: { applied: 0, total: 0, percent: 0 },
    eta_seconds: -1,
    result: null,
    error: null,
  }
})

describe("K5 dry-run preview", () => {
  it("Preview matches button calls the API with dry_run: true", async () => {
    mockPreview.mockResolvedValueOnce({
      sample_matches: [],
      total_count: 0,
      truncated: false,
    })

    render(<QuarantineFindReplacePanel {...buildAsyncProps()} />)
    const btn = screen.getByTestId("preview-matches-btn")
    expect(btn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(btn)
    })

    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1))
    const [uploadId, token, body] = mockPreview.mock.calls[0]
    expect(uploadId).toBe("upload-xyz")
    expect(token).toBe("test-token")
    expect(body.dry_run).toBe(true)
    expect(body.find_pattern).toBe("foo")
    expect(body.replace_pattern).toBe("bar")
    expect(body.session_id).toBe("sess-1")
  })

  it("renders sample matches in the preview side-panel", async () => {
    mockPreview.mockResolvedValueOnce({
      sample_matches: [
        { row_id: "r-001", column: "email", old_value: "a@x", new_value: "a@y" },
        { row_id: "r-002", column: "email", old_value: "b@x", new_value: "b@y" },
      ],
      total_count: 2,
      truncated: false,
    })

    render(<QuarantineFindReplacePanel {...buildAsyncProps()} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-matches-btn"))
    })

    await waitFor(() => {
      expect(screen.getByTestId("fnr-preview-panel")).toBeInTheDocument()
    })
    const items = screen.getAllByTestId("fnr-preview-match")
    expect(items).toHaveLength(2)
    expect(screen.getByText("r-001")).toBeInTheDocument()
    expect(screen.getByText("r-002")).toBeInTheDocument()
  })

  it("gates Confirm replace behind a successful preview", async () => {
    // Before preview: no Confirm button, only the Preview button.
    const { rerender } = render(<QuarantineFindReplacePanel {...buildAsyncProps()} />)
    expect(screen.queryByTestId("confirm-replace-all-btn")).toBeNull()
    expect(screen.getByTestId("preview-matches-btn")).toBeInTheDocument()

    // After a successful preview the Confirm button appears.
    mockPreview.mockResolvedValueOnce({
      sample_matches: [{ row_id: "r-1", column: "email", old_value: "a", new_value: "b" }],
      total_count: 1,
      truncated: false,
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId("preview-matches-btn"))
    })
    await waitFor(() => {
      expect(screen.getByTestId("confirm-replace-all-btn")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("preview-matches-btn")).toBeNull()

    // Sanity rerender to ensure props update doesn't re-hide Confirm.
    rerender(<QuarantineFindReplacePanel {...buildAsyncProps()} />)
    expect(screen.getByTestId("confirm-replace-all-btn")).toBeInTheDocument()
  })
})

describe("K5 skipped-rows inspector", () => {
  it("renders reason chips for each skipped row category", () => {
    const rows = [
      { row_id: "r-1", reason: "row is locked" },
      { row_id: "r-2", reason: "Pushed to ERP" },
      { row_id: "r-3", reason: "read_only rule applied" },
      { row_id: "r-4", reason: "unknown failure" },
    ]
    render(<QuarantineSkippedRowsPanel rows={rows} />)

    expect(screen.getByTestId("skipped-row-chip-LOCKED")).toBeInTheDocument()
    expect(screen.getByTestId("skipped-row-chip-PUSHED_TO_ERP")).toBeInTheDocument()
    expect(screen.getByTestId("skipped-row-chip-READ_ONLY_RULE")).toBeInTheDocument()
    expect(screen.getByTestId("skipped-row-chip-OTHER")).toBeInTheDocument()
    expect(screen.getAllByTestId("skipped-row-item")).toHaveLength(4)

    // classifier sanity (also makes the helper covered).
    expect(classifySkippedReason("locked")).toBe("LOCKED")
    expect(classifySkippedReason("erp push")).toBe("PUSHED_TO_ERP")
    expect(classifySkippedReason("readonly rule")).toBe("READ_ONLY_RULE")
    expect(classifySkippedReason("???")).toBe("OTHER")
  })

  it("CSV export button generates a correctly-shaped blob", () => {
    const rows = [
      { row_id: "r-1", reason: "row is locked", column: "email" },
      { row_id: "r-2", reason: "Pushed to ERP", column: "country" },
    ]

    // Spy the blob URL plumbing so we can intercept the download.
    const createUrl = jest.fn(() => "blob:fake")
    const revokeUrl = jest.fn()
    ;(global as any).URL.createObjectURL = createUrl
    ;(global as any).URL.revokeObjectURL = revokeUrl

    // Stub anchor click so JSDOM doesn't attempt navigation.
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)

    render(<QuarantineSkippedRowsPanel rows={rows} filenameStem="invoices" />)
    fireEvent.click(screen.getByTestId("skipped-rows-export-btn"))

    expect(createUrl).toHaveBeenCalledTimes(1)
    const blobArg = createUrl.mock.calls[0][0] as Blob
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toContain("text/csv")
    expect(anchorClick).toHaveBeenCalledTimes(1)

    // Direct CSV builder check — header + rows + classification column.
    const csv = buildSkippedRowsCsv(rows)
    expect(csv.split("\n")[0]).toBe("row_id,column,reason,category")
    expect(csv).toMatch(/r-1,email,/)
    expect(csv).toMatch(/,LOCKED/)
    expect(csv).toMatch(/r-2,country,/)
    expect(csv).toMatch(/,PUSHED_TO_ERP/)

    anchorClick.mockRestore()
  })
})
