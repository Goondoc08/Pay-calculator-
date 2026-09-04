import type { Profile, RateSegment } from "./types";

function segmentFor(profile: Profile, date: string): RateSegment {
  const segments = profile.rateSegments;
  if (segments.length === 0) {
    throw new Error("Profile has no rate segments");
  }

  const applicable = segments
    .filter((segment) => segment.effectiveFrom <= date)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  return (
    applicable[0] ??
    segments.reduce((earliest, segment) =>
      segment.effectiveFrom < earliest.effectiveFrom ? segment : earliest,
    )
  );
}

/**
 * Base + incentives as of a given date. A profile normally carries one rate
 * segment; it carries two only for the single pay period spanning a step
 * date, so `computePeriod` can price each side of the split separately.
 */
export function effectiveRate(profile: Profile, date: string): number {
  const current = segmentFor(profile, date);
  return current.hourlyRate + current.incentiveTotal;
}

/**
 * TIFMAS deployment rate: base hourly rate at time-and-a-half plus incentive
 * pay at straight time (the incentive itself is never 1.5x'd). Confirmed
 * against a member's real workbook formula, `=(B1*B13*1.5)+(D17*B13)` where
 * B1 is the hourly rate, D17 the incentive-per-hour, and B13 the TIFMAS
 * hours — i.e. `hours * (1.5 * hourlyRate + incentiveTotal)`.
 */
export function tifmasRate(profile: Profile, date: string): number {
  const current = segmentFor(profile, date);
  return 1.5 * current.hourlyRate + current.incentiveTotal;
}

/**
 * The member's own incentive/cert pay as of a given date, independent of
 * whatever base or step-up rate it's added to. Riding up in rank doesn't
 * suspend a member's personal certs — confirmed from the workbook's
 * Step-up row, `=(E1+D17)*B4` (E1 the step-up rate, D17 the incentive), the
 * same `+ D17` every other paid row on the sheet carries.
 */
export function incentiveRate(profile: Profile, date: string): number {
  return segmentFor(profile, date).incentiveTotal;
}
