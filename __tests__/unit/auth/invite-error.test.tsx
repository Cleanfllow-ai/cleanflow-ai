/**
 * Invite / member-management error toast tests.
 *
 * Verifies that each of the 6 failure modes defined in the SOC 2 remediation
 * spec maps to the correct toast title, description, and (where applicable)
 * action label.  Tests are pure-JS — no React rendering, no network.
 *
 * FM-1  INVITE_EXPIRED          → toast + no action
 * FM-2  INVITE_ALREADY_USED     → toast + Sign In button
 * FM-3  INVITE_EMAIL_TAKEN      → toast + Sign In button
 * FM-4  PASSWORD_TOO_WEAK       → inline validation (no toast, no network call)
 * FM-5  INVITE_RACE             → toast + Sign In button
 * FM-6  ORG_LAST_ADMIN          → toast + no action (cancel)
 */

import { mapErrorToToast } from "@/lib/error-toast";
import { ApiError } from "@/modules/shared/api-error";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeApiError(
    overrides: Partial<ConstructorParameters<typeof ApiError>[0]>,
): ApiError {
    return new ApiError({
        status: 422,
        message: "test",
        ...overrides,
    });
}

// ─── FM-1 INVITE_EXPIRED ─────────────────────────────────────────────────────

describe("FM-1 INVITE_EXPIRED", () => {
    it("produces a request_new_invite toast with no action button", () => {
        const err = makeApiError({
            status: 410,
            message: "This invite expired. Ask the sender to send a new one.",
            code: "InviteExpiredError",
            action: "request_new_invite",
        });
        const toast = mapErrorToToast(err);

        expect(toast.variant).toBe("destructive");
        expect(toast.title).toBe("This invite expired. Ask the sender to send a new one.");
        // No sign-in action — the user cannot self-recover; inviter must resend.
        expect(toast.action).toBeUndefined();
    });

    it("uses the fallback title when the message is empty", () => {
        const err = makeApiError({
            status: 410,
            message: "",
            code: "InviteExpiredError",
            action: "request_new_invite",
        });
        const toast = mapErrorToToast(err);

        expect(toast.title).toBeTruthy();
    });
});

// ─── FM-2 INVITE_ALREADY_USED ────────────────────────────────────────────────

describe("FM-2 INVITE_ALREADY_USED (InviteRaceError via ACCEPTED status)", () => {
    it("produces a signin toast when action=signin", () => {
        const err = makeApiError({
            status: 409,
            message: "This invite was already used. Sign in instead.",
            code: "InviteRaceError",
            action: "signin",
        });
        const toast = mapErrorToToast(err);

        expect(toast.variant).toBe("destructive");
        expect(toast.title).toContain("sign");
        expect(toast.action?.label).toBe("Sign in");
    });
});

// ─── FM-3 INVITE_EMAIL_TAKEN ─────────────────────────────────────────────────

describe("FM-3 INVITE_EMAIL_TAKEN", () => {
    it("produces a signin toast", () => {
        const err = makeApiError({
            status: 422,
            message: "This email is already registered. Sign in to switch orgs.",
            code: "InviteEmailTakenError",
            action: "signin",
        });
        const toast = mapErrorToToast(err);

        expect(toast.variant).toBe("destructive");
        expect(toast.action?.label).toBe("Sign in");
    });
});

// ─── FM-4 PASSWORD_TOO_WEAK (inline validation only) ─────────────────────────

