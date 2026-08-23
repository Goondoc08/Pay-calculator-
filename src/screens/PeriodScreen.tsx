import { useMemo, useState } from "react";
import { useAppData } from "../app/AppData";
import {
  aggregateLineItems,
  blocksToEntries,
  defaultDayEntries,
  entriesToBlocks,
  type DayEntry,
  type DayEntryType,
} from "../app/period";
import type { PayYear, Period } from "../data/schema";
import { computePeriod } from "../engine/period";
import type { PayGrade, Profile } from "../engine/types";

const TYPE_LABELS: Record<DayEntryType, string> = {
  off: "Off",
  regular: "Regular",
  pto: "PTO",
  stepUp: "Step-up",
  tifmas: "TIFMAS",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayName(iso: string): string {
  return DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/**
 * One calendar cell in the period grid — deliberately dense (closer to the
 * sheet's own layout than a stack of cards) since that's what the day-to-day
 * entry screen is compared against.
 */
function DayCell({
  entry,
  stepUpGrades,
  onChange,
}: {
  entry: DayEntry;
  stepUpGrades: PayGrade[];
  onChange: (next: DayEntry) => void;
}) {
  const dayLabel = (
    <div className="flex items-baseline justify-between">
      <span className="text-xs font-medium text-slate-300">
        {weekdayName(entry.date)} {entry.date.slice(8)}
      </span>
      {entry.isHoliday && (
        <span className="rounded bg-amber-900/50 px-1 text-[10px] leading-4 text-amber-300">
          holiday
        </span>
      )}
    </div>
  );

  if (entry.isHoliday) {
    const worked = Math.min(24, Math.max(0, entry.holidayHoursWorked));
    const leftover = Math.max(0, 12 - worked);
    return (
      <div className="flex flex-col gap-1 rounded border border-amber-900/40 bg-amber-950/10 p-1.5">
        {dayLabel}
        <label className="flex items-center gap-1 text-[11px] text-slate-400">
          worked
          <input
            className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
            type="number"
            min={0}
            max={24}
            step="0.25"
            value={entry.holidayHoursWorked}
            onChange={(e) =>
              onChange({
                ...entry,
                holidayHoursWorked: Number(e.target.value) || 0,
              })
            }
          />
        </label>
        <p className="text-[10px] leading-tight text-slate-500">
          {worked > 0 && `${worked}h HW`}
          {worked > 0 && leftover > 0 && " + "}
          {leftover > 0 && `${leftover}h HO`}
          {worked === 0 && leftover === 0 && "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded border border-slate-800 p-1.5">
      {dayLabel}
      <select
        className="w-full rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
        value={entry.type}
        onChange={(e) => {
          const type = e.target.value as DayEntryType;
          const hours =
            type === "off" ? 0 : entry.scheduledHours || entry.hours || 24;
          onChange({ ...entry, type, hours });
        }}
      >
        {(Object.keys(TYPE_LABELS) as DayEntryType[]).map((t) => (
          <option key={t} value={t}>
            {TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      {entry.type !== "off" && (
        <input
          className="w-full rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
          type="number"
          min={0}
          step="0.25"
          value={entry.hours}
          onChange={(e) =>
            onChange({ ...entry, hours: Number(e.target.value) || 0 })
          }
        />
      )}

      {entry.type === "stepUp" && (
        <select
          className="w-full rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
          value={entry.grade}
          onChange={(e) =>
            onChange({ ...entry, grade: e.target.value as PayGrade })
          }
        >
          {stepUpGrades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function CompareToCheck({
  aggregated,
  gross,
}: {
  aggregated: { label: string; hours: number; amount: number }[];
  gross: number;
}) {
  const [open, setOpen] = useState(false);
  const [checkTotal, setCheckTotal] = useState("");
  const [checkByLabel, setCheckByLabel] = useState<Record<string, string>>({});

  const totalDelta =
    checkTotal.trim() === "" ? null : Number(checkTotal) - gross;

  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <button
        type="button"
        className="w-full text-left text-sm font-medium text-slate-200"
        onClick={() => setOpen((o) => !o)}
      >
        Compare to check {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            What the check paid (total)
            <input
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              type="number"
              step="0.01"
              value={checkTotal}
              onChange={(e) => setCheckTotal(e.target.value)}
            />
          </label>
          {totalDelta !== null && (
            <p
              className={`text-sm ${Math.abs(totalDelta) < 0.01 ? "text-emerald-400" : "text-amber-400"}`}
            >
              {Math.abs(totalDelta) < 0.01
                ? "Matches, to the cent."
                : `Total is off by $${Math.abs(totalDelta).toFixed(2)} (${totalDelta > 0 ? "check paid more" : "check paid less"}).`}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {aggregated.map((item) => {
              const checkValue = checkByLabel[item.label] ?? "";
              const delta =
                checkValue.trim() === ""
                  ? null
                  : Number(checkValue) - item.amount;
              return (
                <div key={item.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{item.label}</span>
                    <span className="text-slate-500">
                      computed ${item.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      type="number"
                      step="0.01"
                      placeholder="check said..."
                      value={checkValue}
                      onChange={(e) =>
                        setCheckByLabel((prev) => ({
                          ...prev,
                          [item.label]: e.target.value,
                        }))
                      }
                    />
                    {delta !== null && Math.abs(delta) >= 0.01 && (
                      <span className="text-xs text-amber-400">
                        your {item.label.toLowerCase()} is{" "}
                        {delta > 0 ? "over" : "missing"} $
                        {Math.abs(delta).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PeriodScreen({
  year,
  profile,
  period,
  onNavigate,
}: {
  year: PayYear;
  profile: Profile;
  period: Period;
  onNavigate: (periodNumber: number) => void;
}) {
  const { getPeriodBlocks, setPeriodBlocks } = useAppData();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const entries = useMemo<DayEntry[]>(() => {
    const saved = getPeriodBlocks(year.id, period.n);
    if (saved.length > 0) {
      return blocksToEntries(year, profile.shift, period, saved);
    }
    return defaultDayEntries(year, profile.shift, period);
  }, [year, profile.shift, period, getPeriodBlocks]);

  function updateEntry(index: number, next: DayEntry) {
    const updated = entries.slice();
    updated[index] = next;
    setPeriodBlocks(year.id, period.n, entriesToBlocks(updated));
  }

  const blocks = entriesToBlocks(entries);
  const result = computePeriod(year, profile, blocks);
  const aggregated = aggregateLineItems(result.lineItems);
  // F1 is never a step-up target (it's the base grade); every grade above
  // it is a valid ride-up, and the set varies by year (FY26 has F1..F5,
  // FY27's proposed merger drops it to F1..F4).
  const stepUpGrades = (Object.keys(year.payPlan) as PayGrade[]).filter(
    (g) => g !== "F1",
  );

  const week1 = entries.slice(0, 7);
  const week2 = entries.slice(7, 14);

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 text-slate-100">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={period.n <= 1}
          onClick={() => onNavigate(period.n - 1)}
          className="rounded-md px-3 py-2 text-slate-300 disabled:opacity-30"
        >
          ← Prev
        </button>
        <div className="text-center">
          <div className="text-sm text-slate-400">Period {period.n}</div>
          <div className="text-xs text-slate-500">
            {period.start} – {period.end}
          </div>
        </div>
        <button
          type="button"
          disabled={period.n >= year.periods.length}
          onClick={() => onNavigate(period.n + 1)}
          className="rounded-md px-3 py-2 text-slate-300 disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-7 gap-1">
          {week1.map((entry) => (
            <DayCell
              key={entry.date}
              entry={entry}
              stepUpGrades={stepUpGrades}
              onChange={(next) =>
                updateEntry(
                  entries.findIndex((e) => e.date === entry.date),
                  next,
                )
              }
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week2.map((entry) => (
            <DayCell
              key={entry.date}
              entry={entry}
              stepUpGrades={stepUpGrades}
              onChange={(next) =>
                updateEntry(
                  entries.findIndex((e) => e.date === entry.date),
                  next,
                )
              }
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 p-3">
        <button
          type="button"
          className="w-full text-left text-sm font-medium text-slate-200"
          onClick={() => setBreakdownOpen((o) => !o)}
        >
          Itemized breakdown {breakdownOpen ? "▲" : "▼"}
        </button>
        {breakdownOpen && (
          <div className="mt-3 flex flex-col gap-1">
            {aggregated.map((item) => (
              <div
                key={item.label}
                className="flex justify-between text-sm text-slate-300"
              >
                <span>
                  {item.label} ({item.hours}h)
                </span>
                <span>${item.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <CompareToCheck aggregated={aggregated} gross={result.gross} />

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <span className="text-sm text-slate-400">Gross</span>
          <span className="text-2xl font-semibold">
            ${result.gross.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
