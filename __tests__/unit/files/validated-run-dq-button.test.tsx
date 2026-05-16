/**
 * Bug 5 — "Run DQ" button for VALIDATED files.
 *
 * Asserts:
 * 1. A VALIDATED file renders a "Run DQ" button (data-testid="run-dq-button").
 * 2. Clicking the button fires handleStartProcessing with the file.
 * 3. UPLOADED files still show the button (regression guard).
 * 4. DQ_FIXED files do NOT show the button.
 */
import { render, screen, fireEvent } from "@testing-library/react";
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
    upload_id: "upl-test-1",
    status: "VALIDATED",
    original_filename: "sample.csv",
    filename: "sample.csv",
    rows_in: 100,
    rows_quarantined: 0,
    dq_score: undefined,
    uploaded_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildState(
  files: FileStatusResponse[],
  handleStartProcessing: (f: FileStatusResponse) => void = () => undefined
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
    handleStartProcessing,
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

describe("FileExplorerTable — Run DQ button for VALIDATED files", () => {
  it("renders Run DQ button when file status is VALIDATED", () => {
    const state = buildState([buildFile({ status: "VALIDATED" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByTestId("run-dq-button")).toBeInTheDocument();
    expect(screen.getByTestId("run-dq-button")).toHaveAttribute("aria-label", "Run DQ");
  });

  it("clicking Run DQ fires handleStartProcessing with the file", () => {
    const handleStartProcessing = jest.fn();
    const file = buildFile({ status: "VALIDATED", upload_id: "upl-validated-1" });
    const state = buildState([file], handleStartProcessing);
    render(<FileExplorerTable state={state} />);
    fireEvent.click(screen.getByTestId("run-dq-button"));
    expect(handleStartProcessing).toHaveBeenCalledTimes(1);
    expect(handleStartProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ upload_id: "upl-validated-1" })
    );
  });

  it("renders Run DQ button for UPLOADED status (regression guard)", () => {
    const state = buildState([buildFile({ status: "UPLOADED" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByTestId("run-dq-button")).toBeInTheDocument();
  });

  it("does NOT render Run DQ button for DQ_FIXED status", () => {
    const state = buildState([buildFile({ status: "DQ_FIXED", dq_score: 95 })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.queryByTestId("run-dq-button")).not.toBeInTheDocument();
  });

  it("optimistic status — VALIDATED row shows DQ_DISPATCHED badge after click (unit: fires handler)", () => {
    // The actual optimistic transition lives in use-files-page.
    // This test confirms the button click reaches the handler so the
    // page-level optimistic update can proceed.
    const handleStartProcessing = jest.fn();
    const file = buildFile({ status: "VALIDATED" });
    const state = buildState([file], handleStartProcessing);
    render(<FileExplorerTable state={state} />);
    fireEvent.click(screen.getByTestId("run-dq-button"));
    expect(handleStartProcessing).toHaveBeenCalled();
  });
});
