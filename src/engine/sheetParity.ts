import type { PayYear } from "../data/schema";
import { addDays, scheduledHoursOn } from "./schedule";
import type { HourBlock, Profile, ShiftLetter } from "./types";

export interface FixturePeriod {
  n: number;
  start: string;
  end: string;
  dayHours: Record<string, number>;
  summary: {
    totalHours: number;
    otHours: number;
    straightPay: number;
    flsaPay: number;
    totalPay: number;
  };
}

export interface FixtureProfile {
  rate: number;
  incentive: number;
  anniversaryDate: string | null;
  anniversaryNewRate: number | null;
}

export function profileFromFixture(
  shift: ShiftLetter,
  year: PayYear,
  fixtureProfile: FixtureProfile,
): Profile {
  const rateSegments: Profile["rateSegments"] = [
    {
      effectiveFrom: year.effectiveFrom,
      hourlyRate: fixtureProfile.rate,
      incentiveTotal: fixtureProfile.incentive,
    },
  ];
  if (fixtureProfile.anniversaryDate && fixtureProfile.anniversaryNewRate) {
    rateSegments.push({
      effectiveFrom: fixtureProfile.anniversaryDate,
      hourlyRate: fixtureProfile.anniversaryNewRate,
      incentiveTotal: fixtureProfile.incentive,
    });
  }
  return { shift, rateSegments };
}

/** The standard holiday-off entitlement, and the cap on the holiday-worked
 * premium itself — confirmed directly: working more than 12 hrs of a
 * holiday doesn't earn more premium, the excess is just an ordinary
 * regular day past that point (src/app/period.ts carries the same rule
 * for the interface). */
const HOLIDAY_ENTITLEMENT_HOURS = 12;

/**
 * Reconstructs typed hour blocks from the workbook's own worked-day cells:
 * a worked day on a holiday date is holiday-worked (capped at the 12-hr
 * entitlement; any excess is an ordinary regular block); a holiday date
 * the shift didn't work (and that isn't already a worked-day cell) is a
 * 12-hr holiday-observed block, matching how the sheet auto-populates
 * HO/HW from the schedule intersected with the holiday calendar
 * (docs/BUILD_PLAN.md Appendix).
 */
export function blocksFromFixturePeriod(
  year: PayYear,
  shift: ShiftLetter,
  holidayDates: ReadonlySet<string>,
  period: FixturePeriod,
): HourBlock[] {
  const blocks: HourBlock[] = [];

  for (const [date, hours] of Object.entries(period.dayHours)) {
    if (holidayDates.has(date)) {
      const hwHours = Math.min(hours, HOLIDAY_ENTITLEMENT_HOURS);
      if (hwHours > 0) {
        blocks.push({
          date,
          type: "holidayWorked",
          hours: hwHours,
          destination: "cash",
        });
      }
      const excessRegularHours = Math.max(0, hours - HOLIDAY_ENTITLEMENT_HOURS);
      if (excessRegularHours > 0) {
        blocks.push({
          date,
          type: "regular",
          hours: excessRegularHours,
          destination: "cash",
        });
      }
    } else {
      blocks.push({ date, type: "regular", hours, destination: "cash" });
    }
  }

  let cur = period.start;
  while (cur <= period.end) {
    const alreadyWorked = cur in period.dayHours;
    if (
      holidayDates.has(cur) &&
      !alreadyWorked &&
      scheduledHoursOn(year, shift, cur) === 0
    ) {
      blocks.push({
        date: cur,
        type: "holidayObserved",
        hours: HOLIDAY_ENTITLEMENT_HOURS,
        destination: "cash",
      });
    }
    cur = addDays(cur, 1);
  }

  return blocks;
}
