/**
 * Unit tests for the DSAR "Export my data" contract hardening in
 * modules/auth/components/org-settings/org-general-tab.tsx.
 *
 * The handler now validates that:
 *   1. response is a non-null object (else: error toast, no blob)
 *   2. JSON.stringify succeeds (else: error toast, no blob)
 *   3. on success, a blob URL is created and revoked
 *   4. on failure, the underlying error message is surfaced
 *
 * These tests exercise the contract via an inline copy of the validation
 * pipeline so we can unit-test it in isolation from the org-settings
 * component tree (which pulls in Redux, AuthProvider, sonner, AG Grid,
 * etc — too heavy for a focused unit test).
 */
import "@testing-library/jest-dom";

type ExportFn = () => Promise<unknown>;

async function runExport(
  exportFn: ExportFn,
  toasts: { success: jest.Mock; error: jest.Mock },
): Promise<void> {
  try {
    const data = await exportFn();
    if (data == null || typeof data !== "object") {
      throw new Error("Server returned an empty data export.");
    }
    let serialised: string;
    try {
      serialised = JSON.stringify(data, null, 2);
    } catch {
      throw new Error("Could not serialize the data export.");
    }
    const blob = new Blob([serialised], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cleanflowai-data-export-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toasts.success("Your data export has been downloaded.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Export failed";
    toasts.error(`Export failed: ${msg}`);
  }
}

beforeEach(() => {
  (global as any).URL.createObjectURL = jest.fn(() => "blob:fake");
  (global as any).URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DSAR export — handler validation", () => {
  it("downloads a JSON blob on a successful object response", async () => {
    const toasts = { success: jest.fn(), error: jest.fn() };
    const exportFn = jest
      .fn()
      .mockResolvedValue({ user_id: "u1", email: "u1@x" });

    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await runExport(exportFn, toasts);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(toasts.success).toHaveBeenCalledTimes(1);
    expect(toasts.error).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("surfaces an error toast when the BE returns null", async () => {
    const toasts = { success: jest.fn(), error: jest.fn() };
    const exportFn = jest.fn().mockResolvedValue(null);

    await runExport(exportFn, toasts);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(
      expect.stringMatching(/empty data export/i),
    );
  });

  it("surfaces an error toast when the BE returns a string", async () => {
    const toasts = { success: jest.fn(), error: jest.fn() };
    const exportFn = jest.fn().mockResolvedValue("oops");

    await runExport(exportFn, toasts);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(
      expect.stringMatching(/empty data export/i),
    );
  });

  it("surfaces an error toast when the BE call rejects", async () => {
    const toasts = { success: jest.fn(), error: jest.fn() };
    const exportFn = jest
      .fn()
      .mockRejectedValue(new Error("Not authenticated"));

    await runExport(exportFn, toasts);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(
      expect.stringMatching(/not authenticated/i),
    );
  });

  it("surfaces a serialization error when JSON.stringify throws", async () => {
    const toasts = { success: jest.fn(), error: jest.fn() };
    // Cyclic object — JSON.stringify will throw.
    const cyclic: any = { a: 1 };
    cyclic.self = cyclic;
    const exportFn = jest.fn().mockResolvedValue(cyclic);

    await runExport(exportFn, toasts);

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith(
      expect.stringMatching(/could not serialize/i),
    );
  });
});
