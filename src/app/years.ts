import fy27Raw from "../data/fy27.json";
import { parsePayYear, type PayYear } from "../data/schema";

const YEAR_FILES: Record<string, unknown> = {
  FY27: fy27Raw,
};

const YEARS: Record<string, PayYear> = Object.fromEntries(
  Object.entries(YEAR_FILES).map(([id, raw]) => [id, parsePayYear(raw)]),
);

/** Newest-first, so an auto-resolve prefers the most recent year on a tie. */
export const AVAILABLE_YEARS: PayYear[] = Object.values(YEARS).sort((a, b) =>
  a.effectiveFrom < b.effectiveFrom ? 1 : -1,
);

export function getYear(id: string): PayYear | undefined {
  return YEARS[id];
}

/**
 * The year whose effective window contains `today`. Falls back to the
 * closest year (earliest if today is before everything, latest if today is
 * after everything) so the app always has something to show rather than a
 * blank screen while only one year file exists yet.
 */
export function resolveActiveYear(today: string): PayYear {
  const containing = AVAILABLE_YEARS.find(
    (y) => y.effectiveFrom <= today && today <= y.effectiveTo,
  );
  if (containing) return containing;

  const future = AVAILABLE_YEARS.filter((y) => y.effectiveFrom > today);
  if (future.length > 0) {
    return future.reduce((earliest, y) =>
      y.effectiveFrom < earliest.effectiveFrom ? y : earliest,
    );
  }

  return AVAILABLE_YEARS.reduce((latest, y) =>
    y.effectiveTo > latest.effectiveTo ? y : latest,
  );
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
