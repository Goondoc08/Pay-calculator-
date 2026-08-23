import { describe, expect, it } from "vitest";
import fy27Raw from "../data/fy27.json";
import fixtureRaw from "./__fixtures__/fy27-sheet-parity.json";
import { parsePayYear } from "../data/schema";
import { KNOWN_DIVERGENCES } from "./knownDivergences";
import { computePeriod } from "./period";
import { blocksFromFixturePeriod, profileFromFixture } from "./sheetParity";
import type { ShiftLetter } from "./types";

/**
 * Rung one of the two-ladder verification (docs/BUILD_PLAN.md §5): the
 * engine must reproduce the FY27 workbook's own computed totals, to the
 * cent, at the sheet's own inputs — 26 periods x 3 shifts. Every period
 * that doesn't match exactly is a *documented* sheet bug (knownDivergences.ts),
 * asserted to the cent so neither the engine nor a future re-import can
 * silently drift.
 */
describe("sheet parity — FY27, 26 periods x 3 shifts", () => {
  const year = parsePayYear(fy27Raw);
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

          const known = KNOWN_DIVERGENCES[shift][period.n];
          if (known) {
            expect(diff).toBeCloseTo(known.diff, 4);
          } else {
            expect(diff).toBeCloseTo(0, 4);
          }
        });
      }
    });
  }

  it("covers all 78 period comparisons", () => {
    expect(comparisons).toBe(78);
  });
});
