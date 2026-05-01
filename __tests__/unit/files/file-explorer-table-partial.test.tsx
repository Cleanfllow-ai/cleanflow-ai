/**
 * Phase 4 W14 — Files list view: partial completion warning icon.
 *
 * Verifies that the file-explorer-table renders a small AlertTriangle
 * warning icon next to the status pill when `partial_completion === true`,
 * and renders NOTHING extra when the field is false / undefined.
 *
 * The icon is purely additive UX — files without the flag must look
 * identical to before the change.
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { FileExplorerTable } from "@/modules/files/page/file-explorer-table";
import type { FileStatusResponse } from "@/modules/files";
import type { FilesPageState } from "@/modules/files/page/use-files-page";

// Mock the upload manager context — the table consumes it via useUploadManager()
jest.mock("@/modules/files/context/upload-manager", () => ({
  useUploadManager: () => ({
    activeUploads: new Map(),
    getUploadForFile: () => undefined,
    cancelUpload: () => undefined,
  }),
}));

function buildFile(overrides: Partial<FileStatusResponse> = {}): FileStatusResponse {
  return {
    upload_id: "upl-test-1",
    status: "DQ_FIXED",
    original_filename: "sample.csv",
    filename: "sample.csv",
    rows_in: 100,
    rows_quarantined: 0,
    dq_score: 95.0,
    uploaded_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildState(files: FileStatusResponse[]): FilesPageState {
  // Minimal subset of FilesPageState required by FileExplorerTable.
  // Cast to FilesPageState — unused fields would be runtime errors only on interaction.
  const noop = () => undefined;
  return {
    files,
    loading: false,
    filteredFiles: files,
    tableEmpty: files.length === 0,
    searchQuery: "",
    setSearchQuery: noop,
    statusFilter: "all",
    setStatusFilter: noop,
    sortField: "uploaded",
    sortDirection: "desc",
    handleSort: noop,
    visibleColumns: new Set(["file", "score", "status", "uploaded", "updated", "actions"]),
    setDisplayColumnModalOpen: noop,
    isManualRefresh: false,
    handleManualRefresh: noop,
    handleViewDetails: noop,
    handleStartProcessing: noop,
    handleQuickProcess: noop,
    openActionsDialog: noop,
    handleDeleteClick: noop,
    downloading: null,
    deleting: null,
    handleOpenQuarantineEditor: noop,
    highlightedFileId: null,
    selectedFiles: new Set<string>(),
    handleSelectFile: noop,
    handleSelectAll: noop,
    handleBulkDeleteClick: noop,
    bulkDeleting: false,
    recentlyUploaded: null,
    setRecentlyUploaded: noop,
    setWizardFile: noop,
    setWizardOpen: noop,
    handleNewImportOpen: noop,
  } as unknown as FilesPageState;
}

describe("FileExplorerTable — partial completion warning icon", () => {
  it("renders no warning icon when partial_completion is undefined", () => {
    const state = buildState([buildFile({ partial_completion: undefined })]);
    render(<FileExplorerTable state={state} />);
    expect(
      screen.queryByTestId("partial-completion-warning-icon")
    ).not.toBeInTheDocument();
  });

  it("renders no warning icon when partial_completion is false", () => {
    const state = buildState([buildFile({ partial_completion: false })]);
    render(<FileExplorerTable state={state} />);
    expect(
      screen.queryByTestId("partial-completion-warning-icon")
    ).not.toBeInTheDocument();
  });

  it("renders the warning icon when partial_completion is true", () => {
    const state = buildState([buildFile({ partial_completion: true })]);
    render(<FileExplorerTable state={state} />);
    const icon = screen.getByTestId("partial-completion-warning-icon");
    expect(icon).toBeInTheDocument();
    // aria-label / title contain "warning" and/or "partial"
    const aria = icon.getAttribute("aria-label") ?? "";
    const title = icon.getAttribute("title") ?? "";
    expect(`${aria} ${title}`.toLowerCase()).toMatch(/warning|partial/);
  });

  it("renders the warning icon only on rows where partial_completion=true", () => {
    const state = buildState([
      buildFile({ upload_id: "u-1", partial_completion: false }),
      buildFile({ upload_id: "u-2", partial_completion: true }),
      buildFile({ upload_id: "u-3" }), // undefined
    ]);
    render(<FileExplorerTable state={state} />);
    const icons = screen.getAllByTestId("partial-completion-warning-icon");
    expect(icons).toHaveLength(1);
  });
});
