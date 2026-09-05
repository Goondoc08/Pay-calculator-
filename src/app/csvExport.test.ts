import { describe, expect, it } from "vitest";
import { buildYearCsv, type YearCsvRow } from "./csvExport";

describe("buildYearCsv", () => {
  it("emits a header row and no data rows when empty", () => {
    expect(buildYearCsv([])).toBe(
      "Period,Start,End,Total Hours,OT Hours,Gross Pay,Running Total,Status\r\n",
    );
  });

  it("formats a period row with two-decimal money and a plain-English status", () => {
    const rows: YearCsvRow[] = [
      {
        periodNumber: 1,
        start: "2026-09-27",
        end: "2026-10-10",
        totalHours: 120,
        otHours: 14,
        gross: 3513.6,
        running: 3513.6,
        hasEntries: true,
      },
      {
        periodNumber: 2,
        start: "2026-10-11",
        end: "2026-10-24",
        totalHours: 96,
        otHours: 0,
        gross: 2810.88,
        running: 6324.48,
        hasEntries: false,
      },
    ];
    const csv = buildYearCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Period,Start,End,Total Hours,OT Hours,Gross Pay,Running Total,Status",
    );
    expect(lines[1]).toBe(
      "1,2026-09-27,2026-10-10,120,14,3513.60,3513.60,Entered",
    );
    expect(lines[2]).toBe(
      "2,2026-10-11,2026-10-24,96,0,2810.88,6324.48,Default schedule",
    );
    expect(lines[3]).toBe(""); // trailing \r\n
  });
});
