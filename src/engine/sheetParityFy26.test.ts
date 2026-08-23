import { describe, expect, it } from "vitest";
import fy26Raw from "../data/fy26.json";
import fixtureRaw from "./__fixtures__/fy26-sheet-parity.json";
import { parsePayYear } from "../data/schema";
import { expectedFy26Divergence } from "./knownDivergencesFy26";
import { computePeriod } from "./period";
import { blocksFromFixturePeriod, profileFromFixture } from "./sheetParity";
import type { ShiftLetter } from "./types";

/**
 * FY26's counterpart to sheetParity.test.ts. Every one of the 84 comparisons
 * (28 periods x 3 shifts) is either exact to the cent or exactly predicted by
 * `expectedFy26Divergence` — a closed-form account of three specific defects
 * in the workbook, with no observed-magic-number entries and no residual
 * bucket. See knownDivergencesFy26.ts for what those three defects are.
 */
describe("sheet parity — FY26, 28 periods x 3 shifts", () => {
  const year = parsePayYear(fy26Raw);
  const holidayDates = new Set(year.holidays.map((h) => h.date));
  const shiftLetters: ShiftLetter[] = ["A", "B", "C"];

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
              longevity: number;
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

          const expected = expectedFy26Divergence({
            periodN: period.n,
            otHours: period.summary.otHours,
            blocks,
            hourlyRate: shiftFixture.profile.rate,
            incentive: shiftFixture.profile.incentive,
            longevity: shiftFixture.profile.longevity,
          });

          expect(diff).toBeCloseTo(expected, 2);
        });
      }
    });
  }

  it("covers all 84 period comparisons", () => {
    expect(comparisons).toBe(84);
  });
});
