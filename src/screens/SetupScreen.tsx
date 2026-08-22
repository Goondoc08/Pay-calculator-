import { useState } from "react";
import { useAppData } from "../app/AppData";
import type { PayYear } from "../data/schema";
import type { Profile, ShiftLetter } from "../engine/types";

const NONE = "__none__";

function incentiveTotal(
  year: PayYear,
  selections: {
    tcfp: string;
    education: string;
    emt: string;
    bilingual: boolean;
    assignment: string;
  },
): number {
  let total = 0;
  if (selections.tcfp !== NONE)
    total += year.incentives.tcfp[selections.tcfp] ?? 0;
  if (selections.education !== NONE)
    total += year.incentives.education[selections.education] ?? 0;
  if (selections.emt !== NONE)
    total += year.incentives.emt[selections.emt] ?? 0;
  if (selections.bilingual) total += year.incentives.bilingual;
  if (selections.assignment !== NONE)
    total += year.incentives.assignment[selections.assignment] ?? 0;
  return total;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      {label}
      <select
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SetupScreen({
  year,
  onDone,
}: {
  year: PayYear;
  onDone: () => void;
}) {
  const { profile, setProfile } = useAppData();
  const firstSegment = profile?.rateSegments[0];

  const [shift, setShift] = useState<ShiftLetter>(profile?.shift ?? "A");
  const [hourlyRate, setHourlyRate] = useState(
    firstSegment ? String(firstSegment.hourlyRate) : "",
  );
  const [tcfp, setTcfp] = useState(NONE);
  const [education, setEducation] = useState(NONE);
  const [emt, setEmt] = useState(NONE);
  const [bilingual, setBilingual] = useState(false);
  const [assignment, setAssignment] = useState(NONE);

  const [hasStep, setHasStep] = useState(
    (profile?.rateSegments.length ?? 0) > 1,
  );
  const [stepDate, setStepDate] = useState(
    profile?.rateSegments[1]?.effectiveFrom ?? "",
  );
  const [stepRate, setStepRate] = useState(
    profile?.rateSegments[1] ? String(profile.rateSegments[1].hourlyRate) : "",
  );

  const incentives = incentiveTotal(year, {
    tcfp,
    education,
    emt,
    bilingual,
    assignment,
  });

  const parsedRate = Number(hourlyRate);
  const rateValid = hourlyRate.trim() !== "" && Number.isFinite(parsedRate);
  const parsedStepRate = Number(stepRate);
  const stepValid =
    !hasStep ||
    (stepDate.length > 0 &&
      stepRate.trim() !== "" &&
      Number.isFinite(parsedStepRate));
  const canSave = rateValid && stepValid;

  function handleSave() {
    if (!canSave) return;
    const newProfile: Profile = {
      shift,
      rateSegments: [
        {
          effectiveFrom: year.effectiveFrom,
          hourlyRate: parsedRate,
          incentiveTotal: incentives,
        },
        ...(hasStep
          ? [
              {
                effectiveFrom: stepDate,
                hourlyRate: parsedStepRate,
                incentiveTotal: incentives,
              },
            ]
          : []),
      ],
    };
    setProfile(newProfile);
    onDone();
  }

  return (
    <div className="flex flex-col gap-5 p-4 text-slate-100">
      <div>
        <h1 className="text-xl font-semibold">Setup</h1>
        <p className="mt-1 text-sm text-slate-400">
          One-time setup. Update your rate here again whenever you get a step or
          a raise.
        </p>
      </div>

      <Select
        label="Shift"
        value={shift}
        onChange={(v) => setShift(v as ShiftLetter)}
        options={[
          { value: "A", label: "A-Shift" },
          { value: "B", label: "B-Shift" },
          { value: "C", label: "C-Shift" },
        ]}
      />

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Hourly rate
        <input
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
          type="number"
          step="0.0001"
          inputMode="decimal"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="26.8173"
        />
      </label>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 p-3">
        <h2 className="text-sm font-medium text-slate-300">Certifications</h2>
        <Select
          label="TCFP"
          value={tcfp}
          onChange={setTcfp}
          options={[
            { value: NONE, label: "None" },
            ...Object.keys(year.incentives.tcfp).map((k) => ({
              value: k,
              label: k,
            })),
          ]}
        />
        <Select
          label="Education"
          value={education}
          onChange={setEducation}
          options={[
            { value: NONE, label: "None" },
            ...Object.keys(year.incentives.education).map((k) => ({
              value: k,
              label: k,
            })),
          ]}
        />
        <Select
          label="EMT"
          value={emt}
          onChange={setEmt}
          options={[
            { value: NONE, label: "None" },
            ...Object.keys(year.incentives.emt).map((k) => ({
              value: k,
              label: k,
            })),
          ]}
        />
        <Select
          label="Assignment"
          value={assignment}
          onChange={setAssignment}
          options={[
            { value: NONE, label: "None" },
            ...Object.keys(year.incentives.assignment).map((k) => ({
              value: k,
              label: k,
            })),
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={bilingual}
            onChange={(e) => setBilingual(e.target.checked)}
          />
          Bilingual
        </label>
        <p className="text-sm text-slate-400">
          Incentive total:{" "}
          <span className="text-slate-100">${incentives.toFixed(4)}/hr</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-800 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={hasStep}
            onChange={(e) => setHasStep(e.target.checked)}
          />
          I have a rate change landing on a specific date
        </label>
        {hasStep && (
          <>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Step date
              <input
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                type="date"
                value={stepDate}
                onChange={(e) => setStepDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              New hourly rate
              <input
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                type="number"
                step="0.0001"
                inputMode="decimal"
                value={stepRate}
                onChange={(e) => setStepRate(e.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <button
        type="button"
        disabled={!canSave}
        onClick={handleSave}
        className="rounded-md bg-emerald-600 px-4 py-3 font-medium text-white disabled:opacity-40"
      >
        Save
      </button>

      <p className="text-xs text-slate-500">
        This is an unofficial estimation tool for personal comparison. It is not
        a payroll record and carries no authority in a pay dispute.
      </p>
    </div>
  );
}
