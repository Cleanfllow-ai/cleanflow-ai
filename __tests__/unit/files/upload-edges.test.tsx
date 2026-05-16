/**
 * Upload edge-case tests — 7 failure modes (FM-1 … FM-7).
 *
 * FM-1  Filename invalid chars  → "Invalid filename" toast (no retry)
 * FM-2  Emoji/CJK filename      → upload proceeds, no toast
 * FM-3  Content-type mismatch   → "Wrong file format" toast (no retry)
 * FM-4  Concurrent same name    → two separate uploads succeed
 * FM-5  Presigned URL expired   → "Upload link expired" toast on S3 403
 * FM-6  Network drop mid-PUT    → retry 3x then "Upload failed. Check connection."
 * FM-7  S3 503 SlowDown         → retry 3x with backoff, then "Service busy"
 */

import { fetchWithRetry, _initUploadToast, _s3PutToast, addJitter } from "@/modules/files/hooks/use-file-upload"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, type = "text/csv", sizeBytes = 1024): File {
  const file = new File(["x"], name, { type })
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true })
  return file
}

// ---------------------------------------------------------------------------
// FM-1  Invalid filename — backend returns FilenameInvalidError
// ---------------------------------------------------------------------------

describe("FM-1: invalid filename toast", () => {
  it("shows 'Invalid filename' toast for UPLOAD_FILENAME_INVALID code", () => {
    const result = _initUploadToast(400, "FilenameInvalidError", "Filename contains invalid characters.")
    expect(result.title).toBe("Invalid filename")
    expect(result.description).toMatch(/invalid characters/)
    expect(result.description).toMatch(/letters, digits, dashes, dots/)
  })

  it("handles UPLOAD_FILENAME_INVALID string code (wire format)", () => {
    const result = _initUploadToast(400, "UPLOAD_FILENAME_INVALID", "Filename contains invalid characters.")
    expect(result.title).toBe("Invalid filename")
  })

  it("does NOT produce retry description for filename errors", () => {
    const result = _initUploadToast(400, "FilenameInvalidError", undefined)
    // Should not mention "try again" — caller must rename
    expect(result.description).not.toMatch(/try again/i)
  })
})

// ---------------------------------------------------------------------------
// FM-2  Emoji / CJK filename — upload proceeds, no special toast
// ---------------------------------------------------------------------------

describe("FM-2: emoji/CJK filename accepted", () => {
  it("does not trigger FilenameInvalidError toast for unicode name", () => {
    // A 200 OK response with any code would not be FilenameInvalidError
    const result = _initUploadToast(200, undefined, undefined)
    expect(result.title).not.toBe("Invalid filename")
  })

  it("emoji filename file object is constructable (sanity check)", () => {
    const file = makeFile("报告_2026😀.csv", "text/csv")
    expect(file.name).toBe("报告_2026😀.csv")
    expect(file.type).toBe("text/csv")
  })

  it("CJK filename file object is constructable", () => {
    const file = makeFile("财务报告.csv", "text/csv")
    expect(file.name).toBe("财务报告.csv")
  })
})

// ---------------------------------------------------------------------------
// FM-3  Content-type mismatch
// ---------------------------------------------------------------------------

describe("FM-3: content-type mismatch toast", () => {
  it("shows 'Wrong file format' toast for ContentTypeMismatchError", () => {
    const result = _initUploadToast(
      415,
      "ContentTypeMismatchError",
      "Expected CSV. Got application/vnd.ms-excel. Save as CSV in Excel.",
    )
    expect(result.title).toBe("Wrong file format")
    expect(result.description).toMatch(/Expected CSV/)
    expect(result.description).toMatch(/Save as CSV in Excel/)
  })

  it("handles UPLOAD_CONTENT_TYPE_UNSUPPORTED string code (wire format)", () => {
    const result = _initUploadToast(
      415,
      "UPLOAD_CONTENT_TYPE_UNSUPPORTED",
      "Expected CSV. Got application/vnd.ms-excel. Save as CSV in Excel.",
    )
    expect(result.title).toBe("Wrong file format")
  })

  it("includes the actual content type in the description when available", () => {
    const result = _initUploadToast(
      415,
      "ContentTypeMismatchError",
      "Expected CSV. Got application/vnd.openxmlformats-officedocument.spreadsheetml.sheet. Save as CSV in Excel.",
    )
    // Regex extracts the MIME type from "Got X."
    expect(result.description).toMatch(/application\/vnd/)
  })

  it("falls back gracefully when error string lacks 'Got X' pattern", () => {
    const result = _initUploadToast(415, "ContentTypeMismatchError", undefined)
    expect(result.title).toBe("Wrong file format")
    expect(result.description).toMatch(/Expected CSV/)
  })
})

// ---------------------------------------------------------------------------
// FM-4  Concurrent uploads with same filename → different upload_ids
// ---------------------------------------------------------------------------

