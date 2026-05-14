/**
 * API contract tests for files module endpoints.
 * Asserts: URL paths, HTTP methods, request body shapes, auth header.
 *
 * Covers (CC7 / CC-Smoke-Fix-Harness-V2 scope):
 *   - GET  /uploads                   → getUploads
 *   - POST /uploads                   → initUpload (CC7 multipart init)
 *   - DELETE /uploads/{id}            → deleteUpload
 *   - POST /files/{id}/process        → startProcessing
 *   - GET  /files/{id}/status         → getFileStatus
 */

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: { API_BASE_URL: "https://api.contract.test" },
}));

jest.mock("@/modules/shared/auth-token-bridge", () => ({
  getValidTokenAsync: jest.fn().mockResolvedValue("refresh-tok"),
}));

import {
  getUploads,
  initUpload,
  startProcessing,
  deleteUpload,
  getFileStatus,
} from "@/modules/files/api/file-upload-api";

const BASE = "https://api.contract.test";

type Captured = {
  url: string;
  method: string;
  body: any;
  headers: Record<string, string>;
};

function capturingFetch(response: Response): [() => Captured | null, () => void] {
  let captured: Captured | null = null;
  const restore = () => {
    global.fetch = originalFetch;
  };
  global.fetch = jest.fn(async (url: any, opts: any) => {
    captured = {
      url,
      method: (opts?.method ?? "GET").toUpperCase(),
      body: opts?.body ? (() => { try { return JSON.parse(opts.body) } catch { return opts.body } })() : null,
      headers: opts?.headers ?? {},
    };
    return response;
  }) as any;
  return [() => captured, restore];
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

// ── GET /uploads ──────────────────────────────────────────────────────────────

describe("GET /uploads contract", () => {
  it("hits exactly GET https://api.contract.test/uploads", async () => {
    const [getCapture, restore] = capturingFetch(
      new Response(JSON.stringify({ items: [], count: 0 }), { status: 200 }),
    );

    await getUploads("tok-A");
    const c = getCapture();

    restore();
    expect(c!.url).toBe(`${BASE}/uploads`);
    expect(c!.method).toBe("GET");
  });

  it("sends Authorization: Bearer <token>", async () => {
    const [getCapture, restore] = capturingFetch(
      new Response(JSON.stringify({ items: [], count: 0 }), { status: 200 }),
    );

    await getUploads("secret-tok");
    const c = getCapture()!;
    restore();

    expect(c.headers["Authorization"]).toBe("Bearer secret-tok");
  });

  it("response items array is returned as-is", async () => {
    const items = [
      { upload_id: "u1", status: "DQ_FIXED" },
      { upload_id: "u2", status: "VALIDATED" },
    ];
    const [, restore] = capturingFetch(
      new Response(JSON.stringify({ items, count: 2 }), { status: 200 }),
    );

    const result = await getUploads("tok");
    restore();

    expect(result.items).toHaveLength(2);
    expect(result.items[0].upload_id).toBe("u1");
    expect(result.items[1].upload_id).toBe("u2");
  });
});

// ── POST /uploads ─────────────────────────────────────────────────────────────

describe("POST /uploads contract (CC7 init)", () => {
  it("hits exactly POST https://api.contract.test/uploads", async () => {
    const [getCapture, restore] = capturingFetch(
      new Response(
        JSON.stringify({ upload_id: "new-id", presigned_url: "https://s3.example.com/p" }),
        { status: 200 },
      ),
    );

    await initUpload("invoice.csv", "text/csv", "tok-B");
    const c = getCapture()!;
    restore();

    expect(c.url).toBe(`${BASE}/uploads`);
    expect(c.method).toBe("POST");
  });

  it("body contains filename, content_type, use_ai_processing=false by default", async () => {
    const [getCapture, restore] = capturingFetch(
      new Response(
        JSON.stringify({ upload_id: "new-id", presigned_url: "https://s3.example.com/p" }),
        { status: 200 },
      ),
    );

    await initUpload("sales.csv", "text/csv", "tok");
    const c = getCapture()!;
    restore();

    expect(c.body).toMatchObject({
      filename: "sales.csv",
      content_type: "text/csv",
      use_ai_processing: false,
    });
  });

  it("body sets use_ai_processing=true when useAI=true", async () => {
    const [getCapture, restore] = capturingFetch(
      new Response(
        JSON.stringify({ upload_id: "x", presigned_url: "p" }),
        { status: 200 },
      ),
    );

    await initUpload("data.csv", "text/csv", "tok", true);
    const c = getCapture()!;
    restore();

    expect(c.body.use_ai_processing).toBe(true);
  });
});

// ── DELETE /uploads/{id} ──────────────────────────────────────────────────────

describe("DELETE /uploads/{id} contract", () => {
  it("hits exactly DELETE https://api.contract.test/uploads/upl-xyz", async () => {
    global.fetch = jest.fn(async (url: any, opts: any) => {
      expect(url).toBe(`${BASE}/uploads/upl-xyz`);
      expect((opts?.method ?? "").toUpperCase()).toBe("DELETE");
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    await deleteUpload("upl-xyz", "tok-del");
  });

  it("accepted=false for sync 200 response", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    ) as any;

    const r = await deleteUpload("u1", "tok");
    expect(r.accepted).toBe(false);
    expect(r.operation_id).toBeUndefined();
  });

  it("accepted=true + operation_id from Location header on 202", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 202,
        headers: { Location: "/operations/op-99" },
      }),
    ) as any;

    const r = await deleteUpload("u2", "tok");
    expect(r.accepted).toBe(true);
    expect(r.operation_id).toBe("op-99");
    expect(r.operation_location).toBe("/operations/op-99");
  });
});

