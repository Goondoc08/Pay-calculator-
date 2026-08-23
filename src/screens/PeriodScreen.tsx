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
import type { Destination, PayGrade, Profile } from "../engine/types";

const TYPE_LABELS: Record<DayEntryType, string> = {
  off: "Off",
  regular: "Regular",
  pto: "PTO",
  holidayWorked: "Holiday worked",
  holidayObserved: "Holiday observed",
  stepUp: "Step-up",
  tifmas: "TIFMAS",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayName(iso: string): string {
  return DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

function DayRow({
  entry,
  stepUpGrades,
  onChange,
}: {
  entry: DayEntry;
  stepUpGrades: PayGrade[];
  onChange: (next: DayEntry) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">
          {weekdayName(entry.date)} {entry.date.slice(5)}
          {entry.isHoliday && (
            <span className="ml-2 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-300">
              holiday
            </span>
          )}
        </span>
        {entry.scheduledHours > 0 && (
          <span className="text-xs text-slate-500">
            scheduled {entry.scheduledHours}h
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          value={entry.type}
          onChange={(e) => {
            const type = e.target.value as DayEntryType;
            const defaultHours =
              type === "off"
                ? 0
                : type === "holidayObserved"
                  ? 12
                  : entry.scheduledHours || entry.hours || 24;
            onChange({ ...entry, type, hours: defaultHours });
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
            className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            type="number"
            min={0}
            step="0.25"
            value={entry.hours}
            onChange={(e) =>
              onChange({ ...entry, hours: Number(e.target.value) || 0 })
            }
          />
        )}

        {entry.type !== "off" && entry.type !== "pto" && (
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            value={entry.destination}
            onChange={(e) =>
              onChange({
                ...entry,
                destination: e.target.value as Destination,
              })
            }
          >
            <option value="cash">Cash</option>
            <option value="comp">Comp</option>
            <option value="accrue">Accrue</option>
          </select>
        )}

        {entry.type === "stepUp" && (
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
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

      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <DayRow
            key={entry.date}
            entry={entry}
            stepUpGrades={stepUpGrades}
            onChange={(next) => updateEntry(i, next)}
          />
        ))}
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
