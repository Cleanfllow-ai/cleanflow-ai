/**
 * Unit tests for QuarantineVersionCompareDialog. Stubs the API +
 * Radix-portal primitives so the diff UI assertions are flat & fast.
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
jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))
jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, id }: any) => (
    <input type="checkbox" id={id} checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}))
jest.mock("@/modules/files/api", () => ({ queryQuarantinedRows: jest.fn() }))

import { queryQuarantinedRows } from "@/modules/files/api"
import { QuarantineVersionCompareDialog } from "@/modules/files/components/quarantine-editor/quarantine-version-compare-dialog"
import type { FileVersionSummary } from "@/modules/files/types"

const mockedQuery = queryQuarantinedRows as jest.MockedFunction<typeof queryQuarantinedRows>

const LINEAGE: FileVersionSummary[] = [
  { upload_id: "v1-uid", version_number: 1, is_latest: false },
  { upload_id: "v2-uid", version_number: 2, is_latest: true },
]
const COLUMNS = ["row_id", "email", "phone"]
const row = (id: string, email: string) => ({ row_id: id, email, phone: "+1" }) as any

function renderDialog(overrides: Partial<React.ComponentProps<typeof QuarantineVersionCompareDialog>> = {}) {
  const onOpenChange = jest.fn()
  const utils = render(
    <QuarantineVersionCompareDialog
      open
      onOpenChange={onOpenChange}
      uploadId="root-upload"
      authToken="test-token"
      lineage={LINEAGE}
      columns={COLUMNS}
      {...overrides}
    />,
  )
  return { ...utils, onOpenChange }
}

describe("QuarantineVersionCompareDialog", () => {
  beforeEach(() => { mockedQuery.mockReset() })

  it("renders V1/V2 column headers after load", async () => {
    mockedQuery.mockImplementation(async (_u, _t, p: any) =>
      ({ rows: [row("1", p.version === "v1-uid" ? "old@x.com" : "new@x.com")], next_cursor: null } as any))
    renderDialog()
    await waitFor(() => expect(screen.getAllByText(/^v1$/i).length).toBeGreaterThan(0))
    expect(screen.getAllByText(/v2 \(latest\)/i).length).toBeGreaterThan(0)
  })

  it("highlights a changed cell when values differ between versions", async () => {
    mockedQuery.mockImplementation(async (_u, _t, p: any) =>
      ({ rows: [row("1", p.version === "v1-uid" ? "old@x.com" : "new@x.com")], next_cursor: null } as any))
    renderDialog()
    await waitFor(() => expect(screen.getByText("changed")).toBeInTheDocument())
    expect(screen.getByText(/old@x\.com/)).toBeInTheDocument()
    expect(screen.getByText(/new@x\.com/)).toBeInTheDocument()
  })

  it("renders an 'added' badge when a row exists only in version B", async () => {
    mockedQuery.mockImplementation(async (_u, _t, p: any) =>
      p.version === "v1-uid"
        ? ({ rows: [], next_cursor: null } as any)
        : ({ rows: [row("99", "new@x.com")], next_cursor: null } as any))
    renderDialog()
    await waitFor(() => expect(screen.getByText("added")).toBeInTheDocument())
  })

  it("hides identical rows by default and toggles them on via switch", async () => {
    mockedQuery.mockResolvedValue({ rows: [row("1", "same@x.com")], next_cursor: null } as any)
    renderDialog()
    await waitFor(() => expect(screen.getByText(/No row-level differences/i)).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText(/Show unchanged rows/i))
    await waitFor(() => expect(screen.getByText("identical")).toBeInTheDocument())
  })

  it("shows 'pick two different versions' when only one version exists", async () => {
    mockedQuery.mockResolvedValue({ rows: [], next_cursor: null } as any)
    renderDialog({ lineage: [{ upload_id: "only-v1", version_number: 1, is_latest: true }] })
    expect(await screen.findByText(/Select two different versions/i)).toBeInTheDocument()
  })

  it("renders a loading indicator while the fetch is in flight", () => {
    mockedQuery.mockImplementation(() => new Promise(() => {}))
    renderDialog()
    expect(screen.getAllByText(/Loading (rows|version data)/i).length).toBeGreaterThan(0)
  })

  it("shows an error message when the API throws", async () => {
    mockedQuery.mockRejectedValue(new Error("404 not found"))
    renderDialog()
    await waitFor(() => expect(screen.getAllByText(/404 not found/i).length).toBeGreaterThan(0))
  })

  it("fires onOpenChange(false) when the Close button is clicked", async () => {
    mockedQuery.mockResolvedValue({ rows: [], next_cursor: null } as any)
    const { onOpenChange } = renderDialog()
    fireEvent.click(await screen.findByRole("button", { name: /^Close$/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
