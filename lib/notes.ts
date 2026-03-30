import { supabase } from "@/lib/supabase";

export interface ScoutNote {
  id: string;
  teamNumber: number;
  text: string;
  tags: string[];
  timestamp: string; // ISO string
  shared?: boolean; // opt-in team sharing
  authorName?: string; // display name of author (for shared notes)
  authorId?: string; // user id of author (for shared notes)
}

export type TagCategory = "positive" | "negative" | "neutral";

export interface TagDef {
  label: string;
  category: TagCategory;
}

export const PREDEFINED_TAGS: TagDef[] = [
  { label: "Fast Cycle",      category: "positive" },
  { label: "Consistent",      category: "positive" },
  { label: "Good Driver",     category: "positive" },
  { label: "Strong Auto",     category: "positive" },
  { label: "Strong Endgame",  category: "positive" },
  { label: "Good Defense",    category: "positive" },
  { label: "Slow Cycle",      category: "negative" },
  { label: "Inconsistent",    category: "negative" },
  { label: "Penalty Prone",   category: "negative" },
  { label: "Weak Auto",       category: "negative" },
  { label: "Drops Samples",   category: "negative" },
  { label: "Breaks Down",     category: "negative" },
  { label: "Watch Closely",   category: "neutral"  },
];

const TAG_COLOR_MAP: Record<TagCategory, string> = {
  positive: "bg-green-500/15 text-green-400 border border-green-500/20",
  negative: "bg-red-500/15 text-red-400 border border-red-500/20",
  neutral:  "bg-blue-500/15 text-blue-400 border border-blue-500/20",
};

export function getTagCategory(label: string): TagCategory {
  return PREDEFINED_TAGS.find((t) => t.label === label)?.category ?? "neutral";
}

export function tagColorClass(label: string): string {
  return TAG_COLOR_MAP[getTagCategory(label)];
}

// ── localStorage Storage ──

function storageKey(eventCode: string): string {
  return `picklistftc_notes_${eventCode}`;
}

export function loadNotes(eventCode: string): ScoutNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(eventCode));
    return raw ? (JSON.parse(raw) as ScoutNote[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(eventCode: string, notes: ScoutNote[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(eventCode), JSON.stringify(notes));
}

// ── Supabase Cloud Sync ──

export async function loadCloudNotes(
  userId: string,
  eventCode: string
): Promise<ScoutNote[]> {
  try {
    const { data, error } = await supabase
      .from("scout_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("event_code", eventCode);

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      teamNumber: row.team_number,
      text: row.text,
      tags: row.tags ?? [],
      timestamp: row.created_at,
      shared: row.shared ?? false,
    }));
  } catch {
    return [];
  }
}

export async function saveCloudNote(
  userId: string,
  eventCode: string,
  note: ScoutNote
): Promise<void> {
  try {
    await supabase.from("scout_notes").upsert(
      {
        id: note.id,
        user_id: userId,
        event_code: eventCode,
        team_number: note.teamNumber,
        text: note.text,
        tags: note.tags,
        created_at: note.timestamp,
        shared: note.shared ?? false,
      },
      { onConflict: "id" }
    );
  } catch {
    // Silently fail — localStorage is the fallback
  }
}

export async function deleteCloudNote(
  userId: string,
  noteId: string
): Promise<void> {
  try {
    await supabase
      .from("scout_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", userId);
  } catch {
    // Silently fail
  }
}

export async function updateCloudNoteShared(
  userId: string,
  noteId: string,
  shared: boolean
): Promise<void> {
  try {
    await supabase
      .from("scout_notes")
      .update({ shared })
      .eq("id", noteId)
      .eq("user_id", userId);
  } catch {
    // Silently fail
  }
}

/** Merge local + cloud notes. Most recent timestamp wins for conflicts (same id). */
export function mergeNotes(local: ScoutNote[], cloud: ScoutNote[]): ScoutNote[] {
  const map = new Map<string, ScoutNote>();

  for (const n of local) {
    map.set(n.id, n);
  }

  for (const n of cloud) {
    const existing = map.get(n.id);
    if (!existing || new Date(n.timestamp) > new Date(existing.timestamp)) {
      map.set(n.id, n);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/** Push all local notes for an event to Supabase (migration). */
export async function migrateLocalNotes(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("picklistftc_notes_")) continue;

    const eventCode = key.replace("picklistftc_notes_", "");
    const notes = loadNotes(eventCode);
    if (notes.length === 0) continue;

    const rows = notes.map((n) => ({
      id: n.id,
      user_id: userId,
      event_code: eventCode,
      team_number: n.teamNumber,
      text: n.text,
      tags: n.tags,
      created_at: n.timestamp,
      shared: false,
    }));

    try {
      await supabase.from("scout_notes").upsert(rows, { onConflict: "id" });
    } catch {
      // Continue with other events
    }
  }
}

// ── Shared Team Notes ──

export async function loadTeamSharedNotes(
  teamNumber: number,
  eventCode: string,
  myUserId: string
): Promise<ScoutNote[]> {
  try {
    // Get all users with the same team_number
    const { data: teammates, error: teamError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("team_number", teamNumber);

    if (teamError || !teammates || teammates.length === 0) return [];

    const teammateIds = teammates
      .filter((t) => t.id !== myUserId)
      .map((t) => t.id);

    if (teammateIds.length === 0) return [];

    const { data, error } = await supabase
      .from("scout_notes")
      .select("*")
      .eq("event_code", eventCode)
      .eq("shared", true)
      .in("user_id", teammateIds);

    if (error) throw error;

    const nameMap = new Map(teammates.map((t) => [t.id, t.display_name]));

    return (data ?? []).map((row) => ({
      id: row.id,
      teamNumber: row.team_number,
      text: row.text,
      tags: row.tags ?? [],
      timestamp: row.created_at,
      shared: true,
      authorName: nameMap.get(row.user_id) ?? "Teammate",
      authorId: row.user_id,
    }));
  } catch {
    return [];
  }
}
