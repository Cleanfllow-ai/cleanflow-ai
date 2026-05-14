/**
 * Unit tests for PipelineStepper (pipeline-stepper.tsx)
 * Covers: 3-dot stepper renders for each key status, label text, active/done/failed
 * dot states.
 *
 * PipelineStepper is the "processing modal" stepper — it shows a 3-step
 * upload → process → complete indicator inline in the files table.
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PipelineStepper } from "@/modules/files/components/pipeline-stepper";

// ── Renders for all key statuses ──────────────────────────────────────────────

describe("PipelineStepper — label rendering", () => {
  it('shows "Complete" label for DQ_FIXED', () => {
    render(<PipelineStepper status="DQ_FIXED" />);
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it('shows "Complete" label for COMPLETED', () => {
    render(<PipelineStepper status="COMPLETED" />);
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it('shows "Processing..." label for DQ_RUNNING', () => {
    render(<PipelineStepper status="DQ_RUNNING" />);
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it('shows "Queued" label for DQ_DISPATCHED', () => {
    render(<PipelineStepper status="DQ_DISPATCHED" />);
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it('shows "Queued" label for QUEUED', () => {
    render(<PipelineStepper status="QUEUED" />);
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it('shows "Uploaded" label for VALIDATED', () => {
    render(<PipelineStepper status="VALIDATED" />);
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it('shows "Uploaded" label for UPLOADED', () => {
    render(<PipelineStepper status="UPLOADED" />);
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it('shows "Uploading..." label for UPLOADING', () => {
    render(<PipelineStepper status="UPLOADING" />);
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
  });

  it('shows "Failed" label for DQ_FAILED', () => {
    render(<PipelineStepper status="DQ_FAILED" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it('shows "Failed" label for UPLOAD_FAILED', () => {
    render(<PipelineStepper status="UPLOAD_FAILED" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it('shows "Rejected" label for REJECTED', () => {
    render(<PipelineStepper status="REJECTED" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("renders unknown status as label text (uppercase)", () => {
    render(<PipelineStepper status="some_unknown" />);
    expect(screen.getByText("SOME_UNKNOWN")).toBeInTheDocument();
  });
});

// ── Dot count ─────────────────────────────────────────────────────────────────

describe("PipelineStepper — renders 3 dots", () => {
  it("always renders exactly 3 step dots", () => {
    const { container } = render(<PipelineStepper status="DQ_FIXED" />);
    // The dots are div elements with rounded-full class + w-[7px]
    const dots = container.querySelectorAll('[class*="rounded-full"][class*="h-[7px]"]');
    expect(dots.length).toBe(3);
  });

  it("all dots are emerald for DQ_FIXED (done state)", () => {
    const { container } = render(<PipelineStepper status="DQ_FIXED" />);
    const dots = container.querySelectorAll('[class*="bg-emerald-500"][class*="h-[7px]"]');
    expect(dots.length).toBe(3);
  });

  it("first dot is emerald and second is animate-pulse for DQ_RUNNING", () => {
    const { container } = render(<PipelineStepper status="DQ_RUNNING" />);
    const emeraldDots = container.querySelectorAll('[class*="bg-emerald-500"][class*="h-[7px]"]');
    const activeDots = container.querySelectorAll('[class*="animate-pulse"][class*="h-[7px]"]');
    expect(emeraldDots.length).toBeGreaterThanOrEqual(1); // upload dot = done
    expect(activeDots.length).toBe(1); // process dot = active
  });

  it("first dot is emerald and second is destructive for DQ_FAILED", () => {
    const { container } = render(<PipelineStepper status="DQ_FAILED" />);
    const emeraldDots = container.querySelectorAll('[class*="bg-emerald-500"][class*="h-[7px]"]');
    const failedDots = container.querySelectorAll('[class*="bg-destructive"][class*="h-[7px]"]');
    expect(emeraldDots.length).toBe(1); // upload = done
    expect(failedDots.length).toBe(1); // process = failed
  });
});

// ── Case-insensitivity ────────────────────────────────────────────────────────

describe("PipelineStepper — case insensitivity", () => {
  it("handles lowercase status string", () => {
    render(<PipelineStepper status="dq_fixed" />);
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("handles mixed-case status string", () => {
    render(<PipelineStepper status="Dq_Running" />);
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });
});
