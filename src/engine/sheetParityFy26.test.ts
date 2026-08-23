import { describe, expect, it } from "vitest";
import fy26Raw from "../data/fy26.json";
import fixtureRaw from "./__fixtures__/fy26-sheet-parity.json";
import { parsePayYear } from "../data/schema";
import {
  KNOWN_DIVERGENCES_FY26,
  longevityAdjustment,
} from "./knownDivergencesFy26";
import { computePeriod } from "./period";
import { addDays } from "./schedule";
import { blocksFromFixturePeriod, profileFromFixture } from "./sheetParity";
import type { ShiftLetter } from "./types";

/**
 * FY26's counterpart to sheetParity.test.ts. Every non-holiday period
 * matches the sheet exactly once the sheet's own longevity-in-FLSA term is
 * accounted for (a closed-form adjustment, not a lookup — see
 * knownDivergencesFy26.ts); every holiday period matches a locked-in
 * observed divergence. 84 comparisons (28 periods x 3 shifts) — more than
 * FY27's 78 because FY26 is the longer bridge year (BUILD_PLAN.md).
 */
describe("sheet parity — FY26, 28 periods x 3 shifts", () => {
  const year = parsePayYear(fy26Raw);
  const holidayDates = new Set(year.holidays.map((h) => h.date));
  const shiftLetters: ShiftLetter[] = ["A", "B", "C"];

  function periodContainsHoliday(start: string, end: string): boolean {
    let cur = start;
    while (cur <= end) {
      if (holidayDates.has(cur)) return true;
      cur = addDays(cur, 1);
    }
    return false;
  }

  let comparisons = 0;

  for (const shift of shiftLetters) {
    const shiftFixture = (
      fixtureRaw as unknown as {
        shifts: Record<
          ShiftLetter,
          {
            profile: {
              rate: number;
              incentive: number;
              anniversaryDate: string | null;
              anniversaryNewRate: number | null;
            };
            periods: {
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
            }[];
          }
        >;
      }
    ).shifts[shift];

    const profile = profileFromFixture(shift, year, shiftFixture.profile);

    describe(`${shift}-shift`, () => {
      for (const period of shiftFixture.periods) {
        it(`period ${period.n} (${period.start}..${period.end}) matches the sheet, or a documented divergence`, () => {
          comparisons += 1;
          const blocks = blocksFromFixturePeriod(
            year,
            shift,
            holidayDates,
            period,
          );
          const result = computePeriod(year, profile, blocks);
          const diff = result.gross - period.summary.totalPay;

          const known = KNOWN_DIVERGENCES_FY26[shift][period.n];
          if (known) {
            expect(diff).toBeCloseTo(known.diff, 2);
          } else if (periodContainsHoliday(period.start, period.end)) {
            throw new Error(
              `Period ${period.n} contains a holiday but has no KNOWN_DIVERGENCES_FY26 entry — ` +
                `either it now matches the sheet exactly (remove this assumption) or a new ` +
                `divergence appeared (diff=${diff.toFixed(4)}, add it to the table).`,
            );
          } else {
            expect(diff).toBeCloseTo(
              longevityAdjustment(period.summary.otHours),
              2,
            );
          }
        });
      }
    });
  }

  it("covers all 84 period comparisons", () => {
    expect(comparisons).toBe(84);
  });
});
