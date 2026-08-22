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

/**
 * Reconstructs typed hour blocks from the workbook's own worked-day cells:
 * a worked day on a holiday date is holiday-worked; a holiday date the
 * shift didn't work (and that isn't already a worked-day cell) is a 12-hr
 * holiday-observed block, matching how the sheet auto-populates HO/HW from
 * the schedule intersected with the holiday calendar (docs/BUILD_PLAN.md
 * Appendix).
 */
export function blocksFromFixturePeriod(
  year: PayYear,
  shift: ShiftLetter,
  holidayDates: ReadonlySet<string>,
  period: FixturePeriod,
): HourBlock[] {
  const blocks: HourBlock[] = [];

  for (const [date, hours] of Object.entries(period.dayHours)) {
    blocks.push({
      date,
      type: holidayDates.has(date) ? "holidayWorked" : "regular",
      hours,
      destination: "cash",
    });
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
        hours: 12,
        destination: "cash",
      });
    }
    cur = addDays(cur, 1);
  }

  return blocks;
}
