import { describe, expect, it } from "vitest";
import fy27Raw from "./fy27.json";
import { parsePayYear } from "./schema";

describe("fy27.json", () => {
  it("validates against the PayYear schema", () => {
    expect(() => parsePayYear(fy27Raw)).not.toThrow();
  });

  const year = parsePayYear(fy27Raw);

  it("covers the full fiscal year as 26 fourteen-day periods", () => {
    expect(year.periods).toHaveLength(26);
    expect(year.periods[0].start).toBe("2026-09-26");
    expect(year.periods[25].end).toBe("2027-09-24");
    expect(year.effectiveFrom).toBe(year.periods[0].start);
    expect(year.effectiveTo).toBe(year.periods[25].end);
  });

  it("has no gaps or overlaps between consecutive periods", () => {
    for (let i = 1; i < year.periods.length; i += 1) {
      const prevEnd = new Date(`${year.periods[i - 1].end}T00:00:00Z`);
      const nextStart = new Date(`${year.periods[i].start}T00:00:00Z`);
      const diffDays = (nextStart.getTime() - prevEnd.getTime()) / 86_400_000;
      expect(diffDays).toBe(1);
    }
  });

  it("extracted 11 holiday dates from the calendar fill color", () => {
    expect(year.holidays).toHaveLength(11);
    expect(year.holidays.every((h) => h.hours === 12)).toBe(true);
  });

  it("holiday names match the City of Pearland's official 2027 holiday memo", () => {
    // Confirmed 2026-08-22 against "2027 Holiday Calendar" (HR, 2026-07-06).
    // Independence Day and the Nov/Dec 2026 dates use the ACTUAL calendar
    // date, not the memo's M-F "observed" shift — fire crews are paid
    // holiday pay for the date their tour actually covers, confirmed
    // directly (e.g. a holiday landing on a Sunday still pays for the
    // Sunday worked, not the following Monday).
    const byDate = Object.fromEntries(
      year.holidays.map((h) => [h.date, h.name]),
    );
    expect(byDate["2027-01-01"]).toBe("New Year's Day");
    expect(byDate["2027-01-18"]).toBe("Martin Luther King Jr. Day");
    expect(byDate["2027-03-26"]).toBe("Good Friday");
    expect(byDate["2027-05-31"]).toBe("Memorial Day");
    expect(byDate["2027-07-04"]).toBe("Independence Day");
    expect(byDate["2027-09-06"]).toBe(
      "Labor Day / September 11th Memorial Day",
    );
  });

  it("matches the official FY27 pay plan (docs/PAY_PLAN.md)", () => {
    expect(year.payPlan.F1[0]).toBe(26.8173);
    expect(year.payPlan.F2[0]).toBe(35.3302);
    expect(year.payPlan.F3[0]).toBe(41.7566);
    expect(year.payPlan.F4[0]).toBe(48.8773);
  });

  it("uses the confirmed 106-hour FLSA threshold", () => {
    expect(year.flsaThresholdHours).toBe(106);
  });
});
