import fy26Raw from "../data/fy26.json";
import fy27Raw from "../data/fy27.json";
import { parsePayYear, type PayYear } from "../data/schema";

const YEAR_FILES: Record<string, unknown> = {
  FY26: fy26Raw,
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

/**
 * Today's date, in the device's own local calendar day — not UTC. A member
 * checks this app on their phone, in their own timezone; `toISOString()`
 * would silently roll the date over early or late depending on how far the
 * device's timezone sits from UTC (e.g. the FY26->FY27 cutover firing up
 * to several hours off local midnight), which is exactly the kind of bug
 * that only shows up once a year and only near a boundary — not something
 * to risk on a cutover date.
 */
export function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
