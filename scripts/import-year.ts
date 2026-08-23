/**
 * Imports a department FY pay-calendar workbook into the app's PayYear JSON
 * format, plus a sheet-parity fixture used by the Phase 03 harness.
 *
 * Usage: npm run import-year -- <path-to-workbook.xlsx> <fiscal-year-id, e.g. FY27>
 *
 * Reads the A-Shift/B-Shift/C-Shift tabs directly (see docs/BUILD_PLAN.md §4
 * for the layout). Holiday *dates* come from the purple-filled calendar
 * cells, not the sheet's per-holiday formulas (BUILD_PLAN.md's stated import
 * signal) — the formulas are known to be inconsistent (BUILD_PLAN.md
 * Appendix, defects #2/#3/#5).
 *
 * Holiday *names* are a best-effort guess from the date (e.g. the fourth
 * Thursday in November is "Thanksgiving"). They are NOT confirmed against
 * the department calendar — that is a required human step before shipping a
 * year file (BUILD_PLAN.md §8). This script prints the guessed table for
 * that review; it does not fail without it.
 */
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SHIFT_TABS = ["A-Shift", "B-Shift", "C-Shift"] as const;
type ShiftTab = (typeof SHIFT_TABS)[number];
const SHIFT_LETTER: Record<ShiftTab, "A" | "B" | "C"> = {
  "A-Shift": "A",
  "B-Shift": "B",
  "C-Shift": "C",
};

const DAY_COLUMNS = [2, 3, 4, 5, 6, 7, 8]; // B..H = Sat..Fri
// Columns J/K/L/M/N are reused for two different meanings depending on the
// row: a day-of-week row (HO/HW hours for that week) vs. the period summary
// row two rows below it (totalHours/otHours/straightPay/flsaPay/totalPay).
const COL = {
  date: 1,
  ho: 10, // J, day row
  hw: 11, // K, day row
  totalHours: 10, // J, summary row
  otHours: 11, // K, summary row
  straightPay: 12, // L, summary row
  flsaPay: 13, // M, summary row
  totalPay: 14, // N, summary row
  rate: 12, // L, row 3 (profile setup block)
  incentive: 13, // M, row 3
  anniversaryDate: 16, // P, row 2
  anniversaryNewRate: 16, // P, row 3
};

const HOLIDAY_FILL_THEME = 8;

interface DayCell {
  date: string; // ISO
  hours: number;
}

interface PeriodExtract {
  n: number;
  start: string;
  end: string;
  dayHours: Record<string, number>;
  summary: {
    totalHours: number;
    otHours: number;
    straightPay: number;
    flsaPay: number;
    totalPay: number;
  };
}

interface ShiftExtract {
  profile: {
    rate: number;
    incentive: number;
    anniversaryDate: string | null;
    anniversaryNewRate: number | null;
  };
  periods: PeriodExtract[];
  holidayCells: DayCell[];
}

/** Unwraps exceljs's {formula, result} shape for computed cells. */
function cellScalar(value: unknown): unknown {
  if (value && typeof value === "object" && "result" in value) {
    return (value as { result: unknown }).result;
  }
  return value;
}

function excelDateToIso(value: unknown): string | null {
  const v = cellScalar(value);
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  return null;
}

