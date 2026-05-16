/**
 * Unit tests for TcpSourceForm (added with the bridge-errors hardening).
 * Covers: required-field validation, port-range validation, host-format
 *         validation, auth-type required-field guards, classified error
 *         message rendering on ingest failure.
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO

jest.mock("@/modules/files", () => ({
  fileManagementAPI: {
    testTcpConnection: jest.fn(),
    ingestFromTcp: jest.fn(),
  },
}))
jest.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
}))
jest.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, id }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import { fileManagementAPI } from "@/modules/files"
import TcpSourceForm from "@/modules/unified-bridge/components/tcp-source-form"

const mockApi = fileManagementAPI as any
const baseProps = {
  mode: "source" as const,
  token: "test-token",
  onIngestionStart: jest.fn(),
  onIngestionComplete: jest.fn(),
  onError: jest.fn(),
  disabled: false,
}

beforeEach(() => {
  jest.clearAllMocks()
})

const fillRequired = () => {
  fireEvent.change(screen.getByLabelText(/host \*/i), {
    target: { value: "data.example.com" },
  })
  fireEvent.change(screen.getByLabelText(/port \*/i), { target: { value: "9000" } })
  fireEvent.change(screen.getByLabelText(/save as/i), { target: { value: "out.csv" } })
}

describe("TcpSourceForm validation", () => {
  it("rejects an invalid hostname before any API call", async () => {
    render(<TcpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/host \*/i), {
      target: { value: "not a host with spaces" },
    })
    fireEvent.change(screen.getByLabelText(/port \*/i), { target: { value: "9000" } })
    fireEvent.change(screen.getByLabelText(/save as/i), { target: { value: "o.csv" } })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /ingest data/i }))
    })

    expect(baseProps.onError).toHaveBeenCalledWith(expect.stringMatching(/host is invalid/i))
    expect(mockApi.ingestFromTcp).not.toHaveBeenCalled()
  })

  it("rejects an out-of-range port", async () => {
    render(<TcpSourceForm {...baseProps} />)
    fireEvent.change(screen.getByLabelText(/host \*/i), { target: { value: "x.example.com" } })
    fireEvent.change(screen.getByLabelText(/port \*/i), { target: { value: "70000" } })
    fireEvent.change(screen.getByLabelText(/save as/i), { target: { value: "o.csv" } })

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /ingest data/i }))
    })

    expect(baseProps.onError).toHaveBeenCalledWith(
      expect.stringMatching(/port must be an integer/i),
    )
    expect(mockApi.ingestFromTcp).not.toHaveBeenCalled()
  })

  it("surfaces a classified auth message when BE returns 401-shaped error", async () => {
    mockApi.ingestFromTcp.mockRejectedValue(new Error("HTTP authentication failed (401)"))
    render(<TcpSourceForm {...baseProps} />)
    fillRequired()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /ingest data/i }))
    })

    await waitFor(() => {
      expect(baseProps.onError).toHaveBeenCalledWith(
        expect.stringMatching(/authentication failed/i),
      )
    })
    // The raw "HTTP authentication failed (401)" must NOT have been passed through
    // unmodified — classifier should have rewritten it to friendly copy.
    const lastCall = baseProps.onError.mock.calls.at(-1)?.[0] as string
    expect(lastCall).not.toMatch(/^HTTP authentication failed \(401\)$/)
  })

  it("surfaces a classified network message for ECONNREFUSED", async () => {
    mockApi.ingestFromTcp.mockRejectedValue(new Error("ECONNREFUSED 1.2.3.4:9000"))
    render(<TcpSourceForm {...baseProps} />)
    fillRequired()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /ingest data/i }))
    })

    await waitFor(() => {
      expect(baseProps.onError).toHaveBeenCalledWith(
        expect.stringMatching(/network error/i),
      )
    })
  })
})
