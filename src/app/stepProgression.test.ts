import { describe, expect, it } from "vitest";
import fy26Raw from "../data/fy26.json";
import fy27Raw from "../data/fy27.json";
import { parsePayYear } from "../data/schema";
import {
  computeUpcomingStep,
  gradeLabel,
  matchStep,
  nextAnniversaryOnOrAfter,
  nextGradeUp,
} from "./stepProgression";

const year = parsePayYear(fy27Raw);

describe("matchStep", () => {
  it("matches an exact published rate", () => {
    expect(matchStep(year, "F1", 26.8173)).toBe(0);
  });

  it("matches the closest step to an inexact rate", () => {
    expect(matchStep(year, "F2", 37.4)).toBe(2); // Step 2 is 37.4818
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
  it("projects the next step from grade, step index, and anniversary date", () => {
    const result = computeUpcomingStep(
      year,
      "F1",
      0, // Step 0
      "2020-04-01",
      "2027-01-01",
    );
    expect(result).toEqual({
      nextStepIndex: 1,
      nextRate: 27.6218,
      nextDate: "2027-04-01",
    });
  });

  it("returns null when already at the top step of the grade", () => {
    const table = year.payPlan.F1;
    const result = computeUpcomingStep(
      year,
      "F1",
      table.length - 1,
      "2020-04-01",
      "2027-01-01",
    );
    expect(result).toBeNull();
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

describe("gradeLabel", () => {
  it("names F3/F4 differently per year around the officer-rank merger", () => {
    // FY26: Lieutenant (F3) and Captain (F4) are separate grades under
    // Battalion Chief (F5). FY27 merges them into one Captain grade
    // (still F3) and shifts Battalion Chief down to F4.
    expect(gradeLabel("FY26", "F3")).toBe("Lieutenant (F3)");
    expect(gradeLabel("FY26", "F4")).toBe("Captain (F4)");
    expect(gradeLabel("FY26", "F5")).toBe("Battalion Chief (F5)");

    expect(gradeLabel("FY27", "F3")).toBe("Captain (F3)");
    expect(gradeLabel("FY27", "F4")).toBe("Battalion Chief (F4)");
  });

  it("falls back to the bare grade code for a year it doesn't cover", () => {
    expect(gradeLabel("FY28", "F3")).toBe("F3");
  });
});
