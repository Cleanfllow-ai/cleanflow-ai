/**
 * Unit tests for file actions API layer:
 * getUploads, initUpload, startProcessing, deleteUpload
 *
 * Asserts HTTP method, URL path, body shape, and auth header for each action.
 */

jest.mock("@/shared/config/aws-config", () => ({
  AWS_CONFIG: { API_BASE_URL: "https://api.test.com" },
}));

// Stub token refresh to be a no-op
jest.mock("@/modules/shared/auth-token-bridge", () => ({
  getValidTokenAsync: jest.fn().mockResolvedValue("fresh-token"),
}));

import {
  getUploads,
  initUpload,
  startProcessing,
  deleteUpload,
} from "@/modules/files/api/file-upload-api";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function mockFetch(handler: (url: string, opts: RequestInit) => Promise<Response>) {
  global.fetch = jest.fn(handler) as any;
}

// ── GET /uploads ──────────────────────────────────────────────────────────────

describe("getUploads", () => {
  it("sends GET to /uploads with Bearer token", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedAuth = "";

    mockFetch(async (url, opts) => {
      capturedUrl = url;
      capturedMethod = (opts.method ?? "GET").toUpperCase();
      capturedAuth = (opts.headers as Record<string, string>)["Authorization"] ?? "";
      return new Response(JSON.stringify({ items: [], count: 0 }), { status: 200 });
    });

    await getUploads("tok-get-uploads");

    expect(capturedUrl).toBe("https://api.test.com/uploads");
    expect(capturedMethod).toBe("GET");
    expect(capturedAuth).toBe("Bearer tok-get-uploads");
  });

  it("returns items array from response", async () => {
    const item = { upload_id: "u1", status: "DQ_FIXED" };
    mockFetch(async () =>
      new Response(JSON.stringify({ items: [item], count: 1 }), { status: 200 }),
    );
    const result = await getUploads("tok");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].upload_id).toBe("u1");
  });

  it("returns empty items on permission denied (403)", async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ message: "permission denied" }), { status: 403 }),
    );
    const result = await getUploads("tok");
    expect(result.items).toEqual([]);
  });
});

// ── POST /uploads ─────────────────────────────────────────────────────────────

describe("initUpload", () => {
  it("sends POST to /uploads with filename + content_type in body", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedBody: any = null;

    mockFetch(async (url, opts) => {
      capturedUrl = url;
      capturedMethod = (opts.method ?? "").toUpperCase();
      capturedBody = JSON.parse((opts.body as string) ?? "{}");
      return new Response(
        JSON.stringify({ upload_id: "new-upload", presigned_url: "https://s3/presign" }),
        { status: 200 },
      );
    });

    await initUpload("data.csv", "text/csv", "tok-init");

    expect(capturedUrl).toBe("https://api.test.com/uploads");
    expect(capturedMethod).toBe("POST");
    expect(capturedBody.filename).toBe("data.csv");
    expect(capturedBody.content_type).toBe("text/csv");
  });

  it("sets use_ai_processing=true when useAI flag is passed", async () => {
    let capturedBody: any = null;

    mockFetch(async (_url, opts) => {
      capturedBody = JSON.parse((opts.body as string) ?? "{}");
      return new Response(
        JSON.stringify({ upload_id: "x", presigned_url: "https://s3/presign" }),
        { status: 200 },
      );
    });

    await initUpload("file.csv", "text/csv", "tok", true);
    expect(capturedBody.use_ai_processing).toBe(true);
  });

  it("sets use_ai_processing=false by default", async () => {
    let capturedBody: any = null;

    mockFetch(async (_url, opts) => {
      capturedBody = JSON.parse((opts.body as string) ?? "{}");
      return new Response(
        JSON.stringify({ upload_id: "x", presigned_url: "https://s3/presign" }),
        { status: 200 },
      );
    });

    await initUpload("file.csv", "text/csv", "tok");
    expect(capturedBody.use_ai_processing).toBe(false);
  });
});

// ── POST /files/{id}/process ──────────────────────────────────────────────────

describe("startProcessing", () => {
  it("sends POST to /files/{id}/process", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    mockFetch(async (url, opts) => {
      capturedUrl = url;
      capturedMethod = (opts.method ?? "").toUpperCase();
      return new Response(JSON.stringify({ accepted: true }), { status: 200 });
    });

    await startProcessing("upl-proc-1", "tok-proc");

    expect(capturedUrl).toBe("https://api.test.com/files/upl-proc-1/process");
    expect(capturedMethod).toBe("POST");
  });

  it("sends no body when no options passed", async () => {
    let capturedBody: string | null = null;

    mockFetch(async (_url, opts) => {
      capturedBody = (opts.body as string) ?? null;
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await startProcessing("upl-nobdy", "tok");
    expect(capturedBody).toBeNull();
  });

  it("includes selected_columns in body when provided", async () => {
    let capturedBody: any = null;

    mockFetch(async (_url, opts) => {
      capturedBody = opts.body ? JSON.parse(opts.body as string) : null;
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await startProcessing("upl-cols", "tok", { selected_columns: ["col_a", "col_b"] });
    expect(capturedBody?.selected_columns).toEqual(["col_a", "col_b"]);
  });

  it("sends auth header with Bearer token", async () => {
    let capturedAuth = "";

    mockFetch(async (_url, opts) => {
      capturedAuth = (opts.headers as Record<string, string>)["Authorization"] ?? "";
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await startProcessing("upl-auth", "my-token");
    expect(capturedAuth).toBe("Bearer my-token");
  });
});

// ── DELETE /uploads/{id} ──────────────────────────────────────────────────────

describe("deleteUpload", () => {
  it("sends DELETE to /uploads/{id}", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    global.fetch = jest.fn(async (url: any, opts: any) => {
      capturedUrl = url;
      capturedMethod = (opts?.method ?? "").toUpperCase();
      return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    }) as any;

    await deleteUpload("upl-del-1", "tok-del");

    expect(capturedUrl).toBe("https://api.test.com/uploads/upl-del-1");
    expect(capturedMethod).toBe("DELETE");
  });

  it("returns { accepted: false } on sync 200", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({}), { status: 200 }),
    ) as any;

    const result = await deleteUpload("upl-sync", "tok");
    expect(result.accepted).toBe(false);
  });

  it("returns { accepted: true, operation_id } on async 202", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 202,
        headers: { Location: "/operations/op-xyz" },
      }),
    ) as any;

    const result = await deleteUpload("upl-async", "tok");
    expect(result.accepted).toBe(true);
    expect(result.operation_id).toBe("op-xyz");
  });

  it("throws on 404", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
    ) as any;

    await expect(deleteUpload("upl-gone", "tok")).rejects.toBeDefined();
  });
});
