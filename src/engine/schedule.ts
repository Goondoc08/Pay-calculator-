import type { PayYear } from "../data/schema";
import type { ShiftLetter } from "./types";

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Scheduled hours for a shift on one date, per its 48/96 rotation. 0 if off. */
export function scheduledHoursOn(
  year: PayYear,
  shift: ShiftLetter,
  date: string,
): number {
  const { cycleAnchor, pattern } = year.shifts[shift];
  const offset = ((daysBetween(cycleAnchor, date) % 6) + 6) % 6;
  return pattern[offset];
}

/**
 * Expands the 48/96 rotation to real dates across the year's full range.
 * Returns only the "on" days (nonzero scheduled hours).
 */
export function buildSchedule(
  year: PayYear,
  shift: ShiftLetter,
): { date: string; hours: number }[] {
  const days: { date: string; hours: number }[] = [];
  let cur = year.effectiveFrom;
  while (cur <= year.effectiveTo) {
    const hours = scheduledHoursOn(year, shift, cur);
    if (hours > 0) days.push({ date: cur, hours });
    cur = addDays(cur, 1);
  }
  return days;
}
