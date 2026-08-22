import { describe, expect, it } from "vitest";
import { getYear, resolveActiveYear } from "./years";

describe("resolveActiveYear", () => {
  it("returns FY27 for a date inside its window", () => {
    expect(resolveActiveYear("2027-01-01").id).toBe("FY27");
  });

  it("falls back to the earliest future year when today is before every year", () => {
    // Today (this repo's build date) is before FY27 starts; only FY27
    // exists, so it should still resolve to FY27 rather than throwing.
    expect(resolveActiveYear("2026-01-01").id).toBe("FY27");
  });

  it("falls back to the latest year when today is after every year", () => {
    expect(resolveActiveYear("2099-01-01").id).toBe("FY27");
  });
});

describe("getYear", () => {
  it("returns undefined for an unknown year id", () => {
    expect(getYear("FY99")).toBeUndefined();
  });
});
