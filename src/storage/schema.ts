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
});

export type StoredDataV1 = z.infer<typeof storedDataV1Schema>;

export function emptyStoredData(): StoredDataV1 {
  return {
    version: 1,
    profile: null,
    periodEntries: {},
    settings: { selectedYearId: null },
  };
}

export function periodEntryKey(yearId: string, periodNumber: number): string {
  return `${yearId}:${periodNumber}`;
}
