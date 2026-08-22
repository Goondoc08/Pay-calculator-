import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { exportToJson, importFromJson } from "../storage/exportImport";
import { clear, load, save } from "../storage/localStorage";
import { periodEntryKey, type StoredDataV1 } from "../storage/schema";
import type { HourBlock, Profile } from "../engine/types";

interface AppDataValue {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  getPeriodBlocks: (yearId: string, periodNumber: number) => HourBlock[];
  setPeriodBlocks: (
    yearId: string,
    periodNumber: number,
    blocks: HourBlock[],
  ) => void;
  selectedYearId: string | null;
  setSelectedYearId: (id: string | null) => void;
  saveError: string | null;
  exportJson: () => string;
  importJson: (json: string) => { ok: boolean; error: string | undefined };
  wipe: () => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoredDataV1>(() => load().data);
  const [saveError, setSaveError] = useState<string | null>(null);

  const persist = useCallback((next: StoredDataV1) => {
    setData(next);
    const result = save(next);
    setSaveError(result.ok ? null : (result.error ?? "Couldn't save."));
  }, []);

  const setProfile = useCallback(
    (profile: Profile) => {
      persist({ ...data, profile });
    },
    [data, persist],
  );

  const getPeriodBlocks = useCallback(
    (yearId: string, periodNumber: number): HourBlock[] => {
      return data.periodEntries[periodEntryKey(yearId, periodNumber)] ?? [];
    },
    [data.periodEntries],
  );

  const setPeriodBlocks = useCallback(
    (yearId: string, periodNumber: number, blocks: HourBlock[]) => {
      persist({
        ...data,
        periodEntries: {
          ...data.periodEntries,
          [periodEntryKey(yearId, periodNumber)]: blocks,
        },
      });
    },
    [data, persist],
  );

  const setSelectedYearId = useCallback(
    (id: string | null) => {
      persist({ ...data, settings: { ...data.settings, selectedYearId: id } });
    },
    [data, persist],
  );

  const exportJson = useCallback(() => exportToJson(data), [data]);

  const importJson = useCallback(
    (json: string) => {
      const result = importFromJson(json);
      if (result.ok && result.data) {
        persist(result.data);
        return { ok: true, error: undefined };
      }
      return { ok: false, error: result.error };
    },
    [persist],
  );

  const wipe = useCallback(() => {
    clear();
    setData(load().data);
    setSaveError(null);
  }, []);

  const value = useMemo<AppDataValue>(
    () => ({
      profile: data.profile,
      setProfile,
      getPeriodBlocks,
      setPeriodBlocks,
      selectedYearId: data.settings.selectedYearId,
      setSelectedYearId,
      saveError,
      exportJson,
      importJson,
      wipe,
    }),
    [
      data.profile,
      data.settings.selectedYearId,
      setProfile,
      getPeriodBlocks,
      setPeriodBlocks,
      setSelectedYearId,
      saveError,
      exportJson,
      importJson,
      wipe,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return ctx;
}
