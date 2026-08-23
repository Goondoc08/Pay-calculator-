import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getYear, resolveActiveYear, todayIso } from "./years";

describe("resolveActiveYear", () => {
  it("returns FY26 for a date inside its window", () => {
    expect(resolveActiveYear("2026-01-01").id).toBe("FY26");
  });

  it("returns FY27 for a date inside its window", () => {
    expect(resolveActiveYear("2027-01-01").id).toBe("FY27");
  });

  it("switches from FY26 to FY27 exactly at the cutover date", () => {
    expect(resolveActiveYear("2026-09-25").id).toBe("FY26");
    expect(resolveActiveYear("2026-09-26").id).toBe("FY27");
  });

  it("falls back to the earliest future year when today is before every year", () => {
    expect(resolveActiveYear("2020-01-01").id).toBe("FY26");
  });

  it("falls back to the latest year when today is after every year", () => {
    expect(resolveActiveYear("2099-01-01").id).toBe("FY27");
  });
});

describe("cutover at the real system clock (BUILD_PLAN.md Phase 07 gate)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves to FY26 the instant before the cutover, in the phone's own clock", () => {
    // 2026-09-25 23:59:59 local time — one second before FY27 takes over.
    vi.setSystemTime(new Date(2026, 8, 25, 23, 59, 59));
    expect(resolveActiveYear(todayIso()).id).toBe("FY26");
  });

  it("resolves to FY27 the instant of the cutover, with no update or reinstall", () => {
    // 2026-09-26 00:00:00 local time — the moment FY27 takes over.
    vi.setSystemTime(new Date(2026, 8, 26, 0, 0, 0));
    expect(resolveActiveYear(todayIso()).id).toBe("FY27");
  });
});

describe("getYear", () => {
  it("returns undefined for an unknown year id", () => {
    expect(getYear("FY99")).toBeUndefined();
  });

  it("returns both known years", () => {
    expect(getYear("FY26")?.id).toBe("FY26");
    expect(getYear("FY27")?.id).toBe("FY27");
  });
});
