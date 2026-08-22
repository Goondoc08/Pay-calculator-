import { describe, expect, it } from "vitest";
import fy27Raw from "../data/fy27.json";
import { parsePayYear } from "../data/schema";
import { computePeriod, computeStepUp } from "./period";
import type { HourBlock, Profile } from "./types";

const year = parsePayYear(fy27Raw);

const flatProfile: Profile = {
  shift: "A",
  rateSegments: [
    { effectiveFrom: "2026-09-26", hourlyRate: 26.8173, incentiveTotal: 0 },
  ],
};

describe("computePeriod", () => {
  it("returns zero for a period with no hour blocks", () => {
    const result = computePeriod(year, flatProfile, []);
    expect(result).toEqual({
      totalHours: 0,
      otHours: 0,
      gross: 0,
      lineItems: [],
    });
  });

  it("matches a plain 120-hour period with no OT-triggering surplus", () => {
    // 5 worked days of 24 hrs = 120, over the 106-hr cap by 14.
    const blocks: HourBlock[] = [
      "2026-09-27",
      "2026-09-28",
      "2026-10-03",
      "2026-10-04",
      "2026-10-09",
    ].map((date) => ({
      date,
      type: "regular",
      hours: 24,
      destination: "cash",
    }));

    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(120);
    expect(result.otHours).toBe(14);
    // 120 * 26.8173 (straight) + 14 * 0.5 * 26.8173 (FLSA premium)
    expect(result.gross).toBeCloseTo(120 * 26.8173 + 14 * 0.5 * 26.8173, 4);
  });

  it("a 96-hour period has no OT", () => {
    const blocks: HourBlock[] = ["2026-10-24", "2026-10-25"].map((date) => ({
      date,
      type: "regular",
      hours: 24,
      destination: "cash",
    }));
    // pad to 96 with two more days
    blocks.push(
      { date: "2026-10-31", type: "regular", hours: 24, destination: "cash" },
      { date: "2026-11-01", type: "regular", hours: 24, destination: "cash" },
    );
    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(96);
    expect(result.otHours).toBe(0);
    expect(result.gross).toBeCloseTo(96 * 26.8173, 4);
  });

  it("PTO hours are paid straight but never count toward the 106-hr cap", () => {
    // 120 hrs worked + 24 hrs PTO. If PTO counted toward the cap this would
    // be 38 OT hours; it must stay 14 (from the worked hours alone).
    const worked: HourBlock[] = [
      "2026-09-27",
      "2026-09-28",
      "2026-10-03",
      "2026-10-04",
      "2026-10-09",
    ].map((date) => ({
      date,
      type: "regular",
      hours: 24,
      destination: "cash",
    }));
    const blocks: HourBlock[] = [
      ...worked,
      { date: "2026-10-10", type: "pto", hours: 24 },
    ];
    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(144);
    expect(result.otHours).toBe(14);
    const expectedGross = 120 * 26.8173 + 14 * 0.5 * 26.8173 + 24 * 26.8173;
    expect(result.gross).toBeCloseTo(expectedGross, 4);
  });

  it("holiday worked pays 1.5x the effective rate and is excluded from the cap", () => {
    // 96 regular + 24 holiday-worked = 120 total, but only 96 count toward
    // the cap, so OT is 0 — this is the case that resolves a real check's
    // $0 FLSA premium despite a 120-hour total (docs/BUILD_PLAN.md §5).
    const blocks: HourBlock[] = [
      { date: "2026-11-21", type: "regular", hours: 24, destination: "cash" },
      {
        date: "2026-11-26",
        type: "holidayWorked",
        hours: 24,
        destination: "cash",
      },
      { date: "2026-12-02", type: "regular", hours: 24, destination: "cash" },
      { date: "2026-12-03", type: "regular", hours: 24, destination: "cash" },
      { date: "2026-11-27", type: "regular", hours: 24, destination: "cash" },
    ];
    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(120);
    expect(result.otHours).toBe(0);
    const expectedGross = 96 * 26.8173 + 24 * 1.5 * 26.8173;
    expect(result.gross).toBeCloseTo(expectedGross, 4);
  });

  it("holiday observed pays 12 hrs straight and doesn't count toward the cap", () => {
    const blocks: HourBlock[] = [
      {
        date: "2027-01-18",
        type: "holidayObserved",
        hours: 12,
        destination: "cash",
      },
    ];
    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(12);
    expect(result.otHours).toBe(0);
    expect(result.gross).toBeCloseTo(12 * 26.8173, 4);
  });

  it("comped or accrued hours contribute $0 to this check's gross", () => {
    const blocks: HourBlock[] = [
      { date: "2026-09-27", type: "regular", hours: 24, destination: "comp" },
      {
        date: "2026-11-26",
        type: "holidayWorked",
        hours: 24,
        destination: "comp",
      },
      {
        date: "2027-01-18",
        type: "holidayObserved",
        hours: 12,
        destination: "accrue",
      },
    ];
    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(60);
    expect(result.gross).toBe(0);
  });

  it("splits a period spanning a step date: old rate before, new rate at/after", () => {
    // Real FY27 workbook period 14 (2027-03-27..2027-04-09), anniversary
    // 2027-04-01: the sheet prices the whole period at the OLD rate
    // (a known bug, BUILD_PLAN.md Appendix defect #4) — the engine must
    // split it instead.
    const splitProfile: Profile = {
      shift: "A",
      rateSegments: [
        { effectiveFrom: "2026-09-26", hourlyRate: 26.8173, incentiveTotal: 0 },
        {
          effectiveFrom: "2027-04-01",
          hourlyRate: 27.621819,
          incentiveTotal: 0,
        },
      ],
    };
    const blocks: HourBlock[] = [
      "2027-03-27",
      "2027-04-01",
      "2027-04-02",
      "2027-04-07",
      "2027-04-08",
    ].map((date) => ({
      date,
      type: "regular",
      hours: 24,
      destination: "cash",
    }));

    const result = computePeriod(year, splitProfile, blocks);
    expect(result.totalHours).toBe(120);
    expect(result.otHours).toBe(14);

    const oldRatePay = 24 * 26.8173; // 3/27, before the step date
    const newRatePay = 96 * 27.621819; // the other 4 days, at/after it
    // The FLSA premium uses the period's hours-weighted "regular rate"
    // across the split, the same blending computeStepUp uses when
    // step-up and regular hours mix (docs/BUILD_PLAN.md §4) — the sheet
    // itself doesn't split at all (defect #4), so there's no sheet number
    // to match here, only the confirmed rule that it must split.
    const blendedRate = (oldRatePay + newRatePay) / 120;
    const flsaPremium = 14 * 0.5 * blendedRate;
    expect(result.gross).toBeCloseTo(oldRatePay + newRatePay + flsaPremium, 4);

    // Sheet's (buggy) whole-period-at-old-rate total, for contrast —
    // the engine must NOT match this.
    const sheetTotal = 3405.7971;
    expect(result.gross).not.toBeCloseTo(sheetTotal, 2);
  });

  it("computeStepUp returns Step 0 of the covered grade, not a percentage", () => {
    expect(computeStepUp(year, "F2")).toBe(35.3302);
    expect(computeStepUp(year, "F3")).toBe(41.7566);
    expect(computeStepUp(year, "F4")).toBe(48.8773);
  });

  it("blends step-up and regular hours into one FLSA rate when mixed", () => {
    // 4 regular days (96 hrs) at the member's own rate + 1 step-up day
    // (24 hrs, riding up as F2) = 120 total, 14 over the cap.
    const blocks: HourBlock[] = [
      "2026-09-27",
      "2026-09-28",
      "2026-10-03",
      "2026-10-04",
    ].map(
      (date) =>
        ({
          date,
          type: "regular",
          hours: 24,
          destination: "cash",
        }) as HourBlock,
    );
    blocks.push({
      date: "2026-10-09",
      type: "stepUp",
      hours: 24,
      destination: "cash",
      grade: "F2",
    });

    const result = computePeriod(year, flatProfile, blocks);
    expect(result.totalHours).toBe(120);
    expect(result.otHours).toBe(14);

    const stepUpRate = computeStepUp(year, "F2");
    const straight = 96 * 26.8173 + 24 * stepUpRate;
    const blendedRate = (96 * 26.8173 + 24 * stepUpRate) / 120;
    const premium = 14 * 0.5 * blendedRate;
    expect(result.gross).toBeCloseTo(straight + premium, 4);
  });
});