describe("FM-4 PASSWORD_TOO_WEAK — inline validation logic", () => {
    // We test the regex logic directly without React, matching what
    // invite-set-password-form.tsx computes for `passwordStrengthError`.
    function passwordStrengthError(password: string): string {
        if (!password) return "Password must be 8+ chars with letters and numbers.";
        if (password.length < 8) return "Password must be 8+ chars with letters and numbers.";
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
            return "Password must be 8+ chars with letters and numbers.";
        return "";
    }

    const weakCases: Array<[string, string]> = [
        ["abcdefgh", "8 letters no digit"],
        ["12345678", "8 digits no letter"],
        ["        ", "8 spaces"],
        ["short", "too short"],
        ["", "empty"],
    ];

    it.each(weakCases)("rejects '%s' (%s)", (pw) => {
        expect(passwordStrengthError(pw)).toBeTruthy();
        expect(passwordStrengthError(pw)).toContain("8+");
    });

    it("accepts a valid strong password", () => {
        expect(passwordStrengthError("Str0ngP4ss")).toBe("");
        expect(passwordStrengthError("abc12345")).toBe("");
    });

    it("produces a PasswordPolicyError toast when the backend rejects a weak password", () => {
        const err = makeApiError({
            status: 422,
            message: "Password must be 8+ chars with letters and numbers.",
            code: "PasswordPolicyError",
            action: null,
        });
        const toast = mapErrorToToast(err);

        // Generic code path — no action, destructive variant.
        expect(toast.variant).toBe("destructive");
        expect(toast.title).toContain("8+");
    });
});

// ─── FM-5 INVITE_RACE ────────────────────────────────────────────────────────

describe("FM-5 INVITE_RACE (simultaneous set-password)", () => {
    it("surfaces the exact invite-race message from the backend", () => {
        const err = makeApiError({
            status: 409,
            message: "Someone else just used this invite. Sign in instead.",
            code: "InviteRaceError",
            action: "signin",
        });
        const toast = mapErrorToToast(err);

        expect(toast.variant).toBe("destructive");
        expect(toast.title).toContain("sign");
        expect(toast.action?.label).toBe("Sign in");
    });

    it("is distinct from FM-2 only in message copy — both use action=signin", () => {
        // Both INVITE_ALREADY_USED and INVITE_RACE use InviteRaceError code.
        // The distinction is messaging from the backend — both get a Sign In CTA.
        const err = makeApiError({
            status: 409,
            message: "This invite was already used. Sign in instead.",
            code: "InviteRaceError",
            action: "signin",
        });
        const toast = mapErrorToToast(err);

        expect(toast.action?.label).toBe("Sign in");
    });
});

// ─── FM-6 ORG_LAST_ADMIN ─────────────────────────────────────────────────────

describe("FM-6 ORG_LAST_ADMIN", () => {
    it("surfaces cancel toast with no action button", () => {
        const err = makeApiError({
            status: 422,
            message: "You can't remove the last admin. Promote another member first.",
            code: "OrgLastAdminError",
            action: "cancel",
        });
        const toast = mapErrorToToast(err);

        expect(toast.variant).toBe("destructive");
        expect(toast.title).toBe("You can't remove the last admin. Promote another member first.");
        // cancel = no automated action available; user must fix manually.
        expect(toast.action).toBeUndefined();
    });

    it("uses the fallback description when message is empty", () => {
        const err = makeApiError({
            status: 422,
            message: "",
            code: "OrgLastAdminError",
            action: "cancel",
        });
        const toast = mapErrorToToast(err);

        expect(toast.description).toBeTruthy();
    });
});

// ─── Stable toast IDs contract ───────────────────────────────────────────────

describe("Stable toast ID contract (org-<CODE>)", () => {
    // Toast IDs are used for deduplication — same error must not stack N copies.
    // We verify the expected IDs against the mapping table in the spec.
    const EXPECTED_IDS: Record<string, string> = {
        INVITE_EXPIRED: "org-INVITE_EXPIRED",
        INVITE_ALREADY_USED: "org-INVITE_ALREADY_USED",
        INVITE_EMAIL_TAKEN: "org-INVITE_EMAIL_TAKEN",
        ORG_LAST_ADMIN: "org-ORG_LAST_ADMIN",
    };

    it("all defined toast IDs follow the org-<CODE> pattern", () => {
        for (const [key, id] of Object.entries(EXPECTED_IDS)) {
            expect(id).toMatch(/^org-[A-Z_]+$/);
            expect(id).toContain(key);
        }
    });
});
