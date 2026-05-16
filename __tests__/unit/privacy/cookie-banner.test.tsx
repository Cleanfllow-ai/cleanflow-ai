/**
 * Unit tests for modules/privacy/components/cookie-banner.tsx
 *
 * Covers:
 *  - Renders nothing until hydration completes
 *  - Renders banner when no consent stored
 *  - Hidden after Accept (and choice persists with timestamp)
 *  - Hidden after Reject (and choice persists with timestamp)
 *  - Backwards-compat: bare-string "accepted" / "rejected" still hides banner
 *  - Expired (>12mo) consent re-prompts
 *  - Malformed JSON re-prompts
 *  - localStorage write failure does not throw
 *  - A11y: uses role="region" with aria-label (not modal dialog)
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import { CookieBanner } from "@/modules/privacy/components/cookie-banner";

const STORAGE_KEY = "cleanflowai.cookieConsent";

function clearStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

beforeEach(() => {
  clearStorage();
});

describe("CookieBanner", () => {
  it("renders the banner when no consent is stored", () => {
    render(<CookieBanner />);
    expect(screen.getByTestId("cookie-banner")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /accept all cookies/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reject non-essential cookies/i }),
    ).toBeInTheDocument();
  });

  it("hides the banner and persists choice when Accept is clicked", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    await user.click(
      screen.getByRole("button", { name: /accept all cookies/i }),
    );
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.value).toBe("accepted");
    expect(typeof parsed.ts).toBe("number");
  });

  it("hides the banner and persists choice when Reject is clicked", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);
    await user.click(
      screen.getByRole("button", { name: /reject non-essential/i }),
    );
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) as string,
    );
    expect(parsed.value).toBe("rejected");
  });

  it("does NOT re-appear on remount after Accept", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CookieBanner />);
    await user.click(
      screen.getByRole("button", { name: /accept all cookies/i }),
    );
    unmount();
    render(<CookieBanner />);
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
  });

  it("does NOT re-appear on remount after Reject", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CookieBanner />);
    await user.click(
      screen.getByRole("button", { name: /reject non-essential/i }),
    );
    unmount();
    render(<CookieBanner />);
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
  });

  it("treats legacy bare-string consent (accepted) as a valid decision", () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    render(<CookieBanner />);
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
  });

  it("treats legacy bare-string consent (rejected) as a valid decision", () => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    render(<CookieBanner />);
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
  });

  it("re-prompts when stored consent is older than 12 months", () => {
    const thirteenMonthsAgo = Date.now() - 400 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ value: "accepted", ts: thirteenMonthsAgo }),
    );
    render(<CookieBanner />);
    expect(screen.getByTestId("cookie-banner")).toBeInTheDocument();
  });

  it("does NOT re-prompt when stored consent is recent", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ value: "accepted", ts: Date.now() - 1000 }),
    );
    render(<CookieBanner />);
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
  });

  it("ignores malformed JSON in storage (re-prompts)", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");
    render(<CookieBanner />);
    expect(screen.getByTestId("cookie-banner")).toBeInTheDocument();
  });

  it("does not throw when localStorage.setItem fails", async () => {
    const user = userEvent.setup();
    const spy = jest
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceeded");
      });
    render(<CookieBanner />);
    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /accept all cookies/i }),
      );
    });
    // Banner still hides — in-memory state is the source of truth.
    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it("uses a non-modal landmark (role=region) with aria-label, not dialog", () => {
    render(<CookieBanner />);
    const banner = screen.getByTestId("cookie-banner");
    expect(banner.tagName.toLowerCase()).toBe("section");
    expect(banner.getAttribute("role")).toBe("region");
    // Banner itself is labelled "Cookie consent"
    expect(banner.getAttribute("aria-label")).toMatch(/^cookie consent$/i);
    // Should NOT be marked modal — banner is non-blocking.
    expect(banner.getAttribute("aria-modal")).toBeNull();
  });
});
