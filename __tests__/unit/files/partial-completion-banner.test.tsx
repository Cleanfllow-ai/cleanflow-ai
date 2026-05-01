/**
 * Unit tests for PartialCompletionBanner.
 *
 * Covers:
 *   - partialCompletion=false renders nothing
 *   - partialCompletion=true with no failed shards renders the generic banner
 *   - partialCompletion=true with N failed shards renders banner showing N
 *   - "View details" button is hidden when there are no failed shards
 */
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { PartialCompletionBanner } from "@/modules/files/components/partial-completion-banner"

describe("PartialCompletionBanner", () => {
  it("renders nothing when partialCompletion is false", () => {
    const { container } = render(
      <PartialCompletionBanner partialCompletion={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when partialCompletion is false even with failed_shards present", () => {
    const { container } = render(
      <PartialCompletionBanner
        partialCompletion={false}
        failedShards={[
          { shard_id: "s1", error_code: "E1", error_message: "boom" },
        ]}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders a generic banner when partialCompletion=true with empty failedShards", () => {
    render(
      <PartialCompletionBanner partialCompletion={true} failedShards={[]} />
    )
    expect(
      screen.getByTestId("partial-completion-banner")
    ).toBeInTheDocument()
    expect(screen.getByText("Processed with warnings")).toBeInTheDocument()
    expect(
      screen.getByText(/Some shards encountered errors/i)
    ).toBeInTheDocument()
    // No details available -> no "View details" button
    expect(
      screen.queryByRole("button", { name: /view details/i })
    ).not.toBeInTheDocument()
  })

  it("renders a banner with the failed shard count when failedShards has entries", () => {
    const failedShards = [
      { shard_id: "shard-001", error_code: "TIMEOUT", error_message: "Worker timed out" },
      { shard_id: "shard-002", error_code: "MEM", error_message: "Out of memory" },
      { shard_id: "shard-003", error_code: "OTHER", error_message: "Unknown failure" },
    ]
    render(
      <PartialCompletionBanner
        partialCompletion={true}
        failedShards={failedShards}
      />
    )
    expect(
      screen.getByTestId("partial-completion-banner")
    ).toBeInTheDocument()
    // "3" appears in the summary text
    expect(screen.getByText(/\b3\b/)).toBeInTheDocument()
    // View details button is rendered
    expect(
      screen.getByRole("button", { name: /view details/i })
    ).toBeInTheDocument()
  })

  it("includes total count when totalShards is provided", () => {
    render(
      <PartialCompletionBanner
        partialCompletion={true}
        failedShards={[
          { shard_id: "s1", error_code: "E", error_message: "boom" },
          { shard_id: "s2", error_code: "E", error_message: "boom" },
        ]}
        totalShards={10}
      />
    )
    expect(screen.getByText(/2 of 10 shards/i)).toBeInTheDocument()
  })
})
