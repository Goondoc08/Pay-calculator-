import { describe, expect, it } from "vitest";
import fy26Raw from "./fy26.json";
import { parsePayYear } from "./schema";

describe("fy26.json", () => {
  it("validates against the PayYear schema", () => {
    expect(() => parsePayYear(fy26Raw)).not.toThrow();
  });

  const year = parsePayYear(fy26Raw);

  it("covers FY26's window as 28 fourteen-day periods, ending right where FY27 begins", () => {
    // FY26's own workbook calendar runs a few periods past 2026-09-26 (where
    // FY27 already owns the periods) — the importer was given that cutoff
    // explicitly (BUILD_PLAN.md's cutover date) so the two years don't
    // overlap. 28 periods, not FY27's 26, because FY26 bridges the gap
    // between the old FY-start-aligned calendar and FY27's fixed date.
    expect(year.periods).toHaveLength(28);
    expect(year.periods[0].start).toBe("2025-08-30");
    expect(year.periods[27].end).toBe("2026-09-25");
    expect(year.effectiveFrom).toBe(year.periods[0].start);
    expect(year.effectiveTo).toBe(year.periods[27].end);
    expect(year.effectiveTo).toBe("2026-09-25");
  });

  it("has no gaps or overlaps between consecutive periods", () => {
    for (let i = 1; i < year.periods.length; i += 1) {
      const prevEnd = new Date(`${year.periods[i - 1].end}T00:00:00Z`);
      const nextStart = new Date(`${year.periods[i].start}T00:00:00Z`);
      const diffDays = (nextStart.getTime() - prevEnd.getTime()) / 86_400_000;
      expect(diffDays).toBe(1);
    }
  });

  it("extracted 12 holiday dates from the calendar fill color", () => {
    // Names are inferred (date-based rules, incl. a Good Friday
    // calculation) but NOT cross-checked against an official department
    // memo the way FY27's are (fy27.test.ts) — no "2025/2026 Holiday
    // Calendar" memo has been supplied yet.
    expect(year.holidays).toHaveLength(12);
    expect(year.holidays.every((h) => h.hours === 12)).toBe(true);
  });

  it("carries both Labor Days a ~13-month bridge year spans", () => {
    const dates = year.holidays.map((h) => h.date);
    expect(dates).toContain("2025-09-01");
    expect(dates).toContain("2026-09-07");
  });

  it("matches the official FY26 pay plan (docs/PAY_PLAN.md), including F5", () => {
    expect(year.payPlan.F1[0]).toBe(25.2779);
    expect(year.payPlan.F2[0]).toBe(33.3021);
    expect(year.payPlan.F3[0]).toBe(37.8458);
    expect(year.payPlan.F4[0]).toBe(43.0093);
    expect(year.payPlan.F5[0]).toBe(48.8773);
  });

  it("uses the confirmed 106-hour FLSA threshold", () => {
    expect(year.flsaThresholdHours).toBe(106);
  });
});
