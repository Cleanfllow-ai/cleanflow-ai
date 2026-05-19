/**
 * P0-1 + P0-5: aria-labels on catalog row-action buttons + 44px tap targets
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FileExplorerTable } from "@/modules/files/page/file-explorer-table";
import type { FileStatusResponse } from "@/modules/files";
import type { FilesPageState } from "@/modules/files/page/use-files-page";

jest.mock("@/modules/files/context/upload-manager", () => ({
  useUploadManager: () => ({
    activeUploads: new Map(),
    getUploadForFile: () => undefined,
    cancelUpload: () => undefined,
  }),
}));

function buildFile(overrides: Partial<FileStatusResponse> = {}): FileStatusResponse {
  return {
    upload_id: "upl-001",
    status: "DQ_FIXED",
    original_filename: "test.csv",
    filename: "test.csv",
    rows_in: 500,
    rows_quarantined: 10,
    dq_score: 90,
    uploaded_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-01-02T10:00:00Z",
    ...overrides,
  };
}

function buildState(
  files: FileStatusResponse[],
  overrides: Partial<FilesPageState> = {},
): FilesPageState {
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
    handleStopClick: noop,
    handleOpenQuarantineEditor: noop,
    deleting: null,
    stopping: null,
    downloading: null,
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
    ...overrides,
  } as unknown as FilesPageState;
}

describe("P0-1: aria-labels on catalog row-action buttons", () => {
  it('View Details button has descriptive aria-label when processed', () => {
    const file = buildFile({ status: "DQ_FIXED" });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "View file details" });
    expect(btn).toBeInTheDocument();
  });

  it('Export button has descriptive aria-label when processed', () => {
    const file = buildFile({ status: "DQ_FIXED" });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "Export file" });
    expect(btn).toBeInTheDocument();
  });

  it('Edit quarantine button has aria-label with row count', () => {
    const file = buildFile({ status: "DQ_FIXED", rows_quarantined: 5 });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "Edit quarantined rows (5)" });
    expect(btn).toBeInTheDocument();
  });

  it('Disabled quarantine button has aria-label when no quarantined rows', () => {
    const file = buildFile({ status: "DQ_FIXED", rows_quarantined: 0 });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "No quarantined rows to edit" });
    expect(btn).toBeInTheDocument();
  });

  it('Dismiss notification button has aria-label', () => {
    const file = buildFile({ status: "DQ_FIXED" });
    const state = buildState([file], {
      recentlyUploaded: file,
    });
    render(<FileExplorerTable state={state} />);
    const btn = screen.getByRole("button", { name: "Dismiss upload notification" });
    expect(btn).toBeInTheDocument();
  });
});

describe("P0-5: row action buttons have ≥40px touch targets", () => {
  it('View Details button is at least 40px (h-10 w-10)', () => {
    const file = buildFile({ status: "DQ_FIXED" });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "View file details" });
    expect(btn.className).toContain("h-10");
    expect(btn.className).toContain("w-10");
  });

  it('Export button is at least 40px (h-10 w-10)', () => {
    const file = buildFile({ status: "DQ_FIXED" });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "Export file" });
    expect(btn.className).toContain("h-10");
    expect(btn.className).toContain("w-10");
  });

  it('Delete button is at least 40px (h-10 w-10)', () => {
    const file = buildFile({ status: "DQ_FIXED" });
    render(<FileExplorerTable state={buildState([file])} />);
    const btn = screen.getByRole("button", { name: "Delete file" });
    expect(btn.className).toContain("h-10");
    expect(btn.className).toContain("w-10");
  });
});
