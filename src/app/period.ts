import type { Period, PayYear } from "../data/schema";
import { addDays, scheduledHoursOn } from "../engine/schedule";
import { nextGradeUp } from "./stepProgression";
import type {
  HourBlock,
  LineItem,
  PayGrade,
  ShiftLetter,
} from "../engine/types";

// Fallback only for when the member's own grade isn't known yet (e.g. data
// saved before Setup started capturing grade). Once known, step-up always
// defaults to the grade directly above the member's own (nextGradeUp).
const FALLBACK_STEP_UP_GRADE: PayGrade = "F2";

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
   * (0-24) — everything else is derived from this. Confirmed directly:
   * the holiday-worked premium (1.5x) is capped at the 12-hr entitlement
   * itself, even on a full 24-hr shift — working more than 12 hours of a
   * holiday doesn't earn more premium, it just reverts to being an
   * ordinary worked (regular) day past that point:
   *   - min(worked, 12) hrs pay 1.5x (holiday-worked)
   *   - max(0, worked - 12) hrs pay straight, counting toward the 106-hr
   *     cap like any other regular hours (the excess isn't "holiday" pay
   *     anymore, just an ordinary work day that happens to fall on one)
   *   - max(0, 12 - worked) hrs of the entitlement that went unworked
   *     still pay straight, excluded from the cap (holiday-observed)
   * A holdover of just part of the entitlement (e.g. 2 hrs of a late
   * call) works the same way (2 HW + 10 HO). Not yet checked against a
   * real paystub (docs/BUILD_PLAN.md Phase 06).
   */
  holidayHoursWorked: number;
  /**
   * Meaningful only when isHoliday and holidayHoursWorked > 0. Working a
   * holiday can still be banked as comp instead of cash, same as any other
   * worked hours — when true, the worked (1.5x) portion pays $0 this
   * check. The leftover holiday-observed entitlement always still pays
   * cash regardless of this flag; only the worked portion is bankable.
   */
  holidayWorkedComped: boolean;
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
  defaultStepUpGrade: PayGrade,
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
      grade: defaultStepUpGrade,
      holidayHoursWorked: scheduledHours,
      holidayWorkedComped: false,
    };
  }
  if (scheduledHours > 0) {
    return {
      date,
      scheduledHours,
      isHoliday,
      type: "regular",
      hours: scheduledHours,
      grade: defaultStepUpGrade,
      holidayHoursWorked: 0,
      holidayWorkedComped: false,
    };
  }
  return {
    date,
    scheduledHours,
    isHoliday,
    type: "off",
    hours: 0,
    grade: defaultStepUpGrade,
    holidayHoursWorked: 0,
    holidayWorkedComped: false,
  };
}

/**
 * @param memberGrade The member's own current grade (Setup), used only to
 * default a step-up entry's grade to the one directly above it — Step 0 of
 * the covered grade, per docs/PAY_PLAN.md, regardless of the member's own
 * step within their grade. Falls back to F2 if not yet known (e.g. data
 * saved before Setup captured grade) or if the member is already at the
 * year's top grade.
 */
export function defaultDayEntries(
  year: PayYear,
  shift: ShiftLetter,
  period: Period,
  memberGrade?: PayGrade | null,
): DayEntry[] {
  const holidayDates = new Set(year.holidays.map((h) => h.date));
  const defaultStepUpGrade =
    (memberGrade ? nextGradeUp(year, memberGrade) : null) ??
    FALLBACK_STEP_UP_GRADE;
  return datesInPeriod(period).map((date) =>
    defaultEntry(year, shift, date, holidayDates, defaultStepUpGrade),
  );
}

export function entriesToBlocks(entries: DayEntry[]): HourBlock[] {
  const blocks: HourBlock[] = [];
  for (const entry of entries) {
    if (entry.isHoliday) {
      const worked = Math.min(24, Math.max(0, entry.holidayHoursWorked));
      const destination = entry.holidayWorkedComped ? "comp" : "cash";

      const hwHours = Math.min(worked, HOLIDAY_ENTITLEMENT_HOURS);
      if (hwHours > 0) {
        blocks.push({
          date: entry.date,
          type: "holidayWorked",
          hours: hwHours,
          destination,
        });
      }

      // Hours worked past the 12-hr entitlement don't earn more holiday
      // premium — they're just an ordinary regular day past that point.
      const excessRegularHours = Math.max(
        0,
        worked - HOLIDAY_ENTITLEMENT_HOURS,
      );
      if (excessRegularHours > 0) {
        blocks.push({
          date: entry.date,
          type: "regular",
          hours: excessRegularHours,
          destination,
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
  memberGrade?: PayGrade | null,
): DayEntry[] {
  const defaults = defaultDayEntries(year, shift, period, memberGrade);
  const blocksByDate = new Map<string, HourBlock[]>();
  for (const block of blocks) {
    const existing = blocksByDate.get(block.date);
    if (existing) existing.push(block);
    else blocksByDate.set(block.date, [block]);
  }

  return defaults.map((entry) => {
    const dayBlocks = blocksByDate.get(entry.date) ?? [];

    if (entry.isHoliday) {
      const hwBlock = dayBlocks.find((b) => b.type === "holidayWorked");
      const excessBlock = dayBlocks.find((b) => b.type === "regular");
      return {
        ...entry,
        holidayHoursWorked: (hwBlock?.hours ?? 0) + (excessBlock?.hours ?? 0),
        holidayWorkedComped:
          hwBlock?.destination === "comp" ||
          (!hwBlock && excessBlock?.destination === "comp"),
      };
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
