/**
 * Phase 3 - erp-mapping-utils.ts tests.
 * Target: modules/connectors/components/erp/erp-mapping-utils.ts
 *
 * Covers: normalizeKey, autoMapColumns, validateMapping.
 *
 * These helpers run the "fast path" before we call the backend AI auto-mapper.
 * Getting the fuzzy matching wrong causes columns to map to the wrong field
 * during ERP export, which can corrupt customer data.
 */
import {
  normalizeKey,
  autoMapColumns,
  validateMapping,
  type MappingField,
} from "@/modules/connectors/components/erp/erp-mapping-utils";

describe("normalizeKey", () => {
  it("lowercases the input", () => {
    expect(normalizeKey("CustomerName")).toBe("customername");
  });

  it("strips spaces", () => {
    expect(normalizeKey("customer name")).toBe("customername");
  });

  it("strips underscores", () => {
    expect(normalizeKey("customer_name")).toBe("customername");
  });

  it("strips hyphens", () => {
    expect(normalizeKey("customer-name")).toBe("customername");
  });

  it("strips a mix of spaces, underscores, and hyphens", () => {
    expect(normalizeKey("customer__ name-id")).toBe("customernameid");
  });

  it("returns an empty string for an empty input", () => {
    expect(normalizeKey("")).toBe("");
  });

  it("leaves numbers and letters intact", () => {
    expect(normalizeKey("Col42_Test")).toBe("col42test");
  });

  it("keeps other punctuation (intentional: only spaces/_/- are stripped)", () => {
    // The implementation only strips [\s_-], so dots and parens stay
    expect(normalizeKey("Amount (USD).net")).toBe("amount(usd).net");
  });

  it("collision: two keys normalize to the same value", () => {
    expect(normalizeKey("Customer Name")).toBe(normalizeKey("customer_name"));
    expect(normalizeKey("Customer-Name")).toBe(normalizeKey("CUSTOMERNAME"));
  });
});

// ──────────────────────────────────────────────────────────────────────────────

const makeField = (
  key: string,
  label: string,
  required = false
): MappingField => ({ key, label, required, help: "" });

describe("autoMapColumns — exact key match", () => {
  it("maps when column key normalizes to field key", () => {
    const mapping = autoMapColumns(
      ["customer_name", "email"],
      [makeField("customerName", "Customer Name")]
    );
    expect(mapping).toEqual({ customerName: "customer_name" });
  });

  it("is case-insensitive via normalization", () => {
    const mapping = autoMapColumns(
      ["CUSTOMER-NAME"],
      [makeField("customer_name", "Customer Name")]
    );
    expect(mapping.customer_name).toBe("CUSTOMER-NAME");
  });
});

describe("autoMapColumns — label match", () => {
  it("matches by label when key does not match", () => {
    const mapping = autoMapColumns(
      ["First Name"],
      [makeField("given_name", "First Name")]
    );
    expect(mapping.given_name).toBe("First Name");
  });
});

describe("autoMapColumns — substring fallback", () => {
  it("matches a column whose normalized form contains the field key", () => {
    // field key "email" is a substring of "customer_email"
    const mapping = autoMapColumns(
      ["customer_email"],
      [makeField("email", "Email Address")]
    );
    expect(mapping.email).toBe("customer_email");
  });

  it("matches when field key contains the column (reverse substring)", () => {
    // field key "billing_address_city" contains "city"
    const mapping = autoMapColumns(
      ["city"],
      [makeField("billing_address_city", "Billing City")]
    );
    expect(mapping.billing_address_city).toBe("city");
  });

  it("prefers exact key match over substring match", () => {
    const mapping = autoMapColumns(
      ["email", "customer_email"],
      [makeField("email", "Email")]
    );
    expect(mapping.email).toBe("email");
  });
});

describe("autoMapColumns — no duplicate column assignment", () => {
  it("does not map the same column to two different fields", () => {
    const mapping = autoMapColumns(
      ["name"],
      [
        makeField("first_name", "First Name"),
        makeField("last_name", "Last Name"),
      ]
    );
    // Only one field should get "name"; the other should be unmapped
    const assigned = Object.values(mapping);
    const unique = new Set(assigned);
    expect(assigned.length).toBe(unique.size);
  });
});

describe("autoMapColumns — edge cases", () => {
  it("returns empty mapping for empty columns", () => {
    expect(autoMapColumns([], [makeField("a", "A")])).toEqual({});
  });

  it("returns empty mapping for empty fields", () => {
    expect(autoMapColumns(["a", "b"], [])).toEqual({});
  });

  it("leaves unmappable fields out of the result", () => {
    const mapping = autoMapColumns(
      ["unrelated"],
      [makeField("nothing_like_this", "Nothing")]
    );
    expect(mapping.nothing_like_this).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe("validateMapping", () => {
  const required = makeField("email", "Email", true);
  const optional = makeField("phone", "Phone", false);

  it("passes when all required fields are mapped", () => {
    const result = validateMapping(
      { email: "user_email" },
      ["user_email", "user_phone"],
      [required, optional]
    );
    expect(result.valid).toBe(true);
  });

  it("fails when a required field is missing from the mapping", () => {
    const result = validateMapping({}, ["user_phone"], [required, optional]);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Email/);
  });

  it("fails when a required field maps to a non-existent column", () => {
    // Mapping points to "ghost" column but "ghost" isn't in the columns list
    const result = validateMapping(
      { email: "ghost" },
      ["user_email"],
      [required]
    );
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Email/);
  });

  it("passes when optional fields are unmapped", () => {
    const result = validateMapping(
      { email: "user_email" },
      ["user_email"],
      [required, optional]
    );
    expect(result.valid).toBe(true);
  });

  it("passes when both columns and fields are empty", () => {
    const result = validateMapping({}, [], []);
    expect(result.valid).toBe(true);
  });
});