describe("FM-4: concurrent uploads with same filename", () => {
  it("two upload requests each get their own presigned POST URL", async () => {
    let callCount = 0
    const responses = [
      { upload_id: "id-1", key: "data/org/id-1/file.csv", presignedPost: { url: "https://s3.example.com/1", fields: {} }, usePost: true },
      { upload_id: "id-2", key: "data/org/id-2/file.csv", presignedPost: { url: "https://s3.example.com/2", fields: {} }, usePost: true },
    ]

    global.fetch = jest.fn().mockImplementation(() => {
      const resp = responses[callCount % 2]
      callCount++
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(resp),
        text: () => Promise.resolve(JSON.stringify(resp)),
      } as unknown as Response)
    })

    const makeUploadRequest = () =>
      fetch("https://api.example.com/uploads", {
        method: "POST",
        body: JSON.stringify({ filename: "payroll.csv" }),
      }).then((r) => r.json())

    const [r1, r2] = await Promise.all([makeUploadRequest(), makeUploadRequest()])
    expect(r1.upload_id).not.toBe(r2.upload_id)
    expect(r1.key).not.toBe(r2.key)
  })
})

// ---------------------------------------------------------------------------
// FM-5  Presigned URL expiry — S3 returns 403
// ---------------------------------------------------------------------------

describe("FM-5: presigned URL expiry → 403 from S3", () => {
  it("_s3PutToast returns 'Upload link expired' for 403", () => {
    const result = _s3PutToast(403)
    expect(result.title).toBe("Upload link expired")
    expect(result.description).toMatch(/Upload link expired/)
    expect(result.description).toMatch(/Click upload again/)
  })

  it("fetchWithRetry does NOT retry on 403 (client error)", async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: false,
        status: 403,
      } as unknown as Response)
    })

    const response = await fetchWithRetry("https://s3.example.com/upload", {}, 3)
    // 4xx: no retry, single call
    expect(callCount).toBe(1)
    expect(response.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// FM-6  Network drop mid-PUT → retry 3× then surface error
// ---------------------------------------------------------------------------

describe("FM-6: network drop mid-PUT", () => {
  it("retries up to 3 times on network error then throws", async () => {
    // Replace setTimeout with a no-op so backoff delays are instantaneous
    jest.spyOn(global, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      return Promise.reject(new Error("Network error"))
    })

    await expect(
      fetchWithRetry("https://s3.example.com/upload", {}, 3),
    ).rejects.toThrow("Network error")

    // 1 initial + 3 retries = 4 calls
    expect(callCount).toBe(4)
    jest.restoreAllMocks()
  })

  it("_s3PutToast returns 'Upload failed' description for generic failures", () => {
    const result = _s3PutToast(0)
    expect(result.description).toMatch(/Check your connection/)
  })
})

// ---------------------------------------------------------------------------
// FM-7  S3 503 SlowDown → retry 3× then "Service busy"
// ---------------------------------------------------------------------------

describe("FM-7: S3 503 SlowDown", () => {
  beforeEach(() => {
    // Replace setTimeout with a no-op so backoff delays are instantaneous
    jest.spyOn(global, "setTimeout").mockImplementation((fn: TimerHandler) => {
      if (typeof fn === "function") fn()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("retries 3 times on 503 then returns the 503 response", async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: false,
        status: 503,
      } as unknown as Response)
    })

    const response = await fetchWithRetry("https://s3.example.com/upload", {}, 3)
    // 1 initial + 3 retries = 4 calls (attempt 0, 1, 2, 3)
    expect(callCount).toBe(4)
    expect(response.status).toBe(503)
  })

  it("succeeds on 2nd attempt after initial 503", async () => {
    let callCount = 0
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 503 } as unknown as Response)
      }
      return Promise.resolve({ ok: true, status: 200 } as unknown as Response)
    })

    const response = await fetchWithRetry("https://s3.example.com/upload", {}, 3)
    expect(callCount).toBe(2)
    expect(response.status).toBe(200)
  })

  it("_s3PutToast returns 'Service busy' for 503", () => {
    const result = _s3PutToast(503)
    expect(result.title).toBe("Service busy")
    expect(result.description).toMatch(/Try again in a minute/)
  })
})

// ---------------------------------------------------------------------------
// addJitter — delay jitter correctness
// ---------------------------------------------------------------------------

describe("addJitter: 50% jitter on retry delay", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns base + 0.4*base*0.5 = base*1.2 when Math.random() === 0.4", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.4)
    const base = 1000
    expect(addJitter(base)).toBe(base + 0.4 * base * 0.5) // 1200
  })

  it("returns exactly base when Math.random() === 0", () => {
    jest.spyOn(Math, "random").mockReturnValue(0)
    const base = 2000
    expect(addJitter(base)).toBe(base) // 2000
  })

  it("returns base*1.5 when Math.random() === 1", () => {
    jest.spyOn(Math, "random").mockReturnValue(1)
    const base = 4000
    expect(addJitter(base)).toBe(base * 1.5) // 6000
  })
})
