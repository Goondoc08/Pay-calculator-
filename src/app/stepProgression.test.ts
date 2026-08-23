import { describe, expect, it } from "vitest";
import fy26Raw from "../data/fy26.json";
import fy27Raw from "../data/fy27.json";
import { parsePayYear } from "../data/schema";
import {
  computeUpcomingStep,
  matchStep,
  nextAnniversaryOnOrAfter,
  nextGradeUp,
} from "./stepProgression";

const year = parsePayYear(fy27Raw);

describe("matchStep", () => {
  it("matches an exact published rate", () => {
    const result = matchStep(year, "F1", 26.8173);
    expect(result).toEqual({
      stepIndex: 0,
      stepRate: 26.8173,
      approximate: false,
    });
  });

  it("matches the closest step, flagging an inexact match", () => {
    const result = matchStep(year, "F2", 37.4); // Step 2 is 37.4818
    expect(result?.stepIndex).toBe(2);
    expect(result?.approximate).toBe(true);
  });

  it("returns null for a rate nowhere near the table", () => {
    expect(matchStep(year, "F1", 5)).toBeNull();
  });
});

describe("nextAnniversaryOnOrAfter", () => {
  it("advances to next year when this year's date has passed", () => {
    expect(nextAnniversaryOnOrAfter("2020-03-15", "2027-06-01")).toBe(
      "2028-03-15",
    );
  });

  it("keeps this year's date when it hasn't happened yet", () => {
    expect(nextAnniversaryOnOrAfter("2020-11-01", "2027-06-01")).toBe(
      "2027-11-01",
    );
  });

  it("keeps this year's date when it's today", () => {
    expect(nextAnniversaryOnOrAfter("2020-06-01", "2027-06-01")).toBe(
      "2027-06-01",
    );
  });
});

describe("computeUpcomingStep", () => {
  it("projects the next step from grade, rate, and anniversary date", () => {
    const result = computeUpcomingStep(
      year,
      "F1",
      26.8173, // Step 0
      "2020-04-01",
      "2027-01-01",
    );
    expect(result).toEqual({
      currentStepIndex: 0,
      nextStepIndex: 1,
      nextRate: 27.6218,
      nextDate: "2027-04-01",
      approximateMatch: false,
    });
  });

  it("returns null when already at the top step of the grade", () => {
    const table = year.payPlan.F1;
    const topRate = table[table.length - 1];
    const result = computeUpcomingStep(
      year,
      "F1",
      topRate,
      "2020-04-01",
      "2027-01-01",
    );
    expect(result).toBeNull();
  });

  it("returns null when the rate doesn't match the grade's table", () => {
    expect(
      computeUpcomingStep(year, "F1", 5, "2020-04-01", "2027-01-01"),
    ).toBeNull();
  });
});

describe("nextGradeUp", () => {
  it("returns the grade directly above the member's own", () => {
    expect(nextGradeUp(year, "F1")).toBe("F2");
    expect(nextGradeUp(year, "F2")).toBe("F3");
    expect(nextGradeUp(year, "F3")).toBe("F4");
  });

  it("returns null at the year's top grade (FY27 has no F5)", () => {
    expect(nextGradeUp(year, "F4")).toBeNull();
  });

  it("reads grade order from the year file, not a fixed 4-grade list", () => {
    // FY26 has 5 grades; F4 -> F5 only makes sense read from its own table.
    const fy26 = parsePayYear(fy26Raw);
    expect(nextGradeUp(fy26, "F4")).toBe("F5");
    expect(nextGradeUp(fy26, "F5")).toBeNull();
  });
});
