/**
 * Unit tests for QuarantineCustomRuleDialog — empty form, generate-rule POST
 * wiring, loading state, code preview, Apply-All gating, and 5xx error.
 *
 * Mocks the api module so we can drive applyColumnRule resolutions and
 * verify the path, then assert the rendered preview / button states.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}))
jest.mock("@/modules/files/api/file-quarantine-api", () => ({
  applyColumnRule: jest.fn(),
  applyColumnRuleAll: jest.fn(),
}))

import {
  applyColumnRule,
  applyColumnRuleAll,
} from "@/modules/files/api/file-quarantine-api"
import { QuarantineCustomRuleDialog } from "@/modules/files/components/quarantine-editor/quarantine-custom-rule-dialog"
import type { QuarantineSession } from "@/modules/files/types"

const mockedApply = applyColumnRule as jest.MockedFunction<typeof applyColumnRule>
const mockedApplyAll = applyColumnRuleAll as jest.MockedFunction<typeof applyColumnRuleAll>

const SESSION: QuarantineSession = {
  session_id: "sess-1",
  base_upload_id: "upload-1",
  session_etag: "etag-1",
}

// A quarantined row — flagged via {col}_dq_status === 'quarantined'
const QROW = {
  row_id: "1",
  email: "bad",
  phone: "x",
  email_dq_status: "quarantined",
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof QuarantineCustomRuleDialog>> = {}) {
  const onOpenChange = jest.fn()
  const onApplied = jest.fn()
  const utils = render(
    <QuarantineCustomRuleDialog
      open
      onOpenChange={onOpenChange}
      rows={[QROW] as any}
      uploadId="upload-1"
      authToken="test-token"
      session={SESSION}
      onApplied={onApplied}
      {...overrides}
    />,
  )
  return { ...utils, onOpenChange, onApplied }
}

describe("QuarantineCustomRuleDialog", () => {
  beforeEach(() => {
    mockedApply.mockReset()
    mockedApplyAll.mockReset()
  })

  it("renders an empty form: no preview, Generate disabled until description typed", () => {
    renderDialog()
    expect(screen.getByText(/AI Fix/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/insert a column/i)).toHaveValue("")
    // Generate button starts disabled (no description)
    const gen = screen.getByRole("button", { name: /Generate.*Preview/i })
    expect(gen).toBeDisabled()
  })

  it("submitting with a valid prompt invokes applyColumnRule on the correct upload", async () => {
    mockedApply.mockResolvedValue({
      fixes: [],
      rule_code: "def fix_row(row): return row",
      rows_affected: 0,
      cross_fixes: [{ row_id: "1", column: "email", original: "bad", fixed: "good@x.com" }],
    } as any)
    renderDialog()
    fireEvent.change(screen.getByPlaceholderText(/insert a column/i), {
      target: { value: "Lowercase all emails" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Generate.*Preview/i }))
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(1))
    const [uploadId, token, payload] = mockedApply.mock.calls[0]
    expect(uploadId).toBe("upload-1")
    expect(token).toBe("test-token")
    expect(payload.description).toBe("Lowercase all emails")
  })

  it("shows a loading indicator while the generate request is in flight", () => {
    mockedApply.mockImplementation(() => new Promise(() => {})) // never resolves
    renderDialog()
    fireEvent.change(screen.getByPlaceholderText(/insert a column/i), {
      target: { value: "fix it" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Generate.*Preview/i }))
    // Loading label replaces "Generate & Preview"
    expect(screen.getByText(/Generating/i)).toBeInTheDocument()
  })

  it("renders the generated rule preview after a successful response", async () => {
    mockedApply.mockResolvedValue({
      fixes: [],
      rule_code: "def fix_row(row):\n    return row",
      rows_affected: 0,
      cross_fixes: [{ row_id: "1", column: "email", original: "bad", fixed: "good@x.com" }],
    } as any)
    renderDialog()
    fireEvent.change(screen.getByPlaceholderText(/insert a column/i), {
      target: { value: "fix emails" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Generate.*Preview/i }))
    // Preview section + sample diff cells appear
    await waitFor(() => expect(screen.getByText(/Preview \(sample\)/i)).toBeInTheDocument())
    expect(screen.getByText(/good@x\.com/)).toBeInTheDocument()
  })

  it("gates Apply-to-All button: only appears after Generate produces a preview", async () => {
    mockedApply.mockResolvedValue({
      fixes: [],
      rule_code: "code",
      rows_affected: 0,
      cross_fixes: [{ row_id: "1", column: "email", original: "bad", fixed: "good@x.com" }],
    } as any)
    renderDialog()
    // Pre-generate: no Apply to All
    expect(screen.queryByRole("button", { name: /Apply to All/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/insert a column/i), {
      target: { value: "fix" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Generate.*Preview/i }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Apply to All/i })).toBeInTheDocument(),
    )
  })

  it("surfaces an error message when the API throws (5xx path)", async () => {
    mockedApply.mockRejectedValue(new Error("500 internal server error"))
    renderDialog()
    fireEvent.change(screen.getByPlaceholderText(/insert a column/i), {
      target: { value: "fix things" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Generate.*Preview/i }))
    await waitFor(() =>
      expect(screen.getByText(/500 internal server error/i)).toBeInTheDocument(),
    )
  })
})
