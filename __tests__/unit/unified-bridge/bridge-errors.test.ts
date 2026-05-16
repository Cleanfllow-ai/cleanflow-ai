/**
 * Unit tests for the unified-bridge error classifier + helpers.
 * Covers: classifyIngestError (every kind), redactSecrets (depth + keys),
 *         withClientTimeout (races, success path), isValidHost / isValidPort.
 */
import {
  classifyIngestError,
  isValidHost,
  isValidPort,
  redactSecrets,
  withClientTimeout,
} from "@/modules/unified-bridge/lib/bridge-errors"

describe("classifyIngestError", () => {
  const cases: Array<[string, string]> = [
    ["HTTP authentication failed (401)", "auth"],
    ["Forbidden", "auth"],
    ["SFTP authentication failed", "auth"],
    ["TCP connection timed out", "timeout"],
    ["Cannot resolve hostname: foo.invalid", "dns"],
    ["Host evil.example.com resolves to blocked address 10.0.0.1", "blocked"],
    ["FTP remote path not accessible: /no/such", "not_found"],
    ["TCP transfer interrupted at 1024 bytes", "partial"],
    ["File exceeds free plan limit (10 MB).", "too_large"],
    ["File type .exe not supported. Use CSV/Excel.", "unsupported"],
    ["host and port are required", "validation"],
    ["Internal Server Error", "server"],
    ["ECONNREFUSED 127.0.0.1:21", "network"],
  ]
  for (const [msg, kind] of cases) {
    it(`classifies "${msg}" as ${kind}`, () => {
      const out = classifyIngestError(new Error(msg))
      expect(out.kind).toBe(kind)
      expect(out.message).toBeTruthy()
      expect(out.raw).toBe(msg)
    })
  }

  it("returns kind=unknown for unrecognised text", () => {
    const out = classifyIngestError(new Error("zarflorbing imploded"))
    expect(out.kind).toBe("unknown")
  })

  it("handles non-Error throwables", () => {
    expect(classifyIngestError("forbidden").kind).toBe("auth")
    expect(classifyIngestError(undefined).kind).toBe("unknown")
  })
})

describe("redactSecrets", () => {
  it("redacts top-level secret keys", () => {
    const input = { host: "x", password: "p", token: "t", username: "u" }
    const out = redactSecrets(input)
    expect(out.password).toBe("[redacted]")
    expect(out.token).toBe("[redacted]")
    expect(out.host).toBe("x")
    expect(out.username).toBe("u")
  })

  it("redacts nested secret keys in auth payloads", () => {
    const input = {
      host: "ftp.example.com",
      auth: { type: "ssh_key", private_key: "PEM", key_passphrase: "p" },
    }
    const out = redactSecrets(input) as any
    expect(out.auth.private_key).toBe("[redacted]")
    expect(out.auth.key_passphrase).toBe("[redacted]")
    expect(out.auth.type).toBe("ssh_key")
  })

  it("preserves falsy secret values (don't fabricate '[redacted]' for empty strings)", () => {
    const input = { password: "", token: undefined }
    const out = redactSecrets(input) as any
    expect(out.password).toBe("")
    expect(out.token).toBeUndefined()
  })

  it("handles arrays of objects", () => {
    const input = [{ secret_key: "s" }, { ok: 1 }]
    const out = redactSecrets(input) as any
    expect(out[0].secret_key).toBe("[redacted]")
    expect(out[1].ok).toBe(1)
  })
})

describe("withClientTimeout", () => {
  it("resolves with the promise value when it settles first", async () => {
    const p = Promise.resolve("done")
    await expect(withClientTimeout(p, 1000, "x")).resolves.toBe("done")
  })

  it("rejects with timeout error when promise hangs past the cap", async () => {
    const p = new Promise(() => {
      /* never resolves */
    })
    await expect(withClientTimeout(p as Promise<never>, 25, "FTP")).rejects.toThrow(
      /FTP timed out after/,
    )
  })

  it("propagates promise rejection unchanged", async () => {
    const p = Promise.reject(new Error("boom"))
    await expect(withClientTimeout(p, 1000, "x")).rejects.toThrow("boom")
  })
})

describe("isValidHost", () => {
  it.each([
    ["ftp.example.com", true],
    ["api.sub.example.io", true],
    ["192.168.1.1", true],
    ["10.0.0.5", true],
    ["[::1]", true],
    ["localhost", true],
    ["", false],
    ["   ", false],
    ["bad host", false],
    ["999.999.999.999", false],
    ["a..b", false],
    ["-leading.example.com", false],
  ])("isValidHost(%s) === %s", (input, expected) => {
    expect(isValidHost(input)).toBe(expected)
  })
})

describe("isValidPort", () => {
  it.each<[number | string, boolean]>([
    [1, true],
    [65535, true],
    ["21", true],
    [0, false],
    [65536, false],
    [-1, false],
    ["abc", false],
    ["", false],
    [1.5, false],
  ])("isValidPort(%s) === %s", (input, expected) => {
    expect(isValidPort(input)).toBe(expected)
  })
})
