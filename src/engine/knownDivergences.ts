import type { ShiftLetter } from "./types";

/**
 * Deliberate differences between the engine (correct, per docs/PAY_PLAN.md
 * and docs/BUILD_PLAN.md's confirmed rules) and the FY27 workbook's own
 * computed totals (docs/BUILD_PLAN.md Appendix defects). Each entry is
 * `engine.gross - sheet.totalPay`, asserted to the cent so a regression in
 * either the engine or a future re-import shows up immediately.
 *
 * Two categories account for all 11 divergent periods (of 78):
 *
 * - "step-split": the sheet applies an anniversary raise to the whole
 *   period based on the period's start date (Appendix defect #4) instead
 *   of splitting at the step date. Always a positive diff — splitting
 *   correctly raises part of the period to the higher rate.
 *
 * - "holiday-cap": two compounding effects, both making the engine's total
 *   *lower* than the sheet's for a holiday-worked period:
 *   1. The sheet's hand-wired per-holiday formulas (Appendix defects
 *      #2/#3/#5) count holiday-worked/holiday-observed hours toward the
 *      106-hr FLSA cap, when the confirmed rule (BUILD_PLAN.md §5, a real
 *      check) is that they must not.
 *   2. The holiday-worked premium itself is capped at the 12-hr
 *      entitlement (confirmed directly) — hours worked past 12 revert to
 *      ordinary regular pay, which the sheet's formulas never modeled at
 *      all (they price every worked-holiday hour at 1.5x, uncapped).
 *   Magnitude scales with how many holiday dates fall in the period and
 *   how many hours were worked past 12 on each.
 */
export const KNOWN_DIVERGENCES: Record<
  ShiftLetter,
  Record<number, { diff: number; reason: string }>
> = {
  A: {
    5: { diff: -831.3363, reason: "holiday-cap" }, // Thanksgiving + day after, both worked
    7: { diff: -482.7114, reason: "holiday-cap" }, // Christmas Eve + Christmas Day
    13: { diff: -482.7114, reason: "holiday-cap" }, // Good Friday (2027-03-26) + adjacent
    14: { diff: 81.7391, reason: "step-split" },
    18: { diff: -331.4618, reason: "holiday-cap" }, // Memorial Day
  },
  B: {
    14: { diff: 61.3043, reason: "step-split" },
    25: { diff: -331.4618, reason: "holiday-cap" }, // Labor Day
  },
  C: {
    7: { diff: -1153.1439, reason: "holiday-cap" }, // Christmas Eve/Day + New Year's Eve/Day, all four
    9: { diff: -482.7114, reason: "holiday-cap" }, // MLK Day (observed, not worked)
    14: { diff: 38.6169, reason: "step-split" },
    21: { diff: -497.1927, reason: "holiday-cap" }, // Independence Day
  },
};
