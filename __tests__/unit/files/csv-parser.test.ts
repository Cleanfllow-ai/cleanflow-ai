/**
 * Phase 2 - csv-parser.ts unit tests.
 * Target: modules/files/utils/csv-parser.ts
 *
 * Covers: splitCSVLine, parseLegacyCsv, parseAdvancedCsv, rowsToCSV,
 * validateCSV, getCSVStats.
 *
 * Many edge cases from the Phase 2 requirement: quoted values with commas,
 * escaped quotes, Unicode, empty files, ragged rows, CRLF vs LF, multiline
 * quoted fields (advanced parser), header-only files, CSV with only whitespace.
 */
import {
  splitCSVLine,
  parseLegacyCsv,
  parseAdvancedCsv,
  rowsToCSV,
  validateCSV,
  getCSVStats,
} from "@/modules/files/utils/csv-parser";

describe("splitCSVLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(splitCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas inside double-quoted cells intact", () => {
    expect(splitCSVLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it('unescapes "" inside quoted cells to a single "', () => {
    expect(splitCSVLine('"she said ""hi""","ok"')).toEqual([
      'she said "hi"',
      "ok",
    ]);
  });

  it("returns an empty cell for a bare delimiter at the end", () => {
    expect(splitCSVLine("a,b,")).toEqual(["a", "b", ""]);
  });

  it("returns an empty cell for a leading delimiter", () => {
    expect(splitCSVLine(",a,b")).toEqual(["", "a", "b"]);
  });

  it("returns a single-element array for a line with no commas", () => {
    expect(splitCSVLine("alone")).toEqual(["alone"]);
  });

  it("handles whitespace inside cells literally (no trimming)", () => {
    expect(splitCSVLine("  a  , b ,c")).toEqual(["  a  ", " b ", "c"]);
  });

  it("preserves Unicode characters (CJK, emoji) inside cells", () => {
    expect(splitCSVLine("山田太郎,🚀,bob")).toEqual(["山田太郎", "🚀", "bob"]);
  });
});

describe("parseLegacyCsv", () => {
  it("parses a minimal header + one data row", () => {
    const result = parseLegacyCsv("name,age\nalice,30");
    expect(result.columns).toContain("name");
    expect(result.columns).toContain("age");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("alice");
    expect(result.rows[0].age).toBe("30");
  });

  it("returns empty columns and rows for empty input", () => {
    expect(parseLegacyCsv("")).toEqual({ columns: [], rows: [] });
  });

  it("returns empty columns and rows for whitespace-only input", () => {
    expect(parseLegacyCsv("   \n\n  \n")).toEqual({ columns: [], rows: [] });
  });

  it("handles CRLF line endings", () => {
    const result = parseLegacyCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].a).toBe("1");
    expect(result.rows[1].b).toBe("4");
  });

  it("auto-generates row_id when the header does not include one", () => {
    const result = parseLegacyCsv("name\nalice\nbob");
    expect(result.columns[0]).toBe("row_id");
    expect(result.rows[0].row_id).toBe("1");
    expect(result.rows[1].row_id).toBe("2");
  });

  it("preserves user-provided row_id when present", () => {
    const result = parseLegacyCsv("row_id,name\n42,alice\n99,bob");
    expect(result.rows[0].row_id).toBe("42");
    expect(result.rows[1].row_id).toBe("99");
  });

  it("fills blank header cells with column_N placeholders", () => {
    const result = parseLegacyCsv(",,name\n1,2,alice");
    expect(result.columns).toContain("column_1");
    expect(result.columns).toContain("column_2");
    expect(result.columns).toContain("name");
  });

  it("filters out completely empty rows mid-file", () => {
    const result = parseLegacyCsv("a,b\n1,2\n\n3,4");
    expect(result.rows).toHaveLength(2);
  });

  it("handles quoted commas inside values", () => {
    const result = parseLegacyCsv('name,note\nalice,"hello, world"');
    expect(result.rows[0].note).toBe("hello, world");
  });
});

