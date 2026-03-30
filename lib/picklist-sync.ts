import { supabase } from "@/lib/supabase";

export interface StoredPickList {
  entries: {
    teamNumber: number;
    teamName: string;
    opr: number;
    notes: string;
    picked: boolean;
  }[];
  myTeamNumber: number | null;
  updatedAt?: string; // ISO string for sync
}

// ── localStorage ──

function storageKey(code: string) {
  return `picklistftc_picklist_${code}`;
}

export function loadLocalPickList(code: string): StoredPickList | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalPickList(code: string, data: StoredPickList): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(data));
  } catch { /* quota exceeded or private mode */ }
}

// ── Supabase Cloud Sync ──

export async function loadCloudPickList(
  userId: string,
  eventCode: string
): Promise<{ data: StoredPickList; updatedAt: string } | null> {
  try {
    const { data, error } = await supabase
      .from("pick_lists")
      .select("list_data, updated_at")
      .eq("user_id", userId)
      .eq("event_code", eventCode)
      .single();

    if (error || !data) return null;

    return {
      data: data.list_data as StoredPickList,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

export async function saveCloudPickList(
  userId: string,
  eventCode: string,
  listData: StoredPickList
): Promise<void> {
  try {
    const now = new Date().toISOString();
    listData.updatedAt = now;

    await supabase.from("pick_lists").upsert(
      {
        user_id: userId,
        event_code: eventCode,
        list_data: listData,
        updated_at: now,
      },
      { onConflict: "user_id,event_code" }
    );
  } catch {
    // Silently fail — localStorage is the fallback
  }
}

/** Publish pick list for team viewing */
export async function publishPickList(
  userId: string,
  eventCode: string,
  listData: StoredPickList
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase.from("pick_lists").upsert(
      {
        user_id: userId,
        event_code: eventCode,
        list_data: { ...listData, published: true },
        updated_at: now,
      },
      { onConflict: "user_id,event_code" }
    );
  } catch {
    // Silently fail
  }
}

/** Load published pick lists from teammates */
export async function loadTeamPickLists(
  teamNumber: number,
  eventCode: string,
  myUserId: string
): Promise<{ authorName: string; listData: StoredPickList }[]> {
  try {
    const { data: teammates, error: teamError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("team_number", teamNumber);

    if (teamError || !teammates) return [];

    const teammateIds = teammates
      .filter((t) => t.id !== myUserId)
      .map((t) => t.id);

    if (teammateIds.length === 0) return [];

    const { data, error } = await supabase
      .from("pick_lists")
      .select("user_id, list_data")
      .eq("event_code", eventCode)
      .in("user_id", teammateIds);

    if (error || !data) return [];

    const nameMap = new Map(teammates.map((t) => [t.id, t.display_name]));

    return data
      .filter((row) => (row.list_data as StoredPickList & { published?: boolean }).published)
      .map((row) => ({
        authorName: nameMap.get(row.user_id) ?? "Teammate",
        listData: row.list_data as StoredPickList,
      }));
  } catch {
    return [];
  }
}

/** Migrate all localStorage pick lists to Supabase */
export async function migrateLocalPickLists(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("picklistftc_picklist_")) continue;

    const eventCode = key.replace("picklistftc_picklist_", "");
    const stored = loadLocalPickList(eventCode);
    if (!stored || stored.entries.length === 0) continue;

    try {
      await saveCloudPickList(userId, eventCode, stored);
    } catch {
      // Continue with other events
    }
  }
}
