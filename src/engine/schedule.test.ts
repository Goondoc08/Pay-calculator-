import { describe, expect, it } from "vitest";
import fy27Raw from "../data/fy27.json";
import { parsePayYear } from "../data/schema";
import { buildSchedule, scheduledHoursOn } from "./schedule";

const year = parsePayYear(fy27Raw);

describe("scheduledHoursOn", () => {
  it("matches the workbook's known on-days for A-shift", () => {
    expect(scheduledHoursOn(year, "A", "2026-09-27")).toBe(24);
    expect(scheduledHoursOn(year, "A", "2026-09-28")).toBe(24);
    expect(scheduledHoursOn(year, "A", "2026-09-29")).toBe(0);
    expect(scheduledHoursOn(year, "A", "2026-10-03")).toBe(24);
  });

  it("matches the workbook's known on-days for B-shift", () => {
    expect(scheduledHoursOn(year, "B", "2026-09-29")).toBe(24);
    expect(scheduledHoursOn(year, "B", "2026-09-30")).toBe(24);
    expect(scheduledHoursOn(year, "B", "2026-10-01")).toBe(0);
  });

  it("matches the workbook's known on-days for C-shift", () => {
    expect(scheduledHoursOn(year, "C", "2026-09-26")).toBe(24);
    expect(scheduledHoursOn(year, "C", "2026-09-27")).toBe(0);
    expect(scheduledHoursOn(year, "C", "2026-10-01")).toBe(24);
    expect(scheduledHoursOn(year, "C", "2026-10-02")).toBe(24);
  });
});

describe("buildSchedule", () => {
  it("produces 2928 worked hours for A-shift across FY27 (2928 hrs/yr)", () => {
    const days = buildSchedule(year, "A");
    const total = days.reduce((sum, d) => sum + d.hours, 0);
    expect(total).toBe(2928);
  });

  it("produces 2904 worked hours for B and C shifts (2904 hrs/yr)", () => {
    expect(buildSchedule(year, "B").reduce((sum, d) => sum + d.hours, 0)).toBe(
      2904,
    );
    expect(buildSchedule(year, "C").reduce((sum, d) => sum + d.hours, 0)).toBe(
      2904,
    );
  });
});
