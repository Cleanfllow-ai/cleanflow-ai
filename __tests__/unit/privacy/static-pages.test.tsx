/**
 * Unit tests for the static privacy/terms/sub-processors pages.
 *
 * These pages render identically with or without auth, contain no fetches,
 * and must hit basic a11y bars: a single H1, main landmark, semantic
 * <time> for the last-updated date, and an accessible table with caption
 * + scoped headers on the sub-processors page.
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import SubprocessorsPage from "@/app/subprocessors/page";

describe("Privacy Notice page", () => {
  it("renders a single H1 and a main landmark", () => {
    render(<PrivacyPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: /privacy notice/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders at least one privacy@infiniqon.com contact link", () => {
    render(<PrivacyPage />);
    const links = screen.getAllByRole("link", {
      name: /privacy@infiniqon\.com/i,
    });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) =>
      expect(l).toHaveAttribute("href", "mailto:privacy@infiniqon.com"),
    );
  });

  it("renders the last-updated date as a machine-readable <time>", () => {
    const { container } = render(<PrivacyPage />);
    const time = container.querySelector("time");
    expect(time).toBeInTheDocument();
    expect(time?.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("links to the sub-processor inventory", () => {
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: /sub-processor list/i });
    expect(link.getAttribute("href")).toBe("/subprocessors");
  });

  it("renders without throwing when no auth context is provided", () => {
    // Privacy is a public page; rendering it must not depend on AuthProvider.
    expect(() => render(<PrivacyPage />)).not.toThrow();
  });
});

describe("Terms of Service page", () => {
  it("renders a single H1 and a main landmark", () => {
    render(<TermsPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: /terms of service/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("opens the SLO doc safely (rel=noopener) in a new tab", () => {
    render(<TermsPage />);
    const link = screen.getByRole("link", { name: /slo doc/i });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("renders the legal@infiniqon.com contact link", () => {
    render(<TermsPage />);
    const link = screen.getByRole("link", { name: /legal@infiniqon\.com/i });
    expect(link).toHaveAttribute("href", "mailto:legal@infiniqon.com");
  });

  it("renders without throwing when no auth context is provided", () => {
    expect(() => render(<TermsPage />)).not.toThrow();
  });
});

describe("Sub-processors page", () => {
  it("renders an accessible table with caption and scoped headers", () => {
    const { container } = render(<SubprocessorsPage />);
    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();

    // Caption is sr-only but must exist for screen-readers.
    const caption = container.querySelector("caption");
    expect(caption).toBeInTheDocument();
    expect(caption?.textContent).toMatch(/sub-processors/i);

    // Column headers must declare scope=col.
    const colHeaders = container.querySelectorAll("thead th");
    expect(colHeaders.length).toBeGreaterThan(0);
    colHeaders.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });

    // Provider name row headers must declare scope=row.
    const rowHeaders = container.querySelectorAll("tbody th");
    expect(rowHeaders.length).toBeGreaterThan(0);
    rowHeaders.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("row");
    });
  });

  it("includes AWS as a sub-processor (row header)", () => {
    render(<SubprocessorsPage />);
    expect(
      screen.getByRole("rowheader", { name: /amazon web services/i }),
    ).toBeInTheDocument();
  });

  it("includes Snowflake + QuickBooks + Zoho + Google + GitHub as sub-processors", () => {
    render(<SubprocessorsPage />);
    // Each row header is unique; the providers listed must all appear.
    expect(
      screen.getByRole("rowheader", { name: /snowflake/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /intuit \(quickbooks\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /zoho books/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /google \(drive\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /github/i }),
    ).toBeInTheDocument();
  });

  it("renders a single H1", () => {
    render(<SubprocessorsPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders without throwing when no auth context is provided", () => {
    expect(() => render(<SubprocessorsPage />)).not.toThrow();
  });
});
