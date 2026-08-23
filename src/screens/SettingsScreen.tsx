import { useRef, useState } from "react";
import { useAppData } from "../app/AppData";
import { AVAILABLE_YEARS } from "../app/years";

export function SettingsScreen({
  onEditSetup,
  onOpenHelp,
  onWiped,
}: {
  onEditSetup: () => void;
  onOpenHelp: () => void;
  onWiped: () => void;
}) {
  const { exportJson, importJson, wipe, selectedYearId, setSelectedYearId } =
    useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingWipe, setConfirmingWipe] = useState(false);

  function handleExport() {
    const json = exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pay-calculator-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importJson(String(reader.result));
      setMessage(
        result.ok ? "Import successful." : (result.error ?? "Import failed."),
      );
    };
    reader.readAsText(file);
  }

  function handleWipe() {
    wipe();
    setConfirmingWipe(false);
    onWiped();
  }

  return (
    <div className="flex flex-col gap-5 p-4 text-slate-100">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
        <h2 className="text-sm font-medium text-slate-300">Active year</h2>
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          value={selectedYearId ?? "auto"}
          onChange={(e) =>
            setSelectedYearId(e.target.value === "auto" ? null : e.target.value)
          }
        >
          <option value="auto">Auto (based on today's date)</option>
          {AVAILABLE_YEARS.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
        <h2 className="text-sm font-medium text-slate-300">Help</h2>
        <button
          type="button"
          onClick={onOpenHelp}
          className="rounded-md border border-slate-700 px-3 py-2 text-left text-sm"
        >
          How to use this / install instructions
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
        <h2 className="text-sm font-medium text-slate-300">Profile</h2>
        <button
          type="button"
          onClick={onEditSetup}
          className="rounded-md border border-slate-700 px-3 py-2 text-left text-sm"
        >
          Edit shift, rate, and certifications
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
        <h2 className="text-sm font-medium text-slate-300">Backup</h2>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-slate-700 px-3 py-2 text-left text-sm"
        >
          Export data
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-slate-700 px-3 py-2 text-left text-sm"
        >
          Import data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
        {message && <p className="text-sm text-slate-400">{message}</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-red-900/50 p-3">
        <h2 className="text-sm font-medium text-red-400">Danger zone</h2>
        {!confirmingWipe ? (
          <button
            type="button"
            onClick={() => setConfirmingWipe(true)}
            className="rounded-md border border-red-800 px-3 py-2 text-left text-sm text-red-300"
          >
            Wipe all data
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-red-300">
              This deletes your profile and every period you've entered, on this
              device only. Export a backup first if you want to keep it.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleWipe}
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white"
              >
                Yes, wipe everything
              </button>
              <button
                type="button"
                onClick={() => setConfirmingWipe(false)}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        This is an unofficial tool for personal comparison. Data stays on this
        device — nothing is transmitted anywhere. It is not a payroll record and
        carries no authority in a pay dispute.
      </p>
    </div>
  );
}
