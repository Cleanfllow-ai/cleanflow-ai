/**
 * Unit tests for the cron-builder's pure helpers (parser + next-fire iterator).
 *
 * The visual builder writes a 6-field EventBridge cron, and re-parses on every
 * keystroke. The two correctness properties we care about are:
 *
 *   1. Well-known crons parse cleanly (no error, expected fields).
 *   2. The next-fire-time iterator returns timestamps that satisfy the cron.
 *   3. The day-of-month vs day-of-week mutual-exclusion guard catches both
 *      "?" + "?" and "specific" + "specific" pathological inputs.
 *
 * We don't test React rendering here — that's covered by the live preview.
 */

import {
    parseCron,
    getNextFireTimes,
    CRON_PRESETS,
} from "@/modules/jobs/components/cron-builder";

describe("parseCron — preset crons", () => {
    it("parses every preset without error", () => {
        for (const preset of CRON_PRESETS) {
            const parsed = parseCron(preset.cron);
            expect(parsed.error).toBeUndefined();
        }
    });

    it("parses 'Daily at 9 AM' → minute=[0], hour=[9], dom=*, dow=?", () => {
        const parsed = parseCron("0 9 * * ? *");
        expect(parsed.error).toBeUndefined();
        expect(parsed.minute).toEqual([0]);
        expect(parsed.hour).toEqual([9]);
        expect(parsed.dayOfMonth).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
            16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
            29, 30, 31,
        ]);
        expect(parsed.dayOfWeek).toBeNull();
    });

    it("parses 'Weekdays at 9 AM' with named weekdays", () => {
        const parsed = parseCron("0 9 ? * MON-FRI *");
        expect(parsed.error).toBeUndefined();
        expect(parsed.dayOfMonth).toBeNull();
        // EventBridge: 1=SUN, 2=MON, ..., 6=FRI, 7=SAT
        expect(parsed.dayOfWeek).toEqual([2, 3, 4, 5, 6]);
    });

    it("parses step expressions like 0/5", () => {
        const parsed = parseCron("0/5 * * * ? *");
        expect(parsed.error).toBeUndefined();
        expect(parsed.minute).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    });
});

describe("parseCron — mutual exclusion", () => {
    it("rejects when both dom and dow are `?`", () => {
        const parsed = parseCron("0 0 ? * ? *");
        expect(parsed.error).toMatch(/day-of-month or day-of-week must be/i);
    });

    it("rejects when both dom and dow are specific values", () => {
        const parsed = parseCron("0 0 1 * MON *");
        expect(parsed.error).toMatch(/day-of-month or day-of-week must be/i);
    });

    it("accepts dom=? + dow=specific", () => {
        const parsed = parseCron("0 9 ? * MON *");
        expect(parsed.error).toBeUndefined();
    });

    it("accepts dom=specific + dow=?", () => {
        const parsed = parseCron("0 0 1 * ? *");
        expect(parsed.error).toBeUndefined();
    });
});

describe("parseCron — invalid inputs", () => {
    it("rejects wrong field count", () => {
        const parsed = parseCron("0 0 * * *");
        expect(parsed.error).toMatch(/6 fields/i);
    });

    it("rejects out-of-range minute", () => {
        const parsed = parseCron("60 0 * * ? *");
        expect(parsed.error).toMatch(/minute/i);
    });

    it("rejects out-of-range hour", () => {
        const parsed = parseCron("0 25 * * ? *");
        expect(parsed.error).toMatch(/hour/i);
    });
});

describe("getNextFireTimes", () => {
    // Use a fixed reference: 2026-01-01 00:00:00 UTC = 2026-01-01 05:30 IST.
    const REF = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

    it("returns 5 results for 'Hourly' preset", () => {
        const parsed = parseCron("0 * * * ? *");
        const times = getNextFireTimes(parsed, 5, REF);
        expect(times).toHaveLength(5);
        // Each result, viewed in IST, should have minute = 0.
        for (const t of times) {
            const istMin = (new Date(t.getTime() + 5.5 * 60 * 60 * 1000)).getUTCMinutes();
            expect(istMin).toBe(0);
        }
    });

    it("returns 5 results for 'Daily at 9 AM' preset (all at IST 9:00)", () => {
        const parsed = parseCron("0 9 * * ? *");
        const times = getNextFireTimes(parsed, 5, REF);
        expect(times).toHaveLength(5);
        for (const t of times) {
            const ist = new Date(t.getTime() + 5.5 * 60 * 60 * 1000);
            expect(ist.getUTCHours()).toBe(9);
            expect(ist.getUTCMinutes()).toBe(0);
        }
    });

    it("returns 5 results for 'Weekdays at 9 AM' (no Sat/Sun)", () => {
        const parsed = parseCron("0 9 ? * MON-FRI *");
        const times = getNextFireTimes(parsed, 5, REF);
        expect(times).toHaveLength(5);
        for (const t of times) {
            const ist = new Date(t.getTime() + 5.5 * 60 * 60 * 1000);
            // JS getUTCDay: 0=SUN, 1=MON, ..., 5=FRI, 6=SAT
            const day = ist.getUTCDay();
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(5);
            expect(ist.getUTCHours()).toBe(9);
            expect(ist.getUTCMinutes()).toBe(0);
        }
    });

    it("returns empty array for parser-error crons", () => {
        const parsed = parseCron("garbage");
        const times = getNextFireTimes(parsed, 5, REF);
        expect(times).toHaveLength(0);
    });

    it("respects month restriction (only Jan)", () => {
        const parsed = parseCron("0 0 1 JAN ? *");
        const times = getNextFireTimes(parsed, 3, REF);
        expect(times.length).toBeGreaterThan(0);
        for (const t of times) {
            const ist = new Date(t.getTime() + 5.5 * 60 * 60 * 1000);
            expect(ist.getUTCMonth()).toBe(0); // January
            expect(ist.getUTCDate()).toBe(1);
        }
    });
});
