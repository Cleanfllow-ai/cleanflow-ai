/**
 * Bug 7 — FileDetailsDialog missing aria-describedby.
 *
 * Asserts:
 * 1. The DialogContent has aria-describedby pointing to an element that exists.
 * 2. No console.error fires with "Missing Description or aria-describedby".
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/modules/auth", () => ({
  useAuth: () => ({ idToken: "tok-test" }),
}));

jest.mock("@/modules/files/hooks/use-file-details", () => ({
  useFileDetails: () => ({
    activeTab: "details",
    setActiveTab: jest.fn(),
    previewData: null,
    previewLoading: false,
    previewError: null,
    previewErrorKind: null,
    loadPreview: jest.fn(),
    dqReport: null,
    dqReportLoading: false,
    dqReportError: null,
    downloading: null,
    downloadingMatrix: false,
    matrixDialogOpen: false,
    setMatrixDialogOpen: jest.fn(),
    matrixLimit: 100,
    setMatrixLimit: jest.fn(),
    matrixStart: null,
    setMatrixStart: jest.fn(),
    matrixEnd: null,
    setMatrixEnd: jest.fn(),
    matrixTotals: null,
    matrixLoadingTotals: false,
    issues: [],
    issuesTotal: 0,
    issuesNextOffset: null,
    issuesLoading: false,
    availableViolations: [],
    selectedViolations: [],
    setSelectedViolations: jest.fn(),
    currentFile: null,
    versions: [],
    versionsLoading: false,
    selectedVersion: null,
    selectedVersionUploadId: null,
    setSelectedVersionUploadId: jest.fn(),
    versionInfo: null,
    fetchIssues: jest.fn(),
    handleDownloadDqReport: jest.fn(),
    openMatrixDialog: jest.fn(),
    handleDownloadDqMatrix: jest.fn(),
  }),
}));

// Stub heavy child tabs
jest.mock("@/modules/files/components/file-details/file-overview-tab", () => ({
  FileOverviewTab: () => <div data-testid="file-overview-tab" />,
}));
jest.mock("@/modules/files/components/file-details/file-dq-report-tab", () => ({
  FileDqReportTab: () => null,
}));
jest.mock("@/modules/files/components/file-details/file-preview-tab", () => ({
  FilePreviewTab: () => null,
}));
jest.mock("@/modules/files/components/file-details/file-lineage-tab", () => ({
  FileLineageTab: () => null,
}));
jest.mock("@/modules/files/components/file-details/file-metadata-tab", () => ({
  FileMetadataTab: () => null,
}));
jest.mock("@/modules/files/components/file-details/file-audit-log-tab", () => ({
  FileAuditLogTab: () => null,
}));
jest.mock("@/modules/files/components/file-version-history", () => ({
  FileVersionHistory: () => null,
}));
jest.mock("@/modules/files/components/dq-matrix-dialog", () => ({
  DqMatrixDialog: () => null,
}));
jest.mock("@/modules/files/components/row-wise-issues", () => ({
  RowWiseIssues: () => null,
}));
jest.mock("@/modules/files/components/optimizing-badge", () => ({
  OptimizingBadge: () => null,
}));

import { FileDetailsDialog } from "@/modules/files/components/file-details-dialog";
import type { FileStatusResponse } from "@/modules/files";

const SAMPLE_FILE: FileStatusResponse = {
  upload_id: "upl-aria-1",
  status: "DQ_FIXED",
  original_filename: "aria-test.csv",
  filename: "aria-test.csv",
  rows_in: 50,
  rows_quarantined: 0,
  dq_score: 98,
  uploaded_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("FileDetailsDialog — aria-describedby accessibility", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders DialogContent with aria-describedby attribute", () => {
    render(
      <FileDetailsDialog
        file={SAMPLE_FILE}
        open={true}
        onOpenChange={jest.fn()}
      />
    );
    // The dialog role element should have aria-describedby
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-describedby");
  });

  it("aria-describedby points to an existing element", () => {
    render(
      <FileDetailsDialog
        file={SAMPLE_FILE}
        open={true}
        onOpenChange={jest.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    const describedById = dialog.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const descEl = document.getElementById(describedById!);
    expect(descEl).not.toBeNull();
  });

  it("does not log aria-describedby console error when dialog is open", () => {
    render(
      <FileDetailsDialog
        file={SAMPLE_FILE}
        open={true}
        onOpenChange={jest.fn()}
      />
    );
    const ariaErrors = consoleErrorSpy.mock.calls.filter((args) =>
      String(args[0]).toLowerCase().includes("aria-describedby")
    );
    expect(ariaErrors).toHaveLength(0);
  });
});
