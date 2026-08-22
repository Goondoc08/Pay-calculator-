import type { Profile } from "./types";

/**
 * Base + incentives as of a given date. A profile normally carries one rate
 * segment; it carries two only for the single pay period spanning a step
 * date, so `computePeriod` can price each side of the split separately.
 */
export function effectiveRate(profile: Profile, date: string): number {
  const segments = profile.rateSegments;
  if (segments.length === 0) {
    throw new Error("Profile has no rate segments");
  }

  const applicable = segments
    .filter((segment) => segment.effectiveFrom <= date)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  const current =
    applicable[0] ??
    segments.reduce((earliest, segment) =>
      segment.effectiveFrom < earliest.effectiveFrom ? segment : earliest,
    );

  return current.hourlyRate + current.incentiveTotal;
}
