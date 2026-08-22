import { migrateToCurrent } from "./migrate";
import { storedDataV1Schema, type StoredDataV1 } from "./schema";

export function exportToJson(data: StoredDataV1): string {
  return JSON.stringify(data, null, 2);
}

export interface ImportResult {
  ok: boolean;
  data?: StoredDataV1;
  error?: string;
}

export function importFromJson(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  const migrated = migrateToCurrent(parsed);
  const result = storedDataV1Schema.safeParse(migrated);
  if (!result.success) {
    return {
      ok: false,
      error: "That file doesn't look like a 48/96 export.",
    };
  }

  return { ok: true, data: result.data };
}
