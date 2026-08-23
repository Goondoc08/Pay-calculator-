import type { ShiftLetter } from "./types";

/**
 * Deliberate differences between the engine and the FY27 workbook's own
 * computed totals. Each entry is `engine.gross - sheet.totalPay`, asserted to
 * the cent so a regression in either the engine or a future re-import shows
 * up immediately.
 *
 * After rebuilding the engine from the workbook's own formulas, 75 of 78
 * periods match exactly. The three that remain share one cause:
 *
 * - "step-split": the sheet applies an anniversary raise to the WHOLE period
 *   based on the period's start date — its straight-pay cell is
 *   `IF($P$2>A_start, ...old rate..., ...new rate...)`, an all-or-nothing
 *   switch. The engine instead prices each day against its own date, so a
 *   period spanning the step date is split proportionally. Always a positive
 *   diff, because splitting correctly moves part of the period up to the
 *   higher rate.
 *
 * This one is a divergence the engine is RIGHT about and the sheet's author
 * knew it: FY26's summary rows carry the note "<--- Will not be accurate due
 * to different pay rates" beside exactly this situation. Kept as a lookup
 * table rather than a formula because it depends on where the step date falls
 * within the period, which the fixture doesn't otherwise expose.
 */
export const KNOWN_DIVERGENCES: Record<
  ShiftLetter,
  Record<number, { diff: number; reason: string }>
> = {
  A: {
    14: { diff: 81.7391, reason: "step-split" },
  },
  B: {
    14: { diff: 61.3043, reason: "step-split" },
  },
  C: {
    14: { diff: 38.6169, reason: "step-split" },
  },
};
