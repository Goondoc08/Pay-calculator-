/**
 * Builds a spreadsheet-friendly CSV of a year's periods — one row per pay
 * period, mirroring what the Year screen already shows on screen. Kept
 * separate from the JSON backup in Settings: that's a full data dump meant
 * for re-importing into this app, this is a plain table meant for opening
 * in Excel/Sheets or handing to someone else.
 */
export interface YearCsvRow {
  periodNumber: number;
  start: string;
  end: string;
  totalHours: number;
  otHours: number;
  gross: number;
  running: number;
  hasEntries: boolean;
}

const HEADER = [
  "Period",
  "Start",
  "End",
  "Total Hours",
  "OT Hours",
  "Gross Pay",
  "Running Total",
  "Status",
];

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildYearCsv(rows: YearCsvRow[]): string {
  const lines = [HEADER.map(csvField).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.periodNumber,
        r.start,
        r.end,
        r.totalHours,
        r.otHours,
        r.gross.toFixed(2),
        r.running.toFixed(2),
        r.hasEntries ? "Entered" : "Default schedule",
      ]
        .map(csvField)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
