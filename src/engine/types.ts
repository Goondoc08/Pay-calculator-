import type { PayYear } from "../data/schema";

export type ShiftLetter = "A" | "B" | "C";
export type PayGrade = keyof PayYear["payPlan"];

/** Where a block of hours is paid out: cash on this check, or banked (comp/accrue). */
export type Destination = "cash" | "comp" | "accrue";

/**
 * A rate as of a given date. `hourlyRate` + `incentiveTotal` is the
 * "effective rate" (base + incentives). A profile carries more than one
 * segment only for the single period spanning a step/anniversary date; the
 * app otherwise just asks the member for their current rate.
 */
export interface RateSegment {
  effectiveFrom: string; // ISO date, inclusive
  hourlyRate: number;
  incentiveTotal: number;
}

export interface Profile {
  shift: ShiftLetter;
  /** Sorted ascending by effectiveFrom. Must have at least one segment. */
  rateSegments: RateSegment[];
}

interface BlockBase {
  date: string; // ISO date
}

export interface RegularBlock extends BlockBase {
  type: "regular";
  hours: number;
  destination: Destination;
}

export interface StepUpBlock extends BlockBase {
  type: "stepUp";
  hours: number;
  destination: Destination;
  /** The grade being covered — step-up pays Step 0 of this grade. */
  grade: PayGrade;
}

export interface TifmasBlock extends BlockBase {
  type: "tifmas";
  hours: number;
  destination: Destination;
}

export interface HolidayWorkedBlock extends BlockBase {
  type: "holidayWorked";
  hours: number;
  destination: Destination;
}

export interface HolidayObservedBlock extends BlockBase {
  type: "holidayObserved";
  hours: number;
  destination: Destination;
}

export interface PtoBlock extends BlockBase {
  type: "pto";
  hours: number;
}

export type HourBlock =
  | RegularBlock
  | StepUpBlock
  | TifmasBlock
  | HolidayWorkedBlock
  | HolidayObservedBlock
  | PtoBlock;

export interface LineItem {
  label: string;
  date?: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface PeriodResult {
  totalHours: number;
  otHours: number;
  gross: number;
  lineItems: LineItem[];
}