// ── POST /files/{id}/process ──────────────────────────────────────────────────

describe("POST /files/{id}/process contract (CC-Smoke-Fix-Harness-V2)", () => {
  it("hits exactly POST https://api.contract.test/files/upl-proc/process", async () => {
    global.fetch = jest.fn(async (url: any, opts: any) => {
      expect(url).toBe(`${BASE}/files/upl-proc/process`);
      expect((opts?.method ?? "").toUpperCase()).toBe("POST");
      return new Response(JSON.stringify({ accepted: true }), { status: 200 });
    }) as any;

    await startProcessing("upl-proc", "tok-proc");
  });

  it("body is empty (no Content-Type body) when no options", async () => {
    let capturedBody: any = "SENTINEL";

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      capturedBody = opts?.body ?? null;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    await startProcessing("upl-empty", "tok");
    expect(capturedBody).toBeNull();
  });

  it("body contains global_disabled_rules when specified", async () => {
    let capturedBody: any = null;

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      capturedBody = opts?.body ? JSON.parse(opts.body) : null;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    await startProcessing("upl-rules", "tok", {
      global_disabled_rules: ["R1", "R5"],
    });
    expect(capturedBody?.global_disabled_rules).toEqual(["R1", "R5"]);
  });

  it("body contains preset_id when specified", async () => {
    let capturedBody: any = null;

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      capturedBody = opts?.body ? JSON.parse(opts.body) : null;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    await startProcessing("upl-preset", "tok", { preset_id: "preset-123" });
    expect(capturedBody?.preset_id).toBe("preset-123");
  });
});

// ── GET /files/{id}/status ────────────────────────────────────────────────────

describe("GET /files/{id}/status contract", () => {
  it("hits exactly GET https://api.contract.test/files/upl-s1/status", async () => {
    global.fetch = jest.fn(async (url: any, opts: any) => {
      expect(url).toBe(`${BASE}/files/upl-s1/status`);
      expect((opts?.method ?? "GET").toUpperCase()).toBe("GET");
      return new Response(
        JSON.stringify({ upload_id: "upl-s1", status: "DQ_FIXED" }),
        { status: 200 },
      );
    }) as any;

    const result = await getFileStatus("upl-s1", "tok-stat");
    expect(result.upload_id).toBe("upl-s1");
  });
});
