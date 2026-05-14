/**
 * Unit tests for FileExplorerTable
 * Covers: row rendering, sort headers, filter toolbar, Run-DQ button (VALIDATED),
 * and status badge visibility.
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
    downloading: null,
    deleting: null,
    stopping: null,
    handleStopClick: noop,
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
    ...overrides,
  } as unknown as FilesPageState;
}

// ── Row rendering ─────────────────────────────────────────────────────────────

describe("FileExplorerTable — row rendering", () => {
  it("renders a filename in the table", () => {
    const state = buildState([buildFile({ original_filename: "report.csv" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByText("report.csv")).toBeInTheDocument();
  });

  it("renders one row per file", () => {
    const state = buildState([
      buildFile({ upload_id: "u1", original_filename: "a.csv" }),
      buildFile({ upload_id: "u2", original_filename: "b.csv" }),
      buildFile({ upload_id: "u3", original_filename: "c.csv" }),
    ]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByText("a.csv")).toBeInTheDocument();
    expect(screen.getByText("b.csv")).toBeInTheDocument();
    expect(screen.getByText("c.csv")).toBeInTheDocument();
  });

  it("shows loading spinner when loading=true and no files loaded yet", () => {
    const state = buildState([], { loading: true, tableEmpty: false });
    render(<FileExplorerTable state={state} />);
    // The table renders a Loader2 with animate-spin while loading
    expect(document.querySelector(".animate-spin")).not.toBeNull();
  });

  it("shows DQ score when status is DQ_FIXED", () => {
    const state = buildState([buildFile({ status: "DQ_FIXED", dq_score: 87.5 })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByText(/87\.5/)).toBeInTheDocument();
  });
});

// ── Sort headers ──────────────────────────────────────────────────────────────

describe("FileExplorerTable — sort header click", () => {
  it("calls handleSort when clicking a sortable column header", () => {
    const handleSort = jest.fn();
    const state = buildState([buildFile()], { handleSort });
    render(<FileExplorerTable state={state} />);
    // TableHead uses onClick directly — find by column label text
    const fileHeader = screen.getByText(/^File$/i);
    fireEvent.click(fileHeader);
    expect(handleSort).toHaveBeenCalledWith("name");
  });
});

// ── Filter toolbar ────────────────────────────────────────────────────────────

describe("FileExplorerTable — filter toolbar", () => {
  it("renders the search input", () => {
    const state = buildState([buildFile()]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("calls setSearchQuery on search input change", () => {
    const setSearchQuery = jest.fn();
    const state = buildState([buildFile()], { setSearchQuery });
    render(<FileExplorerTable state={state} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "hello" },
    });
    expect(setSearchQuery).toHaveBeenCalledWith("hello");
  });
});

// ── Run-DQ button ─────────────────────────────────────────────────────────────

describe("FileExplorerTable — Run-DQ button (VALIDATED / UPLOADED)", () => {
  it("shows Run DQ button for VALIDATED file", () => {
    const state = buildState([buildFile({ status: "VALIDATED" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByTestId("run-dq-button")).toBeInTheDocument();
  });

  it("shows Run DQ button for UPLOADED file", () => {
    const state = buildState([buildFile({ status: "UPLOADED" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.getByTestId("run-dq-button")).toBeInTheDocument();
  });

  it("clicking Run DQ fires handleStartProcessing", () => {
    const handleStartProcessing = jest.fn();
    const file = buildFile({ status: "VALIDATED", upload_id: "upl-validated" });
    const state = buildState([file], { handleStartProcessing });
    render(<FileExplorerTable state={state} />);
    fireEvent.click(screen.getByTestId("run-dq-button"));
    expect(handleStartProcessing).toHaveBeenCalledWith(
      expect.objectContaining({ upload_id: "upl-validated" }),
    );
  });

  it("does NOT show Run DQ button for DQ_FIXED file", () => {
    const state = buildState([buildFile({ status: "DQ_FIXED" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.queryByTestId("run-dq-button")).not.toBeInTheDocument();
  });

  it("does NOT show Run DQ button for DQ_RUNNING file", () => {
    const state = buildState([buildFile({ status: "DQ_RUNNING" })]);
    render(<FileExplorerTable state={state} />);
    expect(screen.queryByTestId("run-dq-button")).not.toBeInTheDocument();
  });
});
