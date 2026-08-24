import { migrateToCurrent } from "./migrate";
import {
  emptyStoredData,
  hourBlockListSchema,
  profileSchema,
  progressionSchema,
  settingsSchema,
  storedDataV1Schema,
  type StoredDataV1,
} from "./schema";

// Deliberately NOT renamed to match the app's "Pay Check" branding —
// changing this key would orphan every profile and period already entered
// on a real device (this app's own test devices included), since the app
// would look for a key that doesn't exist and silently show a blank
// first-run Setup instead. The storage key has no user-visible tie to the
// app's display name; there's nothing to gain by moving it.
export const STORAGE_KEY = "pay-calculator:v1";

/** The subset of the Storage interface we need — lets tests inject a fake
 * without a DOM, and lets callers substitute an in-memory store when
 * localStorage is unavailable (private browsing, disabled cookies). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultStorage(): StorageLike | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

/**
 * Recovers whatever still validates from a payload that failed full
 * validation — e.g. one corrupt period entry shouldn't cost the member
 * their profile and every other period they've already entered.
 */
function recoverPartial(data: Record<string, unknown>): StoredDataV1 {
  const base = emptyStoredData();

  const profileResult = profileSchema.nullable().safeParse(data.profile);
  if (profileResult.success) base.profile = profileResult.data;

  if (typeof data.periodEntries === "object" && data.periodEntries !== null) {
    for (const [key, value] of Object.entries(
      data.periodEntries as Record<string, unknown>,
    )) {
      const blocksResult = hourBlockListSchema.safeParse(value);
      if (blocksResult.success) base.periodEntries[key] = blocksResult.data;
    }
  }

  const settingsResult = settingsSchema.safeParse(data.settings);
  if (settingsResult.success) base.settings = settingsResult.data;

  const progressionResult = progressionSchema
    .nullable()
    .safeParse(data.progression);
  if (progressionResult.success) base.progression = progressionResult.data;

  return base;
}

export interface LoadResult {
  data: StoredDataV1;
  /** True if anything was missing, corrupt, blocked, or migrated —
   * surfaced so the UI can nudge toward a backup rather than fail silently. */
  recovered: boolean;
}

export function load(
  storage: StorageLike | null = defaultStorage(),
): LoadResult {
  if (!storage) {
    return { data: emptyStoredData(), recovered: false };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyStoredData(), recovered: true };
  }

  if (raw === null) {
    return { data: emptyStoredData(), recovered: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: emptyStoredData(), recovered: true };
  }

  const migrated = migrateToCurrent(parsed);
  const wasMigrated = migrated !== parsed;

  const result = storedDataV1Schema.safeParse(migrated);
  if (result.success) {
    return { data: result.data, recovered: wasMigrated };
  }

  if (typeof migrated === "object" && migrated !== null) {
    return {
      data: recoverPartial(migrated as Record<string, unknown>),
      recovered: true,
    };
  }

  return { data: emptyStoredData(), recovered: true };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function save(
  data: StoredDataV1,
  storage: StorageLike | null = defaultStorage(),
): SaveResult {
  if (!storage) {
    return { ok: false, error: "Storage is unavailable in this browser." };
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown storage error";
    return { ok: false, error: `Couldn't save (${message}).` };
  }
}

export function clear(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover to — clearing failed, but leaving stale data in
    // place is safer than throwing out of a "wipe my data" button.
  }
}
