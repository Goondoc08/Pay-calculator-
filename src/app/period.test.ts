import { describe, expect, it } from "vitest";
import fy27Raw from "../data/fy27.json";
import { parsePayYear } from "../data/schema";
import { computePeriod } from "../engine/period";
import {
  aggregateLineItems,
  blocksToEntries,
  defaultDayEntries,
  entriesToBlocks,
  findPeriodForDate,
} from "./period";

const year = parsePayYear(fy27Raw);

describe("findPeriodForDate", () => {
  it("finds the period containing a date", () => {
    expect(findPeriodForDate(year, "2026-11-26")?.n).toBe(5);
  });

  it("falls back to period 1 before the year starts", () => {
    expect(findPeriodForDate(year, "2020-01-01")?.n).toBe(1);
  });

  it("falls back to the last period after the year ends", () => {
    expect(findPeriodForDate(year, "2099-01-01")?.n).toBe(26);
  });
});

describe("defaultDayEntries", () => {
  const period = year.periods[4]; // period 5, the Thanksgiving period

  it("defaults a worked holiday day to holidayHoursWorked = scheduled hours", () => {
    const entries = defaultDayEntries(year, "A", period);
    const thanksgiving = entries.find((e) => e.date === "2026-11-26");
    expect(thanksgiving?.isHoliday).toBe(true);
    expect(thanksgiving?.holidayHoursWorked).toBe(24);
  });

  it("defaults an off-day holiday to holidayHoursWorked = 0 (full 12-hr observed)", () => {
    const mlkPeriod = year.periods[8]; // period 9, contains MLK day
    const entries = defaultDayEntries(year, "A", mlkPeriod);
    const mlk = entries.find((e) => e.date === "2027-01-18");
    expect(mlk?.isHoliday).toBe(true);
    expect(mlk?.holidayHoursWorked).toBe(0);
  });

  it("defaults a plain scheduled day to regular", () => {
    const entries = defaultDayEntries(year, "A", period);
    const regularDay = entries.find((e) => e.date === "2026-11-21");
    expect(regularDay?.type).toBe("regular");
    expect(regularDay?.hours).toBe(24);
  });

  it("defaults a scheduled-off day to off with 0 hours", () => {
    const entries = defaultDayEntries(year, "A", period);
    const offDay = entries.find((e) => e.date === "2026-11-22");
    expect(offDay?.type).toBe("off");
    expect(offDay?.hours).toBe(0);
  });

  it("never defaults grade to F1 — it's never a valid step-up target", () => {
    // Regression: the UI's step-up grade picker only lists F2+, so if an
    // entry's default grade were "F1" the picker would visually show its
    // first listed option (F2) while the entry actually held "F1" —
    // silently pricing a step-up block at the wrong (lower) rate the
    // moment someone picked "Step-up" without also touching the grade
    // dropdown themselves.
    const entries = defaultDayEntries(year, "A", period);
    expect(entries.every((e) => e.grade !== "F1")).toBe(true);
  });

  it("defaults step-up grade to the one directly above the member's own", () => {
    // Step-up always covers Step 0 of the grade above the member's own,
    // regardless of the member's own step within their grade
    // (docs/PAY_PLAN.md) — an F3 member defaults to riding up as F4, not
    // always F2.
    const entriesForF3 = defaultDayEntries(year, "A", period, "F3");
    expect(entriesForF3.every((e) => e.grade === "F4")).toBe(true);
  });

  it("falls back to F2 when the member's grade isn't known yet", () => {
    const entries = defaultDayEntries(year, "A", period, null);
    expect(entries.every((e) => e.grade === "F2")).toBe(true);
  });
});

