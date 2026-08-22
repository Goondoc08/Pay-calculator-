import type { Period, PayYear } from "../data/schema";
import { addDays, scheduledHoursOn } from "../engine/schedule";
import type {
  Destination,
  HourBlock,
  LineItem,
  PayGrade,
  ShiftLetter,
} from "../engine/types";

export type DayEntryType =
  | "off"
  | "regular"
  | "pto"
  | "holidayWorked"
  | "holidayObserved"
  | "stepUp"
  | "tifmas";

export interface DayEntry {
  date: string;
  scheduledHours: number;
  isHoliday: boolean;
  type: DayEntryType;
  hours: number;
  destination: Destination;
  grade: PayGrade;
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
 * holiday calendar — the same auto-population the sheet does (BUILD_PLAN.md
 * §4): a worked day on a holiday date defaults to holiday-worked, an
 * unworked holiday date defaults to a 12-hr holiday-observed entry.
 */
function defaultEntry(
  year: PayYear,
  shift: ShiftLetter,
  date: string,
  holidayDates: ReadonlySet<string>,
): DayEntry {
  const scheduledHours = scheduledHoursOn(year, shift, date);
  const isHoliday = holidayDates.has(date);

  if (scheduledHours > 0 && isHoliday) {
    return {
      date,
      scheduledHours,
      isHoliday,
      type: "holidayWorked",
      hours: scheduledHours,
      destination: "cash",
      grade: "F1",
    };
  }
  if (scheduledHours > 0) {
    return {
      date,
      scheduledHours,
      isHoliday,
      type: "regular",
      hours: scheduledHours,
      destination: "cash",
      grade: "F1",
    };
  }
  if (isHoliday) {
    return {
      date,
      scheduledHours,
      isHoliday,
      type: "holidayObserved",
      hours: 12,
      destination: "cash",
      grade: "F1",
    };
  }
  return {
    date,
    scheduledHours,
    isHoliday,
    type: "off",
    hours: 0,
    destination: "cash",
    grade: "F1",
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
    if (entry.type === "off" || entry.hours <= 0) continue;
    if (entry.type === "pto") {
      blocks.push({ date: entry.date, type: "pto", hours: entry.hours });
    } else if (entry.type === "stepUp") {
      blocks.push({
        date: entry.date,
        type: "stepUp",
        hours: entry.hours,
        destination: entry.destination,
        grade: entry.grade,
      });
    } else {
      blocks.push({
        date: entry.date,
        type: entry.type,
        hours: entry.hours,
        destination: entry.destination,
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
  const byDate = new Map(blocks.map((b) => [b.date, b]));
  return defaults.map((entry) => {
    const block = byDate.get(entry.date);
    if (!block) return { ...entry, type: "off", hours: 0 };
    if (block.type === "pto") {
      return { ...entry, type: "pto", hours: block.hours, destination: "cash" };
    }
    return {
      ...entry,
      type: block.type,
      hours: block.hours,
      destination: block.destination,
      grade: block.type === "stepUp" ? block.grade : entry.grade,
    };
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
