/**
 * Phase 3 - jobs-api.ts frequency converter tests.
 * Target: modules/jobs/api/jobs-api.ts
 *
 * Covers the two pure functions that translate between the UI's
 * JobFrequency enum and the backend's EventBridge `{frequency_type,
 * frequency_value}` shape. Round-trip correctness is critical here
 * because getting the rate vs. cron split wrong silently changes the
 * job's schedule.
 */
import {
  frequencyToBackend,
  frequencyFromBackend,
} from "@/modules/jobs/api/jobs-api";

describe("frequencyToBackend", () => {
  it("maps 15min to rate/15 minutes", () => {
    expect(frequencyToBackend("15min")).toEqual({
      frequency_type: "rate",
      frequency_value: "15 minutes",
    });
  });

  it("maps 1hr to rate/1 hour", () => {
    expect(frequencyToBackend("1hr")).toEqual({
      frequency_type: "rate",
      frequency_value: "1 hour",
    });
  });

  it("maps daily to rate/1 day", () => {
    expect(frequencyToBackend("daily")).toEqual({
      frequency_type: "rate",
      frequency_value: "1 day",
    });
  });

  it("maps batch to batch/once regardless of cronExpr", () => {
    expect(frequencyToBackend("batch", "0 12 * * ? *")).toEqual({
      frequency_type: "batch",
      frequency_value: "once",
    });
  });

  it("maps cron with provided expression", () => {
    expect(frequencyToBackend("cron", "0 9 * * MON *")).toEqual({
      frequency_type: "cron",
      frequency_value: "0 9 * * MON *",
    });
  });

  it("falls back to a safe default cron when cronExpr omitted", () => {
    const result = frequencyToBackend("cron");
    expect(result.frequency_type).toBe("cron");
    // Default must be a valid EventBridge cron shape
    expect(result.frequency_value).toBe("0 * * * ? *");
  });

  it("uses rate/1 hour when given an unknown frequency", () => {
    // @ts-expect-error intentional bad input
    expect(frequencyToBackend("bogus")).toEqual({
      frequency_type: "rate",
      frequency_value: "1 hour",
    });
  });
});

describe("frequencyFromBackend", () => {
  it("recognizes batch type", () => {
    expect(frequencyFromBackend("batch", "once")).toEqual({
      frequency: "batch",
      cronExpression: "",
    });
  });

  it("recognizes cron type and echoes the expression", () => {
    expect(frequencyFromBackend("cron", "0 9 * * MON *")).toEqual({
      frequency: "cron",
      cronExpression: "0 9 * * MON *",
    });
  });

  it("returns empty cronExpression when cron type has no value", () => {
    expect(frequencyFromBackend("cron", undefined)).toEqual({
      frequency: "cron",
      cronExpression: "",
    });
  });

  it("recognizes minute-based rate as 15min", () => {
    expect(frequencyFromBackend("rate", "15 minutes").frequency).toBe("15min");
    expect(frequencyFromBackend("rate", "1 minute").frequency).toBe("15min");
  });

  it("recognizes hour-based rate as 1hr", () => {
    expect(frequencyFromBackend("rate", "1 hour").frequency).toBe("1hr");
    expect(frequencyFromBackend("rate", "2 hours").frequency).toBe("1hr");
  });

  it("recognizes day-based rate as daily", () => {
    expect(frequencyFromBackend("rate", "1 day").frequency).toBe("daily");
    expect(frequencyFromBackend("rate", "7 days").frequency).toBe("daily");
  });

  it("is case-insensitive on the frequency value", () => {
    expect(frequencyFromBackend("rate", "1 HOUR").frequency).toBe("1hr");
    expect(frequencyFromBackend("rate", "  15 Minutes  ").frequency).toBe("15min");
  });

  it("defaults to 1hr when neither rate nor cron nor batch recognized", () => {
    expect(frequencyFromBackend(undefined, undefined).frequency).toBe("1hr");
    expect(frequencyFromBackend("rate", "weekly").frequency).toBe("1hr");
  });
});

describe("round-trip: frequencyToBackend -> frequencyFromBackend", () => {
  it("preserves 15min", () => {
    const { frequency_type, frequency_value } = frequencyToBackend("15min");
    expect(
      frequencyFromBackend(frequency_type, frequency_value).frequency
    ).toBe("15min");
  });

  it("preserves 1hr", () => {
    const { frequency_type, frequency_value } = frequencyToBackend("1hr");
    expect(
      frequencyFromBackend(frequency_type, frequency_value).frequency
    ).toBe("1hr");
  });

  it("preserves daily", () => {
    const { frequency_type, frequency_value } = frequencyToBackend("daily");
    expect(
      frequencyFromBackend(frequency_type, frequency_value).frequency
    ).toBe("daily");
  });

  it("preserves batch", () => {
    const { frequency_type, frequency_value } = frequencyToBackend("batch");
    expect(
      frequencyFromBackend(frequency_type, frequency_value).frequency
    ).toBe("batch");
  });

  it("preserves cron and its expression", () => {
    const expr = "0 9 * * MON *";
    const { frequency_type, frequency_value } = frequencyToBackend("cron", expr);
    const parsed = frequencyFromBackend(frequency_type, frequency_value);
    expect(parsed.frequency).toBe("cron");
    expect(parsed.cronExpression).toBe(expr);
  });
});
