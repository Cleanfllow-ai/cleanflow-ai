/**
 * Unit tests for QuarantineAgGridTable — edit-handler wiring, locked-cell
 * editability predicate, and locked-row badge rendering. AG Grid is mocked
 * to a stub that captures its props so tests can drive the callbacks directly.
 */
import { fireEvent, render } from "@testing-library/react"
import "@testing-library/jest-dom"
import React from "react"

const captured: { current: any } = { current: null }

jest.mock("ag-grid-react", () => ({
  AgGridReact: (props: any) => {
    captured.current = props
    return <div data-testid="ag-grid-stub" />
  },
}))
jest.mock("ag-grid-community", () => ({
  AllCommunityModule: {},
  themeQuartz: { withParams: () => ({}) },
}))

import { QuarantineAgGridTable } from "@/modules/files/components/quarantine-editor/quarantine-ag-grid-table"
import type { CellLockInfo } from "@/modules/files/types"

function buildProps(overrides: Partial<React.ComponentProps<typeof QuarantineAgGridTable>> = {}) {
  return {
    columns: ["row_id", "email", "phone"],
    editableColumns: ["email", "phone"],
    totalRows: 100,
    fetchRows: jest.fn().mockResolvedValue({ rows: [], lastRow: 0 }),
    getCellValue: (_r: string, c: string, row: Record<string, any>) => row[c],
    isCellEdited: () => false,
    isCellSaved: () => false,
    onCellEdit: jest.fn(),
    loading: false,
    uploadId: "test-upload",
    reloadToken: 0,
    ...overrides,
  } as React.ComponentProps<typeof QuarantineAgGridTable>
}

const emailCol = () => captured.current.columnDefs.find((c: any) => c.field === "email")

describe("QuarantineAgGridTable", () => {
  beforeEach(() => { captured.current = null })

  it("invokes onCellEdit when AG Grid fires onCellValueChanged", () => {
    const onCellEdit = jest.fn()
    render(<QuarantineAgGridTable {...buildProps({ onCellEdit })} />)
    captured.current.onCellValueChanged({
      colDef: { field: "email" },
      data: { row_id: "42" },
      newValue: "new@example.com",
      oldValue: "old@example.com",
    })
    // 4th argument carries AG-Grid's pre-edit oldValue → consumed by the
    // per-cell undo history (fix: 2026-05-15, undo blank regression).
    expect(onCellEdit).toHaveBeenCalledWith("42", "email", "new@example.com", "old@example.com")
  })

  it("skips onCellEdit when field is row_id", () => {
    const onCellEdit = jest.fn()
    render(<QuarantineAgGridTable {...buildProps({ onCellEdit })} />)
    captured.current.onCellValueChanged({
      colDef: { field: "row_id" },
      data: { row_id: "42" },
      newValue: "ignored",
    })
    expect(onCellEdit).not.toHaveBeenCalled()
  })

  it("editable predicate returns false for is_locked rows", () => {
    render(<QuarantineAgGridTable {...buildProps()} />)
    expect(emailCol().editable({ data: { row_id: "1", is_locked: true } })).toBe(false)
    expect(emailCol().editable({ data: { row_id: "2", is_locked: false } })).toBe(true)
  })

  it("editable predicate returns false when a peer holds the cell lock", () => {
    const cellLocksRef = {
      current: new Map<string, CellLockInfo>([
        ["email:5", { userId: "peer", displayName: "Peer", color: "#abc" }],
      ]),
    } as React.MutableRefObject<Map<string, CellLockInfo>>
    render(<QuarantineAgGridTable {...buildProps({ cellLocksRef })} />)
    expect(emailCol().editable({ data: { row_id: "5" } })).toBe(false)
    expect(emailCol().editable({ data: { row_id: "6" } })).toBe(true)
  })

  it("editable predicate returns true with peer-lock if cell is in myGrantedCells", () => {
    const cellLocksRef = {
      current: new Map<string, CellLockInfo>([
        ["email:5", { userId: "peer", displayName: "Peer", color: "#abc" }],
      ]),
    } as React.MutableRefObject<Map<string, CellLockInfo>>
    const myGrantedCellsRef = { current: new Set(["email:5"]) } as React.MutableRefObject<Set<string>>
    render(<QuarantineAgGridTable {...buildProps({ cellLocksRef, myGrantedCellsRef })} />)
    expect(emailCol().editable({ data: { row_id: "5" } })).toBe(true)
  })

  it("renders the row_id column with a lock badge when is_locked is true", () => {
    const onUnlockRowClick = jest.fn()
    render(<QuarantineAgGridTable {...buildProps({ canUnlock: true, onUnlockRowClick })} />)
    const rowIdCol = captured.current.columnDefs.find((c: any) => c.field === "row_id")
    const tree = rowIdCol.cellRenderer({
      data: { row_id: "9", is_locked: true },
      value: "9",
      valueFormatted: "9",
    })
    const utils = render(tree)
    const button = utils.container.querySelector("button")
    expect(button).not.toBeNull()
    fireEvent.click(button!)
    expect(onUnlockRowClick).toHaveBeenCalledWith("9")
  })
})
