/**
 * Phase 1 - auth-session.ts pure function tests.
 * Target: modules/auth/hooks/auth-session.ts
 *
 * Covers: parseJWT, buildUserFromPayload, loadStoredTokens, saveStoredTokens, clearStoredTokens.
 * No network, no Cognito SDK, no React. Pure functions only.
 */
import {
  parseJWT,
  buildUserFromPayload,
  loadStoredTokens,
  saveStoredTokens,
  clearStoredTokens,
  type StoredTokens,
} from "@/modules/auth/hooks/auth-session";

// Helper: build a valid-looking JWT (header.payload.signature) from a payload object
function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const header = b64url({ alg: "RS256", typ: "JWT" });
  const body = b64url(payload);
  return `${header}.${body}.signature-goes-here`;
}

describe("parseJWT", () => {
  it("decodes the payload of a well-formed JWT", () => {
    const token = makeJwt({ sub: "user-123", email: "alice@example.com" });
    const result = parseJWT(token);
    expect(result).toEqual({ sub: "user-123", email: "alice@example.com" });
  });

  it("returns null for a malformed token", () => {
    const result = parseJWT("not-a-jwt");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", () => {
    const result = parseJWT("");
    expect(result).toBeNull();
  });

  it("handles base64url characters (-, _) in the payload segment", () => {
    const token = makeJwt({ data: "a+b/c=" });
    const result = parseJWT(token);
    expect(result).toEqual({ data: "a+b/c=" });
  });

  it("decodes UTF-8 multi-byte characters (non-ASCII)", () => {
    const token = makeJwt({ name: "山田太郎" });
    const result = parseJWT(token);
    expect(result).toEqual({ name: "山田太郎" });
  });
});

describe("buildUserFromPayload", () => {
  it("uses payload.name when present", () => {
    const user = buildUserFromPayload({
      email: "alice@example.com",
      sub: "user-123",
      "cognito:username": "alice",
      name: "Alice Smith",
    });
    expect(user).toEqual({
      email: "alice@example.com",
      sub: "user-123",
      username: "alice",
      name: "Alice Smith",
    });
  });

  it("falls back to email local-part when name is missing", () => {
    const user = buildUserFromPayload({
      email: "bob@example.com",
      sub: "user-456",
      "cognito:username": "bob",
    });
    expect(user.name).toBe("bob");
  });

  it("extracts cognito:username into username", () => {
    const user = buildUserFromPayload({
      email: "carol@example.com",
      sub: "user-789",
      "cognito:username": "carol-username",
    });
    expect(user.username).toBe("carol-username");
  });
});

describe("loadStoredTokens", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredTokens()).toBeNull();
  });

  it("returns null when stored JSON is malformed", () => {
    localStorage.setItem("authTokens", "{not-json");
    expect(loadStoredTokens()).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    localStorage.setItem(
      "authTokens",
      JSON.stringify({ idToken: "id-only" })
    );
    expect(loadStoredTokens()).toBeNull();
  });

  it("returns tokens with null refreshToken when not provided", () => {
    localStorage.setItem(
      "authTokens",
      JSON.stringify({ idToken: "id-t", accessToken: "access-t" })
    );
    const got = loadStoredTokens();
    expect(got).toEqual({
      idToken: "id-t",
      accessToken: "access-t",
      refreshToken: null,
    });
  });
});

describe("saveStoredTokens + clearStoredTokens round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists all three tokens and reads them back identically", () => {
    const tokens: StoredTokens = {
      idToken: "id-xyz",
      accessToken: "access-xyz",
      refreshToken: "refresh-xyz",
    };
    saveStoredTokens(tokens);
    expect(loadStoredTokens()).toEqual(tokens);
  });

  it("persists null refreshToken as null", () => {
    const tokens: StoredTokens = {
      idToken: "id-xyz",
      accessToken: "access-xyz",
      refreshToken: null,
    };
    saveStoredTokens(tokens);
    expect(loadStoredTokens()).toEqual(tokens);
  });

  it("clearStoredTokens removes the authTokens key from localStorage", () => {
    saveStoredTokens({
      idToken: "id",
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(localStorage.getItem("authTokens")).not.toBeNull();

    clearStoredTokens();
    expect(localStorage.getItem("authTokens")).toBeNull();
    expect(loadStoredTokens()).toBeNull();
  });
});