function excelNumber(value: unknown): number {
  const v = cellScalar(value);
  return typeof v === "number" ? v : 0;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isHolidayFill(fill: ExcelJS.Fill | undefined): boolean {
  if (!fill || fill.type !== "pattern") return false;
  const fg = fill.fgColor;
  return !!fg && "theme" in fg && fg.theme === HOLIDAY_FILL_THEME;
}

async function extractShift(
  workbook: ExcelJS.Workbook,
  tab: ShiftTab,
): Promise<ShiftExtract> {
  const ws = workbook.getWorksheet(tab);
  if (!ws) throw new Error(`Sheet not found: ${tab}`);

  const rate = excelNumber(ws.getCell(3, COL.rate).value);
  const incentive = excelNumber(ws.getCell(3, COL.incentive).value);
  const anniversaryDate = excelDateToIso(
    ws.getCell(2, COL.anniversaryDate).value,
  );
  const anniversaryNewRateScalar = cellScalar(
    ws.getCell(3, COL.anniversaryNewRate).value,
  );
  const anniversaryNewRate =
    typeof anniversaryNewRateScalar === "number"
      ? anniversaryNewRateScalar
      : null;

  const periods: PeriodExtract[] = [];
  const holidayCells: DayCell[] = [];

  let n = 0;
  const maxRow = Math.max(ws.rowCount, 5);
  for (let r = 5; r <= maxRow; r += 1) {
    const row1 = ws.getRow(r);
    const date1 = excelDateToIso(row1.getCell(COL.date).value);
    if (!date1) continue;

    const row2 = ws.getRow(r + 1);
    const row3 = ws.getRow(r + 2);
    const date2 = excelDateToIso(row2.getCell(COL.date).value);
    if (!date2) continue;

    n += 1;
    const start = date1;
    const end = addDays(date2, 6);
    const dayHours: Record<string, number> = {};

    for (const [weekRow, base] of [
      [row1, date1],
      [row2, date2],
    ] as const) {
      DAY_COLUMNS.forEach((col, i) => {
        const cell = weekRow.getCell(col);
        const v = cellScalar(cell.value);
        const date = addDays(base, i);
        if (typeof v === "number" && v > 0) {
          dayHours[date] = v;
        }
        if (isHolidayFill(cell.fill)) {
          holidayCells.push({ date, hours: typeof v === "number" ? v : 0 });
        }
      });
    }

    periods.push({
      n,
      start,
      end,
      dayHours,
      summary: {
        totalHours: excelNumber(row3.getCell(COL.totalHours).value),
        otHours: excelNumber(row3.getCell(COL.otHours).value),
        straightPay: excelNumber(row3.getCell(COL.straightPay).value),
        flsaPay: excelNumber(row3.getCell(COL.flsaPay).value),
        totalPay: excelNumber(row3.getCell(COL.totalPay).value),
      },
    });

    r += 2; // skip the two week-rows we just consumed (loop adds 1 more)
  }

  return {
    profile: { rate, incentive, anniversaryDate, anniversaryNewRate },
    periods,
    holidayCells,
  };
}

/** Finds the 6-day-cycle anchor (24,24,0,0,0,0) that fits every observed day cell. */
function findCycleAnchor(periods: PeriodExtract[], fyStart: string): string {
  const observed = new Map<string, number>();
  for (const p of periods) {
    for (const [date, hours] of Object.entries(p.dayHours)) {
      observed.set(date, hours);
    }
  }
  // Also record explicit "not worked" (0) for every date in range so absence counts.
  for (const p of periods) {
    let cur = p.start;
    while (cur <= p.end) {
      if (!observed.has(cur)) observed.set(cur, 0);
      cur = addDays(cur, 1);
    }
  }

  for (let offset = -5; offset <= 0; offset += 1) {
    const candidate = addDays(fyStart, offset);
    let mismatches = 0;
    for (const [date, hours] of observed) {
      const daysSince = Math.round(
        (new Date(`${date}T00:00:00Z`).getTime() -
          new Date(`${candidate}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      const idx = ((daysSince % 6) + 6) % 6;
      const predictedOn = idx === 0 || idx === 1;
      const actualOn = hours > 0;
      if (predictedOn !== actualOn) mismatches += 1;
    }
    if (mismatches === 0) return candidate;
  }
  throw new Error("No 24/24/0/0/0/0 cycle anchor fit the observed schedule");
}

/** Anonymous Gregorian algorithm — Easter Sunday for a given year. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isGoodFriday(d: Date): boolean {
  const good = new Date(easterSunday(d.getUTCFullYear()));
  good.setUTCDate(good.getUTCDate() - 2);
  return (
    good.getUTCFullYear() === d.getUTCFullYear() &&
    good.getUTCMonth() === d.getUTCMonth() &&
    good.getUTCDate() === d.getUTCDate()
  );
}

/**
 * Confirmed against the City of Pearland's official 2027 holiday memo
 * (HR, 2026-07-06): matches every FY27 holiday date. Two department-specific
 * notes baked in below —
 *
 * - Fire crews are paid holiday pay for the ACTUAL calendar date their
 *   24-hr tour covers, not the city's M-F "observed" shift (e.g. a holiday
 *   landing on a Sunday still pays for the Sunday, not the following
 *   Monday) — confirmed directly, not inferred.
 * - State law (H.B. 2113, Local Gov't Code §142.0013(c)) requires the city
 *   to label the Labor Day holiday "September 11th Memorial Day" for
 *   firefighters specifically — same date, different name, fire-only.
 */
function guessHolidayName(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const month = d.getUTCMonth(); // 0-indexed
  const day = d.getUTCDate();
  const dow = d.getUTCDay(); // 0=Sun

  if (month === 0 && day === 1) return "New Year's Day";
  if (month === 11 && day === 31) return "New Year's Eve";
  if (month === 11 && day === 24) return "Christmas Eve";
  if (month === 11 && day === 25) return "Christmas Day";
  if (month === 6 && day === 4) return "Independence Day";
  if (month === 0 && dow === 1 && day >= 15 && day <= 21)
    return "Martin Luther King Jr. Day";
  if (isGoodFriday(d)) return "Good Friday";
  if (month === 4 && dow === 1 && day >= 25) return "Memorial Day";
  if (month === 8 && dow === 1 && day <= 7)
    return "Labor Day / September 11th Memorial Day";
  if (month === 10 && dow === 4 && day >= 22 && day <= 28)
    return "Thanksgiving";
  if (month === 10 && dow === 5 && day >= 23 && day <= 29)
    return "Day After Thanksgiving";
  return "UNCONFIRMED HOLIDAY — name not inferred, check department calendar";
}

// Official pay plan tables, docs/PAY_PLAN.md — index 0 = Step 0. FY26 still
// has 5 grades (F1 Fire Fighter .. F5 Battalion Chief); FY27's proposed
// merger of Lieutenant/Captain drops it to 4 (F1..F4).
const PAY_PLANS: Record<string, Record<string, number[]>> = {
  FY26: {
    F1: [
      25.2779, 26.0362, 26.8173, 27.6218, 28.4505, 29.304, 30.1831, 31.0886,
      32.0213,
    ],
    F2: [33.3021, 34.3012, 35.3302, 36.3901],
    F3: [37.8458, 38.9811, 40.1506, 41.3551],
    F4: [43.0093, 44.2996, 45.6285, 46.9974],
    F5: [48.8773, 50.3436, 51.8539, 53.4095],
  },
  FY27: {
    F1: [
      26.8173, 27.6218, 28.4505, 29.304, 30.1831, 31.0886, 32.0213, 32.9819,
      33.9714,
    ],
    F2: [35.3302, 36.3901, 37.4818, 38.6063, 39.7644],
    F3: [41.7566, 43.0093, 44.2996, 45.6286, 46.9974],
    F4: [48.8773, 50.3436, 51.8539, 53.4095],
  },
};

// Matches both workbooks' Incentives tabs (docs/PAY_PLAN.md) — FY26's sheet
// also shows a transitional "EMT-P(FY25)" rate of 1.855, superseded by the
// department-wide raise mid-year; this is the current/final rate for both.
const INCENTIVES = {
  tcfp: { Intermediate: 0.2061, Advanced: 0.4121, Master: 0.6181 },
  education: {
    Associate: 0.4121,
    Bachelor: 0.6181,
    Master: 0.8242,
    PhD: 1.0302,
  },
  emt: { AEMT: 0.625, Paramedic: 2.0604 },
  bilingual: 0.3091,
  assignment: { "Inspector/Investigator": 0.2232, "QA/QI": 1.1 },
};

async function main() {
  const [, , workbookPath, yearId, effectiveToExclusive] = process.argv;
  if (!workbookPath || !yearId) {
    console.error(
      "Usage: npm run import-year -- <path-to-workbook.xlsx> <fiscal-year-id> [effective-to-exclusive]",
    );
    console.error(
      "  effective-to-exclusive: drop periods starting on/after this date —",
    );
    console.error(
      "  for a workbook whose calendar runs past where the next year takes over.",
    );
    process.exit(1);
  }

  const payPlan = PAY_PLANS[yearId];
  if (!payPlan) {
    console.error(
      `No pay plan table for ${yearId} — add one to PAY_PLANS in this script (docs/PAY_PLAN.md).`,
    );
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolve(workbookPath));

  const shiftData: Record<ShiftTab, ShiftExtract> = {
    "A-Shift": await extractShift(workbook, "A-Shift"),
    "B-Shift": await extractShift(workbook, "B-Shift"),
    "C-Shift": await extractShift(workbook, "C-Shift"),
  };

  // Some workbooks' own calendars run past where the next fiscal year takes
  // over (e.g. FY26's ships periods through 2026-10-09, but FY27 already
  // owns 2026-09-26 onward) — trim those trailing periods so consecutive
  // years don't overlap.
  if (effectiveToExclusive) {
    for (const tab of SHIFT_TABS) {
      const extract = shiftData[tab];
      extract.periods = extract.periods.filter(
        (p) => p.start < effectiveToExclusive,
      );
      extract.holidayCells = extract.holidayCells.filter(
        (c) => c.date < effectiveToExclusive,
      );
    }
  }

  const anyShift = shiftData["A-Shift"];
  const fyStart = anyShift.periods[0].start;
  const fyEnd = anyShift.periods[anyShift.periods.length - 1].end;

  // Sanity: period boundaries must agree across all three shifts.
  for (const tab of SHIFT_TABS) {
    const periods = shiftData[tab].periods;
    periods.forEach((p, i) => {
      const ref = anyShift.periods[i];
      if (p.start !== ref.start || p.end !== ref.end) {
        throw new Error(
          `Period ${i + 1} boundary mismatch on ${tab}: ${p.start}..${p.end} vs ${ref.start}..${ref.end}`,
        );
      }
    });
  }

  const shifts = {
    A: {
      cycleAnchor: findCycleAnchor(shiftData["A-Shift"].periods, fyStart),
      pattern: [24, 24, 0, 0, 0, 0],
    },
    B: {
      cycleAnchor: findCycleAnchor(shiftData["B-Shift"].periods, fyStart),
      pattern: [24, 24, 0, 0, 0, 0],
    },
    C: {
      cycleAnchor: findCycleAnchor(shiftData["C-Shift"].periods, fyStart),
      pattern: [24, 24, 0, 0, 0, 0],
    },
  };

  const holidayDates = new Map<string, number>();
  for (const tab of SHIFT_TABS) {
    for (const cell of shiftData[tab].holidayCells) {
      const existingHours = holidayDates.get(cell.date);
      // Record the standard 12-hr off-day entitlement; a cell only tells us
      // this date IS a holiday, not necessarily this shift's HO/HW hours.
      if (existingHours === undefined) holidayDates.set(cell.date, 12);
    }
  }

  const holidays = [...holidayDates.keys()].sort().map((date) => ({
    date,
    name: guessHolidayName(date),
    hours: 12,
  }));

  const payYear = {
    id: yearId,
    label: `FY ${yearId.replace(/^FY/i, "20")}`,
    effectiveFrom: fyStart,
    effectiveTo: fyEnd,
    periodLengthDays: 14,
    flsaThresholdHours: 106,
    shifts,
    periods: anyShift.periods.map((p) => ({
      n: p.n,
      start: p.start,
      end: p.end,
    })),
    holidays,
    incentives: INCENTIVES,
    payPlan,
    raise: { trigger: "stepDate", proration: "split" },
  };

  const outDir = resolve("src/data");
  writeFileSync(
    resolve(outDir, `${yearId.toLowerCase()}.json`),
    JSON.stringify(payYear, null, 2) + "\n",
  );

  const fixture = {
    yearId,
    shifts: Object.fromEntries(
      SHIFT_TABS.map((tab) => [
        SHIFT_LETTER[tab],
        {
          profile: shiftData[tab].profile,
          periods: shiftData[tab].periods,
        },
      ]),
    ),
  };
  writeFileSync(
    resolve(
      "src/engine/__fixtures__",
      `${yearId.toLowerCase()}-sheet-parity.json`,
    ),
    JSON.stringify(fixture, null, 2) + "\n",
  );

  console.log(`Wrote src/data/${yearId.toLowerCase()}.json`);
  console.log(
    `Wrote src/engine/__fixtures__/${yearId.toLowerCase()}-sheet-parity.json`,
  );
  console.log(
    "\nHolidays extracted from calendar fill color — CONFIRM against department calendar:",
  );
  console.table(holidays);
  console.log("\nShift cycle anchors (derived, not hand-typed):", shifts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
