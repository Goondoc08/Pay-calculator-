import type { HourBlock } from "./types";

/**
 * Deliberate differences between the engine and the FY26 workbook's own
 * computed totals — `engine.gross - sheet.totalPay`, asserted to the cent.
 *
 * Unlike the first pass at this file, every FY26 divergence is now accounted
 * for in CLOSED FORM by three named defects in the sheet. Nothing here is an
 * empirically-observed magic number, and there is no residual bucket: 84 of
 * 84 periods are either exact or exactly predicted by the formulas below.
 *
 * That became possible once the engine was rebuilt from the workbook's own
 * formulas rather than from an assumed set of rules. The three defects:
 *
 * 1. **HO/HW priced at base rate only.** FY26's straight-pay cell reads
 *    `J*(rate+inc) + HO*rate + HW*rate*1.5` — the holiday codes omit the
 *    incentive that every other hour receives. FY27 corrects this to
 *    `HO*(rate+inc)`, and a real Christmas-period paystub settles it: RG
 *    (106 hrs) and HW (36 hrs) are priced off the same effective rate, and
 *    RG + HW is exactly the stated gross. So the engine is right to use the
 *    effective rate, and runs high by `(HO + 1.5*HW) * incentive`.
 *
 * 2. **Longevity divisor typo in periods 1-2.** Those two summary rows
 *    divide the longevity payoff by 2756 instead of 2912 (52 weeks x 56 hrs
 *    on a 48/96 rotation). The sheet uses 2912 from period 3 onward, so this
 *    is a typo it corrects against itself rather than a rule.
 *
 * 3. **Period 27 never references its holiday cells.** The summary row for
 *    the final period computes straight pay as
 *    `SUM(J85*(...) + (J83*$L$3) + (K83*$L$3*1.5))` — but that period's HO/HW
 *    formulas live in row **84**, not 83. Rows 83/84 are blank in those
 *    columns, so Labor Day 2026-09-07 silently evaluates to zero and drops
 *    out of the check entirely. Every other holiday period references the
 *    correct row. Real money: ~$510 on A/B shift, ~$766 on C.
 *
 * Defect 3 is the one worth telling a human about — it's a live arithmetic
 * error in a sheet people are using to check their pay, not a modelling
 * difference.
 */

/** 52 weeks x 56 hrs on a 48/96 rotation — the correct annualization. */
const CORRECT_DIVISOR = 2912;
/** What periods 1-2 use instead. */
const TYPO_DIVISOR = 2756;
/** Periods whose summary row carries the typo'd divisor. */
const TYPO_PERIODS = new Set([1, 2]);
/** The period whose summary row points at the wrong HO/HW rows. */
const DROPPED_HOLIDAY_PERIOD = 27;

export interface Fy26DivergenceInputs {
  periodN: number;
  otHours: number;
  /** The period's reconstructed blocks, for its HO/HW hour totals. */
  blocks: HourBlock[];
  hourlyRate: number;
  incentive: number;
  longevity: number;
}

function holidayHours(blocks: HourBlock[]) {
  let ho = 0;
  let hw = 0;
  for (const b of blocks) {
    if (b.type === "holidayObserved") ho += b.hours;
    else if (b.type === "holidayWorked") hw += b.hours;
  }
  return { ho, hw };
}

/**
 * The exact expected value of `engine.gross - sheet.totalPay` for one FY26
 * period. Returns 0 when the engine should agree with the sheet to the cent.
 */
export function expectedFy26Divergence({
  periodN,
  otHours,
  blocks,
  hourlyRate,
  incentive,
  longevity,
}: Fy26DivergenceInputs): number {
  const { ho, hw } = holidayHours(blocks);
  // HW carries a 1.5x premium, so an incentive omission there costs 1.5x too.
  const holidayRateUnits = ho + 1.5 * hw;

  // Defect 3: the sheet drops these holiday hours entirely, so the engine is
  // ahead by their whole value, not just the incentive portion.
  if (periodN === DROPPED_HOLIDAY_PERIOD) {
    return holidayRateUnits * (hourlyRate + incentive);
  }

  // Defect 1: incentive omitted from HO/HW.
  let diff = holidayRateUnits * incentive;

  // Defect 2: longevity annualized over the wrong hour count.
  if (TYPO_PERIODS.has(periodN)) {
    diff +=
      otHours * 0.5 * longevity * (1 / CORRECT_DIVISOR - 1 / TYPO_DIVISOR);
  }

  return diff;
}
