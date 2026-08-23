import type { PayYear } from "../data/schema";
import type { PayGrade } from "../engine/types";

/**
 * Finds the closest step in a grade's table to a previously-saved base rate
 * (no incentives) — used only to pick a sensible default selection when
 * Setup opens on an existing profile. Setup itself no longer takes a typed
 * rate (members know their step, not their HR hourly rate to four decimal
 * places), so there's nothing left to "mismatch": the step picker always
 * produces an exact published rate. Returns null if the table's empty or
 * the saved rate is nowhere close to any step in it (e.g. old data from a
 * custom/negotiated rate, or a grade whose table has since changed).
 */
export function matchStep(
  year: PayYear,
  grade: PayGrade,
  hourlyRate: number,
): number | null {
  const table = year.payPlan[grade];
  if (!table || table.length === 0) return null;

  let bestIndex = 0;
  let bestDiff = Math.abs(table[0] - hourlyRate);
  for (let i = 1; i < table.length; i += 1) {
    const diff = Math.abs(table[i] - hourlyRate);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  // Steps are typically ~$1/hr apart; anything further than that isn't a
  // plausible match at all, just the least-wrong entry in the table.
  return bestDiff > 1 ? null : bestIndex;
}

/** The next occurrence of `anniversary`'s month/day that falls on or after
 * `today` — i.e. "when does their next step land, from here." */
export function nextAnniversaryOnOrAfter(
  anniversary: string,
  today: string,
): string {
  const anniv = new Date(`${anniversary}T00:00:00Z`);
  const ref = new Date(`${today}T00:00:00Z`);

  const candidate = new Date(
    Date.UTC(ref.getUTCFullYear(), anniv.getUTCMonth(), anniv.getUTCDate()),
  );
  if (candidate.getTime() < ref.getTime()) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate.toISOString().slice(0, 10);
}

export interface UpcomingStep {
  nextStepIndex: number;
  nextRate: number;
  nextDate: string;
}

/**
 * Projects a member's next step from their current grade/step and their
 * hire-or-most-recent-promotion date — the civil-service rule that step
 * progression lands on that personal anniversary, not a shared fiscal-year
 * date (docs/PAY_PLAN.md). Returns null if they're already at the top step.
 */
export function computeUpcomingStep(
  year: PayYear,
  grade: PayGrade,
  currentStepIndex: number,
  anniversaryDate: string,
  today: string,
): UpcomingStep | null {
  const table = year.payPlan[grade];
  const nextIndex = currentStepIndex + 1;
  if (!table || nextIndex >= table.length) return null; // already at the top step

  return {
    nextStepIndex: nextIndex,
    nextRate: table[nextIndex],
    nextDate: nextAnniversaryOnOrAfter(anniversaryDate, today),
  };
}

/**
 * The grade a member rides up into by default — always the one directly
 * above their own, at its Step 0 (docs/PAY_PLAN.md: step-up always covers
 * Step 0 of the covered grade, regardless of the member's own step — e.g.
 * an F2 at Step 4 riding up covers F3 Step 0, not F2's own next step).
 * Grade order comes from the year file's own payPlan keys (FY26 has
 * F1..F5, FY27's proposed merger drops it to F1..F4), not a fixed list.
 * Returns null if the member's grade is already the top grade for the
 * year, or isn't one of the year's grades at all.
 */
export function nextGradeUp(year: PayYear, grade: PayGrade): PayGrade | null {
  const grades = Object.keys(year.payPlan) as PayGrade[];
  const index = grades.indexOf(grade);
  if (index === -1 || index + 1 >= grades.length) return null;
  return grades[index + 1];
}

export const GRADE_LABELS: Record<string, string> = {
  F1: "Fire Fighter (F1)",
  F2: "Driver/Operator (F2)",
  F3: "Lieutenant / Captain (F3)",
  F4: "Battalion Chief (F4)",
  F5: "Battalion Chief (F5)",
};
