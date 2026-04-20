/**
 * Phase 2 - dq-columns.ts unit tests.
 * Target: modules/files/utils/dq-columns.ts
 *
 * Covers: isDQColumn, filterDQColumns.
 *
 * These pure helpers decide which internal Data Quality columns to hide
 * when exporting files to external ERPs (QuickBooks, Zoho Books, etc.).
 * They must never let a DQ column leak into an export, and must never
 * accidentally hide a real business column with a similar name.
 */
import { isDQColumn, filterDQColumns } from "@/modules/files/utils/dq-columns";

describe("isDQColumn — standalone DQ columns", () => {
  const standalone = [
    "dq_status",
    "dq_violations",
    "dq_cell_status",
    "dq_summary",
    "dq_score",
    "fixes_applied",
    "violations_count",
  ];

  it.each(standalone)("recognizes %s as a DQ column", (col) => {
    expect(isDQColumn(col, [col])).toBe(true);
  });

  it.each(standalone.map((c) => c.toUpperCase()))(
    "recognizes %s (uppercase) as a DQ column (case-insensitive)",
    (col) => {
      expect(isDQColumn(col, [col])).toBe(true);
    }
  );
});

describe("isDQColumn — dq_ and __dq prefixes", () => {
  it("flags dq_-prefixed columns", () => {
    expect(isDQColumn("dq_rule_id", ["dq_rule_id"])).toBe(true);
  });

  it("flags __dq-prefixed columns", () => {
    expect(isDQColumn("__dq_internal", ["__dq_internal"])).toBe(true);
  });

  it("is case-insensitive on prefixes", () => {
    expect(isDQColumn("DQ_RULE_ID", ["DQ_RULE_ID"])).toBe(true);
    expect(isDQColumn("__DQ_DATA", ["__DQ_DATA"])).toBe(true);
  });
});

describe("isDQColumn — suffix-based, requires base column", () => {
  it("flags email_dq_status when email exists in the column list", () => {
    expect(
      isDQColumn("email_dq_status", ["email", "name", "email_dq_status"])
    ).toBe(true);
  });

  it("does NOT flag email_dq_status when email does not exist", () => {
    expect(
      isDQColumn("email_dq_status", ["name", "email_dq_status"])
    ).toBe(false);
  });

  it("flags all defined suffixes when base column exists", () => {
    const suffixes = [
      "_dq_status",
      "_dq_fixed",
      "_dq_quarantined",
      "_dq_clean",
      "_dq_violations",
    ];
    for (const s of suffixes) {
      const col = `email${s}`;
      expect(isDQColumn(col, ["email", col])).toBe(true);
    }
  });

  it("handles mixed case in base column lookup", () => {
    expect(
      isDQColumn("Email_dq_status", ["EMAIL", "Email_dq_status"])
    ).toBe(true);
  });
});

describe("isDQColumn — false positives guard", () => {
  it("does NOT flag a regular business column", () => {
    expect(isDQColumn("customer_name", ["customer_name", "email"])).toBe(false);
  });

  it("does NOT flag a column that happens to contain dq in the middle", () => {
    // "addq_tag" contains "dq" but does not start with dq_ or __dq
    expect(isDQColumn("addq_tag", ["addq_tag"])).toBe(false);
  });

  it("does NOT flag an empty column name", () => {
    expect(isDQColumn("", [""])).toBe(false);
  });
});

describe("filterDQColumns", () => {
  it("returns an empty array when given an empty array", () => {
    expect(filterDQColumns([])).toEqual([]);
  });

  it("strips standalone DQ columns", () => {
    const input = ["name", "email", "dq_status", "dq_score", "age"];
    expect(filterDQColumns(input)).toEqual(["name", "email", "age"]);
  });

  it("strips suffix-based DQ columns when their base exists", () => {
    const input = ["email", "email_dq_status", "name", "name_dq_fixed"];
    expect(filterDQColumns(input)).toEqual(["email", "name"]);
  });

  it("keeps suffix-shaped columns whose base is missing", () => {
    // email_dq_status without email should NOT be filtered out
    const input = ["email_dq_status", "name"];
    expect(filterDQColumns(input)).toEqual(["email_dq_status", "name"]);
  });

  it("preserves column order of the kept columns", () => {
    const input = [
      "customer_id",
      "dq_status",
      "customer_name",
      "customer_name_dq_fixed",
      "email",
    ];
    expect(filterDQColumns(input)).toEqual([
      "customer_id",
      "customer_name",
      "email",
    ]);
  });

  it("strips dq_ and __dq prefixed columns", () => {
    const input = ["name", "dq_rule_id", "__dq_internal", "age"];
    expect(filterDQColumns(input)).toEqual(["name", "age"]);
  });
});
