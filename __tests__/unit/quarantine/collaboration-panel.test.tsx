/**
 * Unit tests for QuarantineCollaborationPanel — peer list rendering,
 * connected/empty states, join/leave handling, and onClose wiring. The
 * panel surfaces collaborators with name + email; +N overflow lives on
 * QuarantinePresenceBar (covered in its own test file).
 */
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }))

import { QuarantineCollaborationPanel } from "@/modules/files/components/quarantine-editor/quarantine-collaboration-panel"
import type { CollaborationUser } from "@/modules/files/types"

function u(id: string, name: string, opts: Partial<CollaborationUser> = {}): CollaborationUser {
  return {
    id,
    email: `${name.toLowerCase()}@x.com`,
    displayName: name,
    color: "#abc",
    activeCell: "",
    ...opts,
  }
}

type PanelProps = React.ComponentProps<typeof QuarantineCollaborationPanel>
function buildProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    users: [],
    activity: [],
    connected: true,
    onClose: jest.fn(),
    currentUserId: "me",
    ...overrides,
  }
}

describe("QuarantineCollaborationPanel", () => {
  it("renders active collaborators list with self + peers", () => {
    render(
      <QuarantineCollaborationPanel
        {...buildProps({ users: [u("me", "Me"), u("p1", "Alice"), u("p2", "Bob")] })}
      />,
    )
    expect(screen.getByText("Me")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument() // counter pill
  })

  it("user-joined: re-rendering with a new user appends to the list", () => {
    const initial = [u("me", "Me")]
    const { rerender } = render(<QuarantineCollaborationPanel {...buildProps({ users: initial })} />)
    expect(screen.queryByText("Carol")).not.toBeInTheDocument()
    rerender(
      <QuarantineCollaborationPanel {...buildProps({ users: [...initial, u("p3", "Carol")] })} />,
    )
    expect(screen.getByText("Carol")).toBeInTheDocument()
  })

  it("user-left: re-rendering without a user removes them", () => {
    const both = [u("me", "Me"), u("p1", "Alice")]
    const { rerender } = render(<QuarantineCollaborationPanel {...buildProps({ users: both })} />)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    rerender(<QuarantineCollaborationPanel {...buildProps({ users: [u("me", "Me")] })} />)
    expect(screen.queryByText("Alice")).not.toBeInTheDocument()
  })

  it("renders all collaborators with email lines when there are >5", () => {
    // Multi-letter names avoid the single-letter avatar/displayName collision.
    const names = ["Adam", "Beth", "Chen", "Dawn", "Erin", "Finn"]
    const many = names.map((n, i) => u(`u${i}`, n))
    render(<QuarantineCollaborationPanel {...buildProps({ users: many })} />)
    expect(screen.getByText("6")).toBeInTheDocument()
    for (const n of names) {
      expect(screen.getByText(n)).toBeInTheDocument()
    }
    // email row separately surfaces user_id-equivalent (email) for each peer
    expect(screen.getByText("adam@x.com")).toBeInTheDocument()
    expect(screen.getByText("finn@x.com")).toBeInTheDocument()
  })

  it("renders both displayName and email for each peer (identification)", () => {
    render(
      <QuarantineCollaborationPanel
        {...buildProps({ users: [u("p1", "Alice", { email: "alice@x.com" })] })}
      />,
    )
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("alice@x.com")).toBeInTheDocument()
  })

  it("empty state when only self is present (no peers)", () => {
    render(<QuarantineCollaborationPanel {...buildProps({ users: [], connected: true })} />)
    expect(screen.getByText(/only one here/i)).toBeInTheDocument()
  })
})
