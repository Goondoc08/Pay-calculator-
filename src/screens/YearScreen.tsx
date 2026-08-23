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
  const { getPeriodBlocks, progression } = useAppData();
  const memberGrade = progression?.grade ?? null;

  const rows = useMemo(() => {
    let running = 0;
    return year.periods.map((period) => {
      const saved = getPeriodBlocks(year.id, period.n);
      const entries =
        saved.length > 0
          ? blocksToEntries(year, profile.shift, period, saved, memberGrade)
          : defaultDayEntries(year, profile.shift, period, memberGrade);
      const result = computePeriod(year, profile, entriesToBlocks(entries));
      running += result.gross;
      return {
        period,
        gross: result.gross,
        running,
        hasEntries: saved.length > 0,
      };
    });
  }, [year, profile, getPeriodBlocks, memberGrade]);

  return (
    <div className="flex flex-col gap-4 p-4 text-ink">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{year.label}</h1>
        {AVAILABLE_YEARS.length > 1 && (
          <select
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
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
            className="flex items-center justify-between rounded-lg border border-line p-3 text-left"
          >
            <div>
              <div className="text-sm font-medium">
                Period {period.n}
                {!hasEntries && (
                  <span className="ml-2 text-xs text-ink-muted">
                    (default schedule)
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-muted">
                {period.start} – {period.end}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">${gross.toFixed(2)}</div>
              <div className="text-xs text-ink-muted">
                running ${running.toFixed(2)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
