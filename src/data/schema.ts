import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const shiftScheduleSchema = z.object({
  cycleAnchor: isoDate,
  pattern: z
    .array(z.number().nonnegative())
    .length(6, "pattern must be a 6-day cycle"),
});

const periodSchema = z.object({
  n: z.number().int().positive(),
  start: isoDate,
  end: isoDate,
});

const holidaySchema = z.object({
  date: isoDate,
  name: z.string().min(1),
  hours: z.number().positive(),
});

const rateTableSchema = z.record(z.string(), z.number().positive());

const incentivesSchema = z.object({
  tcfp: rateTableSchema,
  education: rateTableSchema,
  emt: rateTableSchema,
  bilingual: z.number().nonnegative(),
  assignment: rateTableSchema,
});

const payPlanSchema = z.record(
  z.string(),
  z.array(z.number().positive()).min(1),
);

const raiseSchema = z.object({
  trigger: z.literal("stepDate"),
  proration: z.literal("split"),
});

export const payYearSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  effectiveFrom: isoDate,
  effectiveTo: isoDate,

  periodLengthDays: z.number().int().positive(),
  flsaThresholdHours: z.number().positive(),

  shifts: z.object({
    A: shiftScheduleSchema,
    B: shiftScheduleSchema,
    C: shiftScheduleSchema,
  }),

  periods: z.array(periodSchema).min(1),

  holidays: z.array(holidaySchema),

  incentives: incentivesSchema,

  payPlan: payPlanSchema,

  raise: raiseSchema,
});

export type PayYear = z.infer<typeof payYearSchema>;
export type ShiftLetter = "A" | "B" | "C";
export type Holiday = z.infer<typeof holidaySchema>;
export type Period = z.infer<typeof periodSchema>;

export function parsePayYear(data: unknown): PayYear {
  const result = payYearSchema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Invalid PayYear data: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
