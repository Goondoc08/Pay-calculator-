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
 * - "holiday-cap": the sheet's hand-wired per-holiday formulas (Appendix
 *   defects #2/#3/#5) count holiday-worked/holiday-observed hours toward
 *   the 106-hr FLSA cap, when the confirmed rule (BUILD_PLAN.md §5, a real
 *   check) is that they must not. Always a negative diff — the sheet
 *   overcounts hours toward OT the engine correctly excludes. Magnitude
 *   scales with how many holiday dates fall in the period (one vs. a
 *   back-to-back pair, e.g. Thanksgiving + the day after).
 */
export const KNOWN_DIVERGENCES: Record<
  ShiftLetter,
  Record<number, { diff: number; reason: string }>
> = {
  A: {
    5: { diff: -509.5287, reason: "holiday-cap" }, // Thanksgiving + day after, both worked
    7: { diff: -348.6249, reason: "holiday-cap" }, // Christmas Eve + Christmas Day
    13: { diff: -348.6249, reason: "holiday-cap" }, // Good Friday (2027-03-26) + adjacent
    14: { diff: 81.7391, reason: "step-split" },
    18: { diff: -165.7309, reason: "holiday-cap" }, // Memorial Day
  },
  B: {
    14: { diff: 61.3043, reason: "step-split" },
    25: { diff: -165.7309, reason: "holiday-cap" }, // Labor Day
  },
  C: {
    7: { diff: -670.4325, reason: "holiday-cap" }, // Christmas Eve/Day + New Year's Eve/Day, all four
    9: { diff: -348.6249, reason: "holiday-cap" }, // MLK Day (observed, not worked)
    14: { diff: 38.6169, reason: "step-split" },
    21: { diff: -359.0836, reason: "holiday-cap" }, // Independence Day
  },
};
