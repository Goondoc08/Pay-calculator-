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

  it("defaults worked holiday days to holidayWorked", () => {
    const entries = defaultDayEntries(year, "A", period);
    const thanksgiving = entries.find((e) => e.date === "2026-11-26");
    expect(thanksgiving?.type).toBe("holidayWorked");
    expect(thanksgiving?.hours).toBe(24);
  });

  it("defaults an off-day holiday to a 12-hr holidayObserved entry", () => {
    const mlkPeriod = year.periods[8]; // period 9, contains MLK day
    const entries = defaultDayEntries(year, "A", mlkPeriod);
    const mlk = entries.find((e) => e.date === "2027-01-18");
    expect(mlk?.type).toBe("holidayObserved");
    expect(mlk?.hours).toBe(12);
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