describe("entriesToBlocks / blocksToEntries round-trip", () => {
  it("converts defaults to blocks and back without loss", () => {
    const period = year.periods[4];
    const entries = defaultDayEntries(year, "A", period);
    const blocks = entriesToBlocks(entries);
    const roundTripped = blocksToEntries(year, "A", period, blocks);
    expect(roundTripped).toEqual(entries);
  });

  it("reproduces the same gross as computing straight from defaults", () => {
    const period = year.periods[4];
    const profile = {
      shift: "A" as const,
      rateSegments: [
        {
          effectiveFrom: year.effectiveFrom,
          hourlyRate: 26.8173,
          incentiveTotal: 0,
        },
      ],
    };
    const entries = defaultDayEntries(year, "A", period);
    const blocks = entriesToBlocks(entries);
    const result = computePeriod(year, profile, blocks);
    expect(result.gross).toBeGreaterThan(0);
  });

  it("splits a partial holiday holdover into holidayWorked + leftover holidayObserved", () => {
    // Confirmed directly: working part of the 12-hr entitlement (e.g. a
    // 2-hr late-call holdover) pays worked hours at 1.5x AND the
    // remaining entitlement at straight time — not yet checked against a
    // real paystub (docs/BUILD_PLAN.md Phase 06).
    const period = year.periods[4];
    const entries = defaultDayEntries(year, "A", period).map((e) =>
      e.date === "2026-11-26" ? { ...e, holidayHoursWorked: 2 } : e,
    );
    const blocks = entriesToBlocks(entries);
    const thanksgivingBlocks = blocks.filter((b) => b.date === "2026-11-26");
    expect(thanksgivingBlocks).toEqual([
      {
        date: "2026-11-26",
        type: "holidayWorked",
        hours: 2,
        destination: "cash",
      },
      {
        date: "2026-11-26",
        type: "holidayObserved",
        hours: 10,
        destination: "cash",
      },
    ]);
  });

  it("round-trips a partial holiday holdover", () => {
    const period = year.periods[4];
    const entries = defaultDayEntries(year, "A", period).map((e) =>
      e.date === "2026-11-26" ? { ...e, holidayHoursWorked: 2 } : e,
    );
    const blocks = entriesToBlocks(entries);
    const roundTripped = blocksToEntries(year, "A", period, blocks);
    expect(roundTripped).toEqual(entries);
  });

  it("banks worked holiday hours as comp ($0) when holidayWorkedComped is set", () => {
    // Confirmed by a real timecard: working a holiday and taking it as
    // comp instead of cash means no straight/premium pay for the worked
    // portion this check — same $0-if-banked rule as any other worked
    // hours, just previously unreachable for the holiday-worked case
    // specifically since that input only ever emitted "cash".
    const period = year.periods[4];
    const entries = defaultDayEntries(year, "A", period).map((e) =>
      e.date === "2026-11-26"
        ? { ...e, holidayHoursWorked: 24, holidayWorkedComped: true }
        : e,
    );
    const blocks = entriesToBlocks(entries);
    const thanksgivingBlocks = blocks.filter((b) => b.date === "2026-11-26");
    expect(thanksgivingBlocks).toEqual([
      {
        date: "2026-11-26",
        type: "holidayWorked",
        hours: 24,
        destination: "comp",
      },
    ]);

    const profile = {
      shift: "A" as const,
      rateSegments: [
        {
          effectiveFrom: year.effectiveFrom,
          hourlyRate: 26.8173,
          incentiveTotal: 0,
        },
      ],
    };
    const thanksgivingGross = computePeriod(
      year,
      profile,
      thanksgivingBlocks,
    ).gross;
    expect(thanksgivingGross).toBe(0);
  });

  it("round-trips a comped holiday-worked entry", () => {
    const period = year.periods[4];
    const entries = defaultDayEntries(year, "A", period).map((e) =>
      e.date === "2026-11-26"
        ? { ...e, holidayHoursWorked: 24, holidayWorkedComped: true }
        : e,
    );
    const blocks = entriesToBlocks(entries);
    const roundTripped = blocksToEntries(year, "A", period, blocks);
    expect(roundTripped).toEqual(entries);
  });

  it("emits every block as destination cash — no comp/accrue tracking", () => {
    const period = year.periods[4];
    const entries = defaultDayEntries(year, "A", period);
    const blocks = entriesToBlocks(entries);
    expect(
      blocks.every((b) => !("destination" in b) || b.destination === "cash"),
    ).toBe(true);
  });
});

describe("aggregateLineItems", () => {
  it("collapses per-day line items into one row per pay code", () => {
    const aggregated = aggregateLineItems([
      {
        label: "Regular",
        date: "2026-09-27",
        hours: 24,
        rate: 26.8173,
        amount: 643.6152,
      },
      {
        label: "Regular",
        date: "2026-09-28",
        hours: 24,
        rate: 26.8173,
        amount: 643.6152,
      },
      {
        label: "FLSA premium",
        date: "2026-09-28",
        hours: 4,
        rate: 13.40865,
        amount: 53.6346,
      },
    ]);
    expect(aggregated).toHaveLength(2);
    const regular = aggregated.find((a) => a.label === "Regular");
    expect(regular?.hours).toBe(48);
    expect(regular?.amount).toBeCloseTo(1287.2304, 4);
  });
});
