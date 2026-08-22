import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const shiftLetter = z.enum(["A", "B", "C"]);
const destination = z.enum(["cash", "comp", "accrue"]);
const payGrade = z.enum(["F1", "F2", "F3", "F4"]);

const rateSegmentSchema = z.object({
  effectiveFrom: isoDate,
  hourlyRate: z.number().nonnegative(),
  incentiveTotal: z.number().nonnegative(),
});

const hourBlockSchema = z.discriminatedUnion("type", [
  z.object({
    date: isoDate,
    type: z.literal("regular"),
    hours: z.number().nonnegative(),
    destination,
  }),
  z.object({
    date: isoDate,
    type: z.literal("stepUp"),
    hours: z.number().nonnegative(),
    destination,
    grade: payGrade,
  }),
  z.object({
    date: isoDate,
    type: z.literal("tifmas"),
    hours: z.number().nonnegative(),
    destination,
  }),
  z.object({
    date: isoDate,
    type: z.literal("holidayWorked"),
    hours: z.number().nonnegative(),
    destination,
  }),
  z.object({
    date: isoDate,
    type: z.literal("holidayObserved"),
    hours: z.number().nonnegative(),
    destination,
  }),
  z.object({
    date: isoDate,
    type: z.literal("pto"),
    hours: z.number().nonnegative(),
  }),
]);

export const profileSchema = z.object({
  shift: shiftLetter,
  rateSegments: z.array(rateSegmentSchema).min(1),
});

/**
 * Setup-screen metadata used to auto-project a member's next step
 * (civil-service rule: step lands on hire/promotion anniversary, not a
 * shared fiscal-year date — docs/PAY_PLAN.md). Not read by the engine —
 * it only ever sees the resulting rateSegments — kept here so Setup can
 * re-derive the same projection next time it's opened instead of asking
 * again from scratch.
 */
export const progressionSchema = z.object({
  grade: payGrade,
  /** Hire date, or most recent promotion date if later — whichever the
   * member's next step actually lands on. */
  anniversaryDate: isoDate,
  /** Whether the member confirmed they're on track for the projected
   * step (civil-service progression is "for employees in good
   * standing," so this isn't automatic). */
  receivingStep: z.boolean(),
});

export const hourBlockListSchema = z.array(hourBlockSchema);

/** Key: `${yearId}:${periodNumber}`, e.g. "FY27:14". */
export const periodEntriesSchema = z.record(z.string(), hourBlockListSchema);

const settingsSchema = z.object({
  selectedYearId: z.string().nullable(),
});

export const storedDataV1Schema = z.object({
  version: z.literal(1),
  profile: profileSchema.nullable(),
  periodEntries: periodEntriesSchema,
  settings: settingsSchema,
  // .default(null) so data saved before this field existed still parses.
  progression: progressionSchema.nullable().default(null),
});

export type StoredDataV1 = z.infer<typeof storedDataV1Schema>;

export function emptyStoredData(): StoredDataV1 {
  return {
    version: 1,
    profile: null,
    periodEntries: {},
    settings: { selectedYearId: null },
    progression: null,
  };
}

export function periodEntryKey(yearId: string, periodNumber: number): string {
  return `${yearId}:${periodNumber}`;
}
