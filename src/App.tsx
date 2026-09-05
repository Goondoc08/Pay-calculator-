import { useEffect, useState } from "react";
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
  const { profile, selectedYearId, setSelectedYearId, textSize, theme } =
    useAppData();
  const [setupOpen, setSetupOpen] = useState(profile === null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("period");

  // The text-size setting scales via a CSS rule keyed off this attribute on
  // <html> (src/index.css) — <html> lives outside the React root, so it's
  // synced imperatively rather than rendered as JSX.
  useEffect(() => {
    document.documentElement.setAttribute("data-text-size", textSize);
  }, [textSize]);

  // "system" removes the attribute entirely so index.css's
  // prefers-color-scheme media query is the only thing deciding — "light"
  // and "dark" force it explicitly, overriding the OS/browser preference.
  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const today = todayIso();
  const year = selectedYearId
    ? (getYear(selectedYearId) ?? resolveActiveYear(today))
    : resolveActiveYear(today);

  const [periodNumber, setPeriodNumber] = useState<number>(
    () => findPeriodForDate(year, today)?.n ?? 1,
  );
  const period =
    year.periods.find((p) => p.n === periodNumber) ?? year.periods[0];

  // "This Period" always means literally today's period, not wherever the
  // member last navigated to — Prev/Next, the Year list, and the jump grid
  // all leave you on the period you picked, but this tab is a snap-back,
  // every time it's clicked (including re-clicking it while already on it).
  function handleTabChange(next: Tab) {
    if (next === "period") {
      setPeriodNumber(findPeriodForDate(year, today)?.n ?? 1);
    }
    setTab(next);
  }

  if (setupOpen || !profile) {
    return <SetupScreen year={year} onDone={() => setSetupOpen(false)} />;
  }

  if (helpOpen) {
    return <HelpScreen onBack={() => setHelpOpen(false)} />;
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <TabBar tab={tab} onChange={handleTabChange} />
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
