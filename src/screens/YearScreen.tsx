import { useMemo } from "react";
import { AVAILABLE_YEARS } from "../app/years";
import { useAppData } from "../app/AppData";
import {
  blocksToEntries,
  defaultDayEntries,
  entriesToBlocks,
} from "../app/period";
import type { PayYear } from "../data/schema";
import { computePeriod } from "../engine/period";
import type { Profile } from "../engine/types";

export function YearScreen({
  year,
  profile,
  onSelectPeriod,
  onSelectYear,
}: {
  year: PayYear;
  profile: Profile;
  onSelectPeriod: (periodNumber: number) => void;
  onSelectYear: (yearId: string) => void;
}) {
  const { getPeriodBlocks } = useAppData();

  const rows = useMemo(() => {
    let running = 0;
    return year.periods.map((period) => {
      const saved = getPeriodBlocks(year.id, period.n);
      const entries =
        saved.length > 0
          ? blocksToEntries(year, profile.shift, period, saved)
          : defaultDayEntries(year, profile.shift, period);
      const result = computePeriod(year, profile, entriesToBlocks(entries));
      running += result.gross;
      return {
        period,
        gross: result.gross,
        running,
        hasEntries: saved.length > 0,
      };
    });
  }, [year, profile, getPeriodBlocks]);

  return (
    <div className="flex flex-col gap-4 p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{year.label}</h1>
        {AVAILABLE_YEARS.length > 1 && (
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            value={year.id}
            onChange={(e) => onSelectYear(e.target.value)}
          >
            {AVAILABLE_YEARS.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map(({ period, gross, running, hasEntries }) => (
          <button
            key={period.n}
            type="button"
            onClick={() => onSelectPeriod(period.n)}
            className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-left"
          >
            <div>
              <div className="text-sm font-medium">
                Period {period.n}
                {!hasEntries && (
                  <span className="ml-2 text-xs text-slate-500">
                    (default schedule)
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {period.start} – {period.end}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">${gross.toFixed(2)}</div>
              <div className="text-xs text-slate-500">
                running ${running.toFixed(2)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
