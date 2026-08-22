import type { PayYear } from "../data/schema";
import { effectiveRate } from "./rate";
import type {
  HourBlock,
  LineItem,
  PayGrade,
  PeriodResult,
  Profile,
} from "./types";

/** Step-up / ride-up pays Step 0 of the covered grade — never a percentage. */
export function computeStepUp(payYear: PayYear, grade: PayGrade): number {
  const table = payYear.payPlan[grade];
  if (!table || table.length === 0) {
    throw new Error(`No pay plan table for grade ${grade}`);
  }
  return table[0];
}

function rateForBlock(
  payYear: PayYear,
  profile: Profile,
  block: HourBlock,
): number {
  if (block.type === "stepUp") {
    return computeStepUp(payYear, block.grade);
  }
  return effectiveRate(profile, block.date);
}

/** Cap-counting blocks: only hours actually worked count toward the 106-hr
 * FLSA threshold. PTO and holiday hours (worked or observed) never count,
 * confirmed directly against real checks (docs/BUILD_PLAN.md §Appendix). */
function countsTowardCap(block: HourBlock): boolean {
  return (
    block.type === "regular" ||
    block.type === "stepUp" ||
    block.type === "tifmas"
  );
}

/**
 * Prices one pay period from its typed hour blocks. Pure function: no
 * clock, no storage, no UI. Splits automatically at a step-date boundary
 * because `rateForBlock` looks up each block's own date against the
 * profile's rate segments — a period spanning that date naturally prices
 * part at the old rate and part at the new one.
 */
export function computePeriod(
  payYear: PayYear,
  profile: Profile,
  blocks: HourBlock[],
): PeriodResult {
  const sorted = [...blocks].sort((a, b) => (a.date < b.date ? -1 : 1));

  const capBlocks = sorted.filter(countsTowardCap);
  const totalCapHours = capBlocks.reduce((sum, b) => sum + b.hours, 0);
  const otHours = Math.max(0, totalCapHours - payYear.flsaThresholdHours);

  const lineItems: LineItem[] = [];
  let gross = 0;
  let totalHours = 0;
  let cumulativeCapHours = 0;

  // Weighted-average "regular rate" across all cap-counting hours, used for
  // the FLSA premium whenever those hours don't all share one rate — a
  // step-date split and a step-up/regular mix are both cases of this.
  const totalCapDollars = capBlocks.reduce(
    (sum, b) => sum + b.hours * rateForBlock(payYear, profile, b),
    0,
  );
  const blendedCapRate =
    totalCapHours > 0 ? totalCapDollars / totalCapHours : 0;

  for (const block of sorted) {
    totalHours += block.hours;
    const rate = rateForBlock(payYear, profile, block);
    const paid = block.type === "pto" || block.destination === "cash";

    if (block.type === "holidayWorked") {
      const amount = paid ? block.hours * rate * 1.5 : 0;
      gross += amount;
      lineItems.push({
        label: "Holiday worked",
        date: block.date,
        hours: block.hours,
        rate: rate * 1.5,
        amount,
      });
      continue;
    }

    if (block.type === "holidayObserved") {
      const amount = paid ? block.hours * rate : 0;
      gross += amount;
      lineItems.push({
        label: "Holiday observed",
        date: block.date,
        hours: block.hours,
        rate,
        amount,
      });
      continue;
    }

    if (block.type === "pto") {
      const amount = block.hours * rate;
      gross += amount;
      lineItems.push({
        label: "PTO",
        date: block.date,
        hours: block.hours,
        rate,
        amount,
      });
      continue;
    }

    // regular / stepUp / tifmas: straight pay for all hours, plus an FLSA
    // premium for whatever portion of this block's hours falls past the
    // 106-hr cap (the cap is a running total across the whole period).
    const blockStart = cumulativeCapHours;
    const blockEnd = blockStart + block.hours;
    cumulativeCapHours = blockEnd;
    const overInBlock =
      Math.max(0, blockEnd - payYear.flsaThresholdHours) -
      Math.max(0, blockStart - payYear.flsaThresholdHours);

    const straightAmount = paid ? block.hours * rate : 0;
    gross += straightAmount;
    lineItems.push({
      label:
        block.type === "stepUp"
          ? `Step-up (${block.grade})`
          : block.type === "tifmas"
            ? "TIFMAS"
            : "Regular",
      date: block.date,
      hours: block.hours,
      rate,
      amount: straightAmount,
    });

    if (overInBlock > 0) {
      const premiumAmount = paid ? overInBlock * 0.5 * blendedCapRate : 0;
      gross += premiumAmount;
      lineItems.push({
        label: "FLSA premium",
        date: block.date,
        hours: overInBlock,
        rate: 0.5 * blendedCapRate,
        amount: premiumAmount,
      });
    }
  }

  return { totalHours, otHours, gross, lineItems };
}
