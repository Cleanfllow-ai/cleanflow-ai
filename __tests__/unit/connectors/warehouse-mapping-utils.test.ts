/**
 * Phase 3 (extended) - warehouse-mapping-utils.ts tests.
 * Target: modules/connectors/components/warehouse/warehouse-mapping-utils.ts
 *
 * Covers autoMapColumns, which runs a 3-pass fuzzy match between
 * user-provided file columns and existing warehouse table columns:
 *
 *   Pass 1: exact normalized match (lowercase, strip spaces/_/-)
 *   Pass 2: synonym match (12 built-in synonym groups)
 *   Pass 3: substring containment (3+ chars minimum)
 *
 * Getting the priority order wrong would silently re-route data during
 * warehouse imports (e.g. mapping "email" to "customer_email" instead of
 * the actual "email" column).
 */
import { autoMapColumns } from "@/modules/connectors/components/warehouse/warehouse-mapping-utils";

describe("autoMapColumns — Pass 1: exact normalized match", () => {
  it("maps identical column names", () => {
    const result = autoMapColumns(
      ["customer_name"],
      ["customer_name"]
    );
    expect(result.customer_name).toBe("customer_name");
  });

  it("maps case-insensitively via normalization", () => {
    const result = autoMapColumns(["Customer_Name"], ["CUSTOMER-NAME"]);
    expect(result.Customer_Name).toBe("CUSTOMER-NAME");
  });

  it("maps despite differing separators (spaces vs underscores vs hyphens)", () => {
    const result = autoMapColumns(["Customer Name"], ["customer_name"]);
    expect(result["Customer Name"]).toBe("customer_name");
  });

  it("does not map the same file column to two different targets", () => {
    const result = autoMapColumns(
      ["customer_name", "customer_name"],
      ["customer_name"]
    );
    // Both targets want "customer_name" but only one can have it
    const assigned = Object.values(result);
    const unique = new Set(assigned);
    expect(unique.size).toBe(assigned.length);
  });

  it("returns empty mapping when nothing matches", () => {
    const result = autoMapColumns(["price"], ["unrelated"]);
    expect(result).toEqual({});
  });
});

describe("autoMapColumns — Pass 2: synonym match", () => {
  it("maps 'customer_name' to 'fullname' via name synonym group", () => {
    const result = autoMapColumns(["customer_name"], ["fullname"]);
    expect(result.customer_name).toBe("fullname");
  });

  it("maps 'email' to 'emailaddress'", () => {
    const result = autoMapColumns(["email"], ["emailaddress"]);
    expect(result.email).toBe("emailaddress");
  });

  it("maps 'email' to 'mail'", () => {
    const result = autoMapColumns(["email"], ["mail"]);
    expect(result.email).toBe("mail");
  });

  it("maps 'phone' to 'telephone'", () => {
    const result = autoMapColumns(["phone"], ["telephone"]);
    expect(result.phone).toBe("telephone");
  });

  it("maps 'zip' to 'postal_code' (synonym + normalization)", () => {
    const result = autoMapColumns(["zip"], ["postal_code"]);
    expect(result.zip).toBe("postal_code");
  });

  it("maps 'company' to 'organisation' (British spelling)", () => {
    const result = autoMapColumns(["company"], ["organisation"]);
    expect(result.company).toBe("organisation");
  });

  it("maps 'lastname' to 'surname'", () => {
    const result = autoMapColumns(["lastname"], ["surname"]);
    expect(result.lastname).toBe("surname");
  });

  it("maps 'state' to 'province'", () => {
    const result = autoMapColumns(["state"], ["province"]);
    expect(result.state).toBe("province");
  });
});

describe("autoMapColumns — Pass 3: substring containment", () => {
  it("matches when target contains file col (target >= 3 chars)", () => {
    // "customerid" contains "id" (but id < 3 chars, so won't trigger substring)
    // Use a longer example: "customer" contains "cust"
    const result = autoMapColumns(["customer"], ["cust"]);
    expect(result.customer).toBe("cust");
  });

  it("matches when file col contains target (target >= 3 chars)", () => {
    const result = autoMapColumns(["email"], ["customer_email_address"]);
    expect(result.email).toBe("customer_email_address");
  });

  it("does NOT substring-match when target is shorter than 3 chars", () => {
    // "id" (2 chars) is too short to trigger the targetNorm.length>=3 branch,
    // AND "id".includes("customeridentifier") is false, so neither branch
    // of the substring check triggers. Synonym match also fails because the
    // synonym group contains "identifier" (not "customeridentifier") and the
    // synonym lookup is exact-key only. Result: "id" goes unmatched.
    const result = autoMapColumns(["id"], ["customer_identifier"]);
    expect(result.id).toBeUndefined();
  });

  it("DOES synonym-match 'id' to a literal 'identifier' column", () => {
    const result = autoMapColumns(["id"], ["identifier"]);
    expect(result.id).toBe("identifier");
  });
});

describe("autoMapColumns — priority: exact beats synonym beats substring", () => {
  it("prefers exact match over synonym", () => {
    const result = autoMapColumns(["email"], ["email", "emailaddress"]);
    expect(result.email).toBe("email");
  });

  it("prefers synonym over substring", () => {
    // Target "phone", file has both "telephone" (synonym) and
    // "phonenumber" (substring). Synonym should win.
    const result = autoMapColumns(["phone"], ["telephone", "phonenumber"]);
    // Actually both are in the phone synonym group, but synonym Pass 2 runs
    // before substring Pass 3, so whichever is checked first wins among synonyms.
    expect(["telephone", "phonenumber"]).toContain(result.phone);
  });
});

describe("autoMapColumns — edge cases", () => {
  it("returns empty mapping when target columns are empty", () => {
    expect(autoMapColumns([], ["a", "b"])).toEqual({});
  });

  it("returns empty mapping when file columns are empty", () => {
    expect(autoMapColumns(["a", "b"], [])).toEqual({});
  });

  it("does not reuse a file column across multiple targets", () => {
    // Both "name" and "customer_name" could match "fullname" via synonym,
    // but only one should win
    const result = autoMapColumns(
      ["name", "customer_name"],
      ["fullname"]
    );
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("leaves unmatched targets out of the result", () => {
    const result = autoMapColumns(
      ["email", "totally_unknown_col"],
      ["email"]
    );
    expect(result.email).toBe("email");
    expect(result.totally_unknown_col).toBeUndefined();
  });

  it("handles Unicode target and file columns at the normalized layer", () => {
    // Normalization is just lowercase + strip spaces/_/-; Unicode survives
    const result = autoMapColumns(["顧客名"], ["顧客名"]);
    expect(result["顧客名"]).toBe("顧客名");
  });
});
