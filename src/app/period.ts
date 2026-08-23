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

/** The standard holiday-off entitlement — 12 hrs per holiday date, whether
 * or not any of it gets worked, and the cap on the HW premium. */
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
   * (0-24) — everything else derives from this. Verified against a real
   * Christmas-period paystub (RG 106h / HW 36h, gross to the cent), and
   * matching both workbooks' straight-pay formula:
   *   - all `worked` hrs pay straight as REGULAR, and count toward the
   *     106-hr cap like any other worked hours
   *   - min(worked, 12) hrs ALSO pay a 1.5x HW premium on top — an adder,
   *     not a replacement, capped per holiday date
   *   - max(0, 12 - worked) hrs of unworked entitlement pay straight as
   *     HO, excluded from the cap
   * So a fully-worked 24-hr holiday is 24 RG + 12 HW; a 2-hr holdover is
   * 2 RG + 2 HW + 10 HO, exactly as described by the member.
   */
  holidayHoursWorked: number;
  /**
   * Meaningful only when isHoliday and holidayHoursWorked > 0. Per city
   * policy 501.1.1(G): a member who works a holiday can elect "Holiday
   * Worked-Accrued" (HWA) instead of cash HW — banking the 1.5x premium
   * hours to use later rather than being paid for them this check.
   * Confirmed directly: this only replaces the HW premium itself, not the
   * underlying RG wage for hours actually worked, which always still pays
   * cash — matching how ordinary FLSA comp time only banks the OT premium,
   * never the straight-time pay underneath it.
   */
  holidayWorkedAccrued: boolean;
  /**
   * Meaningful only when isHoliday and the entitlement isn't fully worked
   * (worked < 12). Per policy 501.1.1(C): "Holiday Accrued" (HA) is offered
   * "in lieu of holiday observed pay" — so the unworked remainder of the
   * entitlement is independently bankable too, separate from whether the
   * worked portion (if any) was also banked.
   */
  holidayObservedAccrued: boolean;
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
      holidayWorkedAccrued: false,
      holidayObservedAccrued: false,
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
      holidayWorkedAccrued: false,
      holidayObservedAccrued: false,
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
    holidayWorkedAccrued: false,
    holidayObservedAccrued: false,
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

      // Every hour actually worked is an ordinary regular hour, paid at the
      // effective rate and counted toward the 106-hr cap. Always cash — RG
      // is the wage for hours actually worked, never bankable, same as
      // ordinary FLSA comp time never defers straight-time pay.
      if (worked > 0) {
        blocks.push({
          date: entry.date,
          type: "regular",
          hours: worked,
          destination: "cash",
        });
      }

      // HW: the 1.5x premium adder, capped at the 12-hr entitlement. Working
      // past 12 on one holiday earns no further premium (the hours are still
      // paid as regular above). Independently bankable as HWA.
      const hwHours = Math.min(worked, HOLIDAY_ENTITLEMENT_HOURS);
      if (hwHours > 0) {
        blocks.push({
          date: entry.date,
          type: "holidayWorked",
          hours: hwHours,
          destination: entry.holidayWorkedAccrued ? "accrue" : "cash",
        });
      }

      // HO: the unworked remainder of the entitlement. Independently
      // bankable as HA, regardless of whether the worked portion was banked.
      const leftover = Math.max(0, HOLIDAY_ENTITLEMENT_HOURS - worked);
      if (leftover > 0) {
        blocks.push({
          date: entry.date,
          type: "holidayObserved",
          hours: leftover,
          destination: entry.holidayObservedAccrued ? "accrue" : "cash",
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
      // The regular block carries the full worked-hours figure; HW is only
      // the capped premium slice of it, so it can't be used to reconstruct
      // hours past 12.
      const workedBlock = dayBlocks.find((b) => b.type === "regular");
      const hwBlock = dayBlocks.find((b) => b.type === "holidayWorked");
      const hoBlock = dayBlocks.find((b) => b.type === "holidayObserved");
      return {
        ...entry,
        holidayHoursWorked: workedBlock?.hours ?? 0,
        holidayWorkedAccrued: hwBlock?.destination === "accrue",
        holidayObservedAccrued: hoBlock?.destination === "accrue",
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
