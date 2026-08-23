import { useState } from "react";
import { AppDataProvider, useAppData } from "./app/AppData";
import { findPeriodForDate } from "./app/period";
import { getYear, resolveActiveYear, todayIso } from "./app/years";
import { HelpScreen } from "./screens/HelpScreen";
import { InstallCard } from "./screens/InstallCard";
import { PeriodScreen } from "./screens/PeriodScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { YearScreen } from "./screens/YearScreen";

type Tab = "period" | "year" | "settings";

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "period", label: "This Period" },
    { key: "year", label: "Year" },
    { key: "settings", label: "Settings" },
  ];
  return (
    <nav className="flex border-b border-line bg-brand">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`flex-1 border-b-2 py-3 text-sm transition-colors ${
            tab === t.key
              ? "border-holiday font-semibold text-brand-ink"
              : "border-transparent font-medium text-brand-ink/80"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function AppShell() {
  const { profile, selectedYearId, setSelectedYearId } = useAppData();
  const [setupOpen, setSetupOpen] = useState(profile === null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("period");

  const today = todayIso();
  const year = selectedYearId
    ? (getYear(selectedYearId) ?? resolveActiveYear(today))
    : resolveActiveYear(today);

  const [periodNumber, setPeriodNumber] = useState<number>(
    () => findPeriodForDate(year, today)?.n ?? 1,
  );
  const period =
    year.periods.find((p) => p.n === periodNumber) ?? year.periods[0];

  if (setupOpen || !profile) {
    return <SetupScreen year={year} onDone={() => setSetupOpen(false)} />;
  }

  if (helpOpen) {
    return <HelpScreen onBack={() => setHelpOpen(false)} />;
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <TabBar tab={tab} onChange={setTab} />
      <InstallCard />
      {tab === "period" && (
        <PeriodScreen
          year={year}
          profile={profile}
          period={period}
          onNavigate={setPeriodNumber}
        />
      )}
      {tab === "year" && (
        <YearScreen
          year={year}
          profile={profile}
          onSelectPeriod={(n) => {
            setPeriodNumber(n);
            setTab("period");
          }}
          onSelectYear={(yearId) => {
            const y = getYear(yearId);
            if (y) {
              setSelectedYearId(yearId);
              setPeriodNumber(y.periods[0].n);
            }
          }}
        />
      )}
      {tab === "settings" && (
        <SettingsScreen
          onEditSetup={() => setSetupOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onWiped={() => {
            setSetupOpen(true);
            setTab("period");
          }}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}