describe("parseAdvancedCsv", () => {
  it("parses a multiline quoted value across two physical lines", () => {
    const text = 'name,note\nalice,"line1\nline2"\nbob,ok';
    const result = parseAdvancedCsv(text);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].note).toBe("line1\nline2");
    expect(result.rows[1].name).toBe("bob");
  });

  it("handles CRLF line endings inside multiline quoted fields", () => {
    const text = 'a,b\r\n1,"multi\r\nline"\r\n';
    const result = parseAdvancedCsv(text);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].b).toBe("multi\r\nline");
  });

  it("returns empty result for empty input", () => {
    expect(parseAdvancedCsv("")).toEqual({ columns: [], rows: [] });
  });

  it("auto-generates row_id", () => {
    const result = parseAdvancedCsv("name\nalice\nbob");
    expect(result.rows[0].row_id).toBe("1");
    expect(result.rows[1].row_id).toBe("2");
  });
});

describe("rowsToCSV", () => {
  it("returns empty string for an empty rows array", () => {
    expect(rowsToCSV([])).toBe("");
  });

  it("writes a header row followed by data rows", () => {
    const out = rowsToCSV([
      { name: "alice", age: "30" },
      { name: "bob", age: "25" },
    ]);
    expect(out).toContain("name,age");
    expect(out).toContain("alice,30");
    expect(out).toContain("bob,25");
  });

  it("quotes cells that contain a comma", () => {
    const out = rowsToCSV([{ col: "hello, world" }]);
    expect(out).toContain('"hello, world"');
  });

  it("escapes internal double quotes by doubling them", () => {
    const out = rowsToCSV([{ col: 'she said "hi"' }]);
    expect(out).toContain('"she said ""hi"""');
  });

  it("quotes cells containing newlines", () => {
    const out = rowsToCSV([{ col: "line1\nline2" }]);
    expect(out).toContain('"line1\nline2"');
  });

  it("coerces null and undefined values to empty strings", () => {
    const out = rowsToCSV([{ a: null, b: undefined, c: "ok" }]);
    expect(out.split("\n")[1]).toBe(",,ok");
  });
});

describe("rowsToCSV + parseLegacyCsv round-trip", () => {
  it("preserves cells containing commas", () => {
    const rows = [
      { row_id: "1", name: "alice", note: "hello, world" },
    ];
    const csv = rowsToCSV(rows);
    const parsed = parseLegacyCsv(csv);
    expect(parsed.rows[0].note).toBe("hello, world");
  });

  it("preserves cells containing quotes", () => {
    const rows = [{ row_id: "1", quote: 'he said "hi"' }];
    const csv = rowsToCSV(rows);
    const parsed = parseLegacyCsv(csv);
    expect(parsed.rows[0].quote).toBe('he said "hi"');
  });
});

describe("validateCSV", () => {
  it("flags empty CSV as invalid", () => {
    const result = validateCSV("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("CSV content is empty");
  });

  it("flags whitespace-only CSV as invalid", () => {
    const result = validateCSV("   \n  \n");
    expect(result.valid).toBe(false);
  });

  it("flags header-only CSV as invalid (no data rows)", () => {
    const result = validateCSV("name,age");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/no data rows/i);
  });

  it("accepts a well-formed CSV", () => {
    const result = validateCSV("name,age\nalice,30\nbob,25");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("getCSVStats", () => {
  it("reports row/column counts for a standard CSV", () => {
    const stats = getCSVStats("name,age\nalice,30\nbob,25\ncarol,40");
    expect(stats.rowCount).toBe(3);
    // columnCount includes the auto-generated row_id column prepended
    expect(stats.columnCount).toBe(3);
    expect(stats.hasHeaders).toBe(true);
  });

  it("counts empty cells within non-empty rows", () => {
    // Note: parseLegacyCsv filters ROWS that are entirely empty, so the test
    // input uses partially-empty rows only. Row 1: b is empty. Row 2: b is empty.
    // Total empty cells = 2. (row_id is auto-generated and never empty.)
    const stats = getCSVStats("a,b,c\n1,,3\n4,,6");
    expect(stats.emptyCells).toBe(2);
  });

  it("returns zeros for empty input", () => {
    const stats = getCSVStats("");
    expect(stats.rowCount).toBe(0);
    expect(stats.columnCount).toBe(0);
    expect(stats.totalCells).toBe(0);
    expect(stats.emptyCells).toBe(0);
    expect(stats.hasHeaders).toBe(false);
  });
});
