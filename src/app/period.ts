import type { Period, PayYear } from "../data/schema";
import { addDays, scheduledHoursOn } from "../engine/schedule";
import type {
  HourBlock,
  LineItem,
  PayGrade,
  ShiftLetter,
} from "../engine/types";

// F1 is never a valid ride-up target (step-up always covers a *higher*
// grade), so it can't be the default grade for a step-up entry the UI's
// grade picker (which only lists F2+) hasn't been touched yet.
const DEFAULT_STEP_UP_GRADE: PayGrade = "F2";

/** The standard holiday-off entitlement — 12 hrs, whether or not any of it
 * gets worked (docs/BUILD_PLAN.md Appendix). */
const HOLIDAY_ENTITLEMENT_HOURS = 12;

/**
 * Regular/PTO/step-up/TIFMAS are alternatives — a day is exactly one of
 * them. A holiday date is handled separately (see `holidayHoursWorked`
 * below): it isn't one-or-the-other, since working *part* of a holiday
 * pays both a worked premium for the hours worked and the leftover
 * observed entitlement for the hours that weren't — a first-class case,
 * not a variant of "off"/"regular".
 */
export type DayEntryType = "off" | "regular" | "pto" | "stepUp" | "tifmas";

export interface DayEntry {
  date: string;
  scheduledHours: number;
  isHoliday: boolean;
  /** Meaningful only when !isHoliday. */
  type: DayEntryType;
  /** Meaningful only when !isHoliday. */
  hours: number;
  /** For type "stepUp". */
  grade: PayGrade;
  /**
   * Meaningful only when isHoliday. Hours actually worked on the holiday
   * (0-24) — everything is derived from this: those hours pay 1.5x
   * (holiday-worked), and whatever's left of the 12-hr entitlement
   * (12 - worked, floored at 0) still pays straight time
   * (holiday-observed). A holdover of just part of the entitlement (e.g.
   * 2 hrs of a late call) is confirmed directly to work this way — not
   * yet checked against a real paystub (docs/BUILD_PLAN.md Phase 06).
   */
  holidayHoursWorked: number;
}

function datesInPeriod(period: Period): string[] {
  const dates: string[] = [];
  let cur = period.start;
  while (cur <= period.end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

export function findPeriodForDate(
  year: PayYear,
  date: string,
): Period | undefined {
  if (date < year.effectiveFrom) return year.periods[0];
  if (date > year.effectiveTo) return year.periods[year.periods.length - 1];
  return year.periods.find((p) => p.start <= date && date <= p.end);
}

/**
 * Seeds one day's default entry from the deterministic rotation and the
 * holiday calendar — the same auto-population the sheet does
 * (BUILD_PLAN.md §4): a holiday date defaults to however many hours the
 * shift is actually scheduled to work that day (0 if it's an off day,
 * which naturally defaults holidayHoursWorked to 0 -> full 12-hr
 * holiday-observed).
 */
function defaultEntry(
  year: PayYear,
  shift: ShiftLetter,
  date: string,
  holidayDates: ReadonlySet<string>,
): DayEntry {
  const scheduledHours = scheduledHoursOn(year, shift, date);
  const isHoliday = holidayDates.has(date);

  if (isHoliday) {
    return {
      date,
      scheduledHours,
      isHoliday,
      type: "regular",
      hours: 0,
      grade: DEFAULT_STEP_UP_GRADE,
      holidayHoursWorked: scheduledHours,
    };
  }
  if (scheduledHours > 0) {
    return {
      date,
      scheduledHours,
      isHoliday,
      type: "regular",
      hours: scheduledHours,
      grade: DEFAULT_STEP_UP_GRADE,
      holidayHoursWorked: 0,
    };
  }
  return {
    date,
    scheduledHours,
    isHoliday,
    type: "off",
    hours: 0,
    grade: DEFAULT_STEP_UP_GRADE,
    holidayHoursWorked: 0,
  };
}

export function defaultDayEntries(
  year: PayYear,
  shift: ShiftLetter,
  period: Period,
): DayEntry[] {
  const holidayDates = new Set(year.holidays.map((h) => h.date));
  return datesInPeriod(period).map((date) =>
    defaultEntry(year, shift, date, holidayDates),
  );
}

export function entriesToBlocks(entries: DayEntry[]): HourBlock[] {
  const blocks: HourBlock[] = [];
  for (const entry of entries) {
    if (entry.isHoliday) {
      const worked = Math.min(24, Math.max(0, entry.holidayHoursWorked));
      if (worked > 0) {
        blocks.push({
          date: entry.date,
          type: "holidayWorked",
          hours: worked,
          destination: "cash",
        });
      }
      const leftover = Math.max(0, HOLIDAY_ENTITLEMENT_HOURS - worked);
      if (leftover > 0) {
        blocks.push({
          date: entry.date,
          type: "holidayObserved",
          hours: leftover,
          destination: "cash",
        });
      }
      continue;
    }

    if (entry.type === "off" || entry.hours <= 0) continue;
    if (entry.type === "pto") {
      blocks.push({ date: entry.date, type: "pto", hours: entry.hours });
    } else if (entry.type === "stepUp") {
      blocks.push({
        date: entry.date,
        type: "stepUp",
        hours: entry.hours,
        destination: "cash",
        grade: entry.grade,
      });
    } else {
      blocks.push({
        date: entry.date,
        type: entry.type,
        hours: entry.hours,
        destination: "cash",
      });
    }
  }
  return blocks;
}

export function blocksToEntries(
  year: PayYear,
  shift: ShiftLetter,
  period: Period,
  blocks: HourBlock[],
): DayEntry[] {
  const defaults = defaultDayEntries(year, shift, period);
  const blocksByDate = new Map<string, HourBlock[]>();
  for (const block of blocks) {
    const existing = blocksByDate.get(block.date);
    if (existing) existing.push(block);
    else blocksByDate.set(block.date, [block]);
  }

  return defaults.map((entry) => {
    const dayBlocks = blocksByDate.get(entry.date) ?? [];

    if (entry.isHoliday) {
      const worked = dayBlocks.find((b) => b.type === "holidayWorked");
      return { ...entry, holidayHoursWorked: worked?.hours ?? 0 };
    }

    if (dayBlocks.length === 0) return { ...entry, type: "off", hours: 0 };
    const block = dayBlocks[0];
    if (block.type === "pto") {
      return { ...entry, type: "pto", hours: block.hours };
    }
    if (block.type === "stepUp") {
      return {
        ...entry,
        type: "stepUp",
        hours: block.hours,
        grade: block.grade,
      };
    }
    if (block.type === "regular" || block.type === "tifmas") {
      return { ...entry, type: block.type, hours: block.hours };
    }
    return entry;
  });
}

export interface AggregatedLineItem {
  label: string;
  hours: number;
  amount: number;
}

/** Collapses per-day line items into one row per pay code, for a compact
 * itemized display and for matching against what a real check shows. */
export function aggregateLineItems(
  lineItems: LineItem[],
): AggregatedLineItem[] {
  const byLabel = new Map<string, AggregatedLineItem>();
  for (const item of lineItems) {
    const existing = byLabel.get(item.label);
    if (existing) {
      existing.hours += item.hours;
      existing.amount += item.amount;
    } else {
      byLabel.set(item.label, {
        label: item.label,
        hours: item.hours,
        amount: item.amount,
      });
    }
  }
  return [...byLabel.values()];
}
