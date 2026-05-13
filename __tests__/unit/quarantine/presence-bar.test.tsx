/**
 * Unit tests for QuarantinePresenceBar — pill rendering, +N overflow, the
 * active-cell indicator dot, and clean unmount (the bar only owns a tiny
 * useState for hover; it doesn't register any window/WS listeners, so we
 * just verify rerender → unmount doesn't blow up).
 */
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))

import { QuarantinePresenceBar } from "@/modules/files/components/quarantine-editor/quarantine-presence-bar"
import type { CollaborationUser } from "@/modules/files/types"

function mkUser(id: string, name: string, activeCell = ""): CollaborationUser {
  return { id, email: `${name.toLowerCase()}@x.com`, displayName: name, color: "#0af", activeCell }
}

describe("QuarantinePresenceBar", () => {
  it("renders one pill per active user up to the visible cap (4)", () => {
    const users = ["A", "B", "C", "D"].map((n, i) => mkUser(`u${i}`, n))
    render(<QuarantinePresenceBar users={users} connected />)
    // viewer count label is the easiest invariant check
    expect(screen.getByText(/4 viewers/i)).toBeInTheDocument()
    // each pill renders the user's initial letter
    for (const ch of ["A", "B", "C", "D"]) {
      expect(screen.getByText(ch)).toBeInTheDocument()
    }
  })

  it("shows '+N' overflow text when more users than the visible cap", () => {
    const users = ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => mkUser(`u${i}`, n))
    render(<QuarantinePresenceBar users={users} connected />)
    // 7 total, visible cap is 4, so overflow = 3
    expect(screen.getByText("+3")).toBeInTheDocument()
    expect(screen.getByText(/7 viewers/i)).toBeInTheDocument()
  })

  it("renders an active-cell dot when a user has activeCell set (cellFocus equivalent)", () => {
    const { container, rerender } = render(
      <QuarantinePresenceBar users={[mkUser("u1", "Alice", "")]} connected />,
    )
    // No active-cell indicator dot yet
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0)
    // Simulate a cellFocus event by rerendering with activeCell populated
    rerender(<QuarantinePresenceBar users={[mkUser("u1", "Alice", "B2")]} connected />)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })

  it("clears the active-cell badge when activeCell is reset (cellBlur)", () => {
    const { container, rerender } = render(
      <QuarantinePresenceBar users={[mkUser("u1", "Alice", "B2")]} connected />,
    )
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    rerender(<QuarantinePresenceBar users={[mkUser("u1", "Alice", "")]} connected />)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0)
  })

  it("mounts, hovers, and unmounts cleanly without leaking listeners", () => {
    const users = [mkUser("u1", "Alice", "A1"), mkUser("u2", "Bob", "")]
    const { unmount, container } = render(<QuarantinePresenceBar users={users} connected />)
    // Hover the first pill to register & then de-register the hover state — this
    // is the only mutable state the component owns, so if it leaks anywhere this
    // will surface during the unmount.
    const pill = container.querySelector(".flex.h-7.w-7")
    expect(pill).not.toBeNull()
    fireEvent.mouseEnter(pill!)
    fireEvent.mouseLeave(pill!)
    expect(() => unmount()).not.toThrow()
  })
})
