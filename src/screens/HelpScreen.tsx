import type { ReactNode } from "react";
import { detectPlatform } from "../app/platform";
import { Steps } from "./InstallCard";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
      <h2 className="text-sm font-medium text-slate-200">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}

export function HelpScreen({ onBack }: { onBack: () => void }) {
  const platform = detectPlatform(navigator.userAgent);

  return (
    <div className="flex flex-col gap-4 p-4 text-slate-100">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-400"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">How to use this</h1>
      </div>

      <Section title="What this is">
        <p>
          A calculator for your 48/96 check — built from the same pay rules the
          department's own spreadsheet uses, but showing you which line is right
          or wrong instead of just a total.
        </p>
        <p className="text-amber-400">
          It's an estimate for comparison, not a payroll record. If it disagrees
          with your check, that's a reason to go ask — not proof on its own.
        </p>
      </Section>

      <Section title="First time">
        <p>
          Setup asks for your shift, rank, hourly rate, and certifications once.
          If you enter your hire date (or your last promotion date if it's more
          recent), it'll figure out your next step automatically — otherwise you
          can leave that blank and update your rate by hand whenever it changes.
        </p>
      </Section>

      <Section title="Every period">
        <p>
          <span className="text-slate-100">This Period</span> pre-fills your 24s
          from your normal rotation. You only touch the days that were
          different: called in sick, picked up a trade, worked a holiday, rode
          up a rank. Your total is pinned at the bottom; tap "Itemized
          breakdown" to see how it's built.
        </p>
      </Section>

      <Section title="Checking a real check">
        <p>
          Open "Compare to check" on the period screen and type in what your
          check actually paid, line by line. It'll tell you exactly which line
          is off and by how much — not just that something doesn't match.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          Everything stays on this device — nothing is sent anywhere. Back it up
          from Settings before you switch phones or clear your browser, since
          clearing site data wipes it for good.
        </p>
      </Section>

      <Section title="Install it">
        <Steps platform={platform} />
        <p className="text-xs text-slate-500">
          Once installed, it works with no signal at all — nothing on this
          screen or any period screen needs to reach the internet.
        </p>
      </Section>
    </div>
  );
}
