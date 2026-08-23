import type { ShiftLetter } from "./types";

/**
 * Deliberate differences between the engine (correct, per docs/PAY_PLAN.md
 * and docs/BUILD_PLAN.md's confirmed rules) and the FY26 workbook's own
 * computed totals — FY26's counterpart to knownDivergences.ts (FY27), each
 * `engine.gross - sheet.totalPay`, asserted to the cent.
 *
 * FY26's sheet has more overlapping bugs at once than FY27's, resolved into
 * two mechanisms rather than one lookup table:
 *
 * 1. **Longevity baked into FLSA** — every period with OT hours, holiday or
 *    not. The sheet's FLSA formula still carries the
 *    `+ longevity/2912 x otHours x 0.5` term BUILD_PLAN.md's Appendix
 *    already flags as wrong (longevity is paid on its own separate check,
 *    confirmed directly — see docs/PAY_PLAN.md). This profile's longevity
 *    figure is $552: the divergence on every OT period with no holiday in
 *    it is EXACTLY `-(552/2912) x otHours x 0.5` — a closed-form check,
 *    not a lookup table (see `longevityAdjustment` below). Confirms the
 *    engine is right to exclude that term entirely.
 *
 * 2. **Holiday periods** — anywhere a holiday (worked or observed) falls
 *    inside the period, on top of #1. Confirmed present: FY26's Appendix
 *    defect #6 (HO/HW priced at the base rate only, not the effective
 *    rate — the engine correctly uses effective rate throughout, e.g. a
 *    12-hr holiday-observed period's divergence is exactly
 *    `12 x incentiveTotal`) stacked with the same holiday-hours-wrongly-
 *    counted-toward-the-106-cap formula bug already documented for FY27
 *    (Appendix defects #2/#3/#5), further stacked — for periods where a
 *    holiday was worked past the 12-hr entitlement — with the confirmed
 *    12-hr cap on the holiday-worked premium itself (the sheet prices
 *    every worked-holiday hour at 1.5x, uncapped; the engine reverts
 *    hours past 12 to ordinary regular pay). Untangling all three within
 *    a single period's dollar total needs the sheet's own per-holiday
 *    formula reconstructed line by line — real, separable follow-up
 *    work, not done here. These 24 entries are the empirically observed
 *    diffs, locked in as a regression guard with the general cause
 *    named, the same evidentiary standard as FY27's table, without
 *    claiming a symbolic derivation this pass didn't do.
 *
 * Two further entries (A/C period 2 — not B, oddly) diverge from the pure
 * longevity formula by ~$0.075 with no holiday in the period at all —
 * smaller than either mechanism above and not chased down; also locked in
 * as observed (the stored diff is the period's full diff, not just that
 * ~$0.075 residual).
 */

export function longevityAdjustment(otHours: number): number {
  return -(552 / 2912) * otHours * 0.5;
}

export const KNOWN_DIVERGENCES_FY26: Record<
  ShiftLetter,
  Record<number, { diff: number; reason: string }>
> = {
  A: {
    1: { diff: 39.5676, reason: "holiday" }, // Labor Day (observed) 2025-09-01
    2: { diff: -1.402, reason: "unexplained-sub-dollar" },
    7: { diff: 79.1352, reason: "holiday" }, // Thanksgiving pair, worked
    9: { diff: -1612.809, reason: "holiday" }, // Christmas/New Year's, worked
    11: { diff: -707.6469, reason: "holiday" }, // MLK Day, worked
    16: { diff: 39.5676, reason: "holiday" }, // Good Friday (observed)
    20: { diff: -707.6469, reason: "holiday" }, // Memorial Day, worked
    23: { diff: 38.2407, reason: "holiday" }, // Independence Day (observed)
    27: { diff: 509.1207, reason: "holiday" }, // Labor Day 2026, worked
  },
  B: {
    1: { diff: 38.1656, reason: "holiday" },
    7: { diff: -1201.2804, reason: "holiday" },
    9: { diff: 156.9435, reason: "holiday" },
    11: { diff: 39.5676, reason: "holiday" },
    16: { diff: -707.6469, reason: "holiday" },
    20: { diff: 39.5676, reason: "holiday" },
    23: { diff: 39.5676, reason: "holiday" },
    27: { diff: 509.1207, reason: "holiday" },
  },
  C: {
    1: { diff: -707.722, reason: "holiday" },
    2: { diff: -1.402, reason: "unexplained-sub-dollar" },
    7: { diff: 77.8083, reason: "holiday" },
    9: { diff: -332.3934, reason: "holiday" },
    11: { diff: 38.2407, reason: "holiday" },
    16: { diff: 38.2407, reason: "holiday" },
    20: { diff: 38.2407, reason: "holiday" },
    23: { diff: -707.6469, reason: "holiday" },
    27: { diff: 255.2238, reason: "holiday" },
  },
};
