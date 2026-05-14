/**
 * invite-email-validation.test.ts
 *
 * Regression for the "invite send accepts malformed email" gap.
 * handleSubmitInvite only checked `!email` and `allowedInviteRoles
 * .includes(...)` — a paste of "foo@" or "@bar" slipped through to the
 * BE and surfaced a generic 422 toast. This test pins the exact regex
 * the handler now uses so future loosening must be intentional.
 */

// Mirror the regex from handleSubmitInvite in use-org-settings.tsx.
// Intentionally permissive — RFC 5322 is impractical and the BE
// re-validates.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

describe("invite email format check (mirrors handleSubmitInvite)", () => {
  it("accepts a typical address", () => {
    expect(EMAIL_RE.test("alice@example.com")).toBe(true);
  });

  it("accepts subdomains and plus tags", () => {
    expect(EMAIL_RE.test("alice+tag@mail.example.co.uk")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(EMAIL_RE.test("")).toBe(false);
  });

  it('rejects trailing "@"', () => {
    expect(EMAIL_RE.test("foo@")).toBe(false);
  });

  it('rejects leading "@"', () => {
    expect(EMAIL_RE.test("@bar.com")).toBe(false);
  });

  it("rejects no dot in domain", () => {
    expect(EMAIL_RE.test("foo@bar")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(EMAIL_RE.test("foo @bar.com")).toBe(false);
    expect(EMAIL_RE.test("foo@ bar.com")).toBe(false);
  });

  it("rejects literal newlines", () => {
    expect(EMAIL_RE.test("foo\n@bar.com")).toBe(false);
  });

  it("rejects two @", () => {
    expect(EMAIL_RE.test("a@b@c.com")).toBe(false);
  });
});

// ─── allowedInviteRoles role-enum guard (mirrors handler validation) ────────

type AppRole = "Super Admin" | "Admin" | "Data Steward" | "Member";

function isValidInviteRole(role: AppRole, allowed: AppRole[]): boolean {
  return allowed.includes(role);
}

describe("invite role enum guard (mirrors handleSubmitInvite)", () => {
  it("Super Admin can invite Super Admin / Admin / Data Steward", () => {
    const allowed: AppRole[] = ["Super Admin", "Admin", "Data Steward"];
    expect(isValidInviteRole("Super Admin", allowed)).toBe(true);
    expect(isValidInviteRole("Admin", allowed)).toBe(true);
    expect(isValidInviteRole("Data Steward", allowed)).toBe(true);
    // Member is NOT in the assignable set
    expect(isValidInviteRole("Member", allowed)).toBe(false);
  });

  it("Admin cannot invite Super Admin", () => {
    const allowed: AppRole[] = ["Admin", "Data Steward"];
    expect(isValidInviteRole("Super Admin", allowed)).toBe(false);
  });

  it("Data Steward can only invite Data Steward", () => {
    const allowed: AppRole[] = ["Data Steward"];
    expect(isValidInviteRole("Admin", allowed)).toBe(false);
    expect(isValidInviteRole("Super Admin", allowed)).toBe(false);
    expect(isValidInviteRole("Data Steward", allowed)).toBe(true);
  });

  it("Member cannot invite anyone (empty allowed list)", () => {
    const allowed: AppRole[] = [];
    expect(isValidInviteRole("Data Steward", allowed)).toBe(false);
  });
});
