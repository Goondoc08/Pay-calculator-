import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { exportToJson, importFromJson } from "../storage/exportImport";
import { clear, load, save } from "../storage/localStorage";
import {
  periodEntryKey,
  type StoredDataV1,
  type certificationsSchema,
  type progressionSchema,
} from "../storage/schema";
import type { HourBlock, Profile } from "../engine/types";
import type { z } from "zod";

type Progression = z.infer<typeof progressionSchema>;
type Certifications = z.infer<typeof certificationsSchema>;

interface AppDataValue {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  progression: Progression | null;
  setProgression: (progression: Progression | null) => void;
  certifications: Certifications | null;
  setCertifications: (certifications: Certifications | null) => void;
  getPeriodBlocks: (yearId: string, periodNumber: number) => HourBlock[];
  setPeriodBlocks: (
    yearId: string,
    periodNumber: number,
    blocks: HourBlock[],
  ) => void;
  selectedYearId: string | null;
  setSelectedYearId: (id: string | null) => void;
  installCardDismissed: boolean;
  dismissInstallCard: () => void;
  saveError: string | null;
  exportJson: () => string;
  importJson: (json: string) => { ok: boolean; error: string | undefined };
  wipe: () => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoredDataV1>(() => load().data);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasMounted = useRef(false);

  // Every setter below only ever queues a *functional* update, so calling
  // several of them in the same handler (e.g. Setup saving both the
  // profile and the progression info in one click) composes correctly
  // instead of each one clobbering the other with a stale `data` snapshot.
  const update = useCallback((patch: (prev: StoredDataV1) => StoredDataV1) => {
    setData(patch);
  }, []);

  // Persisting is a side effect of the resolved state, not of any one
  // setter call, so it can't race with `update` calls made in the same tick.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    const result = save(data);
    setSaveError(result.ok ? null : (result.error ?? "Couldn't save."));
  }, [data]);

  const setProfile = useCallback(
    (profile: Profile) => {
      update((prev) => ({ ...prev, profile }));
    },
    [update],
  );

  const setProgression = useCallback(
    (progression: Progression | null) => {
      update((prev) => ({ ...prev, progression }));
    },
    [update],
  );

  const setCertifications = useCallback(
    (certifications: Certifications | null) => {
      update((prev) => ({ ...prev, certifications }));
    },
    [update],
  );

  const getPeriodBlocks = useCallback(
    (yearId: string, periodNumber: number): HourBlock[] => {
      return data.periodEntries[periodEntryKey(yearId, periodNumber)] ?? [];
    },
    [data.periodEntries],
  );

  const setPeriodBlocks = useCallback(
    (yearId: string, periodNumber: number, blocks: HourBlock[]) => {
      update((prev) => ({
        ...prev,
        periodEntries: {
          ...prev.periodEntries,
          [periodEntryKey(yearId, periodNumber)]: blocks,
        },
      }));
    },
    [update],
  );

  const setSelectedYearId = useCallback(
    (id: string | null) => {
      update((prev) => ({
        ...prev,
        settings: { ...prev.settings, selectedYearId: id },
      }));
    },
    [update],
  );

  const dismissInstallCard = useCallback(() => {
    update((prev) => ({
      ...prev,
      settings: { ...prev.settings, installCardDismissed: true },
    }));
  }, [update]);

  const exportJson = useCallback(() => exportToJson(data), [data]);

  const importJson = useCallback(
    (json: string) => {
      const result = importFromJson(json);
      if (result.ok && result.data) {
        const imported = result.data;
        update(() => imported);
        return { ok: true, error: undefined };
      }
      return { ok: false, error: result.error };
    },
    [update],
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
      progression: data.progression,
      setProgression,
      certifications: data.certifications,
      setCertifications,
      getPeriodBlocks,
      setPeriodBlocks,
      selectedYearId: data.settings.selectedYearId,
      setSelectedYearId,
      installCardDismissed: data.settings.installCardDismissed,
      dismissInstallCard,
      saveError,
      exportJson,
      importJson,
      wipe,
    }),
    [
      data.profile,
      data.progression,
      data.certifications,
      data.settings.selectedYearId,
      data.settings.installCardDismissed,
      setProfile,
      setProgression,
      setCertifications,
      getPeriodBlocks,
      setPeriodBlocks,
      setSelectedYearId,
      dismissInstallCard,
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
