import { supabase } from "@/lib/supabase";

// ── Types ──

export interface FavoriteEvent {
  event_code: string;
  event_name: string | null;
  season: number;
  start?: string | null; // ISO date string for event start
}

export interface FavoriteTeam {
  team_number: number;
  team_name: string | null;
  notes: string | null;
}

// ── localStorage keys ──

const LOCAL_FAV_EVENTS = "picklistftc_fav_events";
const LOCAL_FAV_TEAMS = "picklistftc_fav_teams";

// ── localStorage helpers ──

function getLocalFavEvents(): FavoriteEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FAV_EVENTS) || "[]");
  } catch {
    return [];
  }
}

function setLocalFavEvents(favs: FavoriteEvent[]) {
  localStorage.setItem(LOCAL_FAV_EVENTS, JSON.stringify(favs));
}

function getLocalFavTeams(): FavoriteTeam[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FAV_TEAMS) || "[]");
  } catch {
    return [];
  }
}

function setLocalFavTeams(favs: FavoriteTeam[]) {
  localStorage.setItem(LOCAL_FAV_TEAMS, JSON.stringify(favs));
}

// ── Favorite Events API ──

export async function loadFavoriteEvents(userId: string | null): Promise<FavoriteEvent[]> {
  const local = getLocalFavEvents();
  if (!userId) return local;

  try {
    const { data, error } = await supabase
      .from("favorite_events")
      .select("event_code, event_name, season, start")
      .eq("user_id", userId);

    if (error) throw error;
    const cloud = (data ?? []) as FavoriteEvent[];

    // Merge: deduplicate by event_code, preferring cloud data
    const merged = new Map<string, FavoriteEvent>();
    for (const e of local) merged.set(e.event_code, e);
    for (const e of cloud) merged.set(e.event_code, e);
    const result = Array.from(merged.values());

    // Keep localStorage in sync
    setLocalFavEvents(result);
    return result;
  } catch {
    return local;
  }
}

export async function toggleFavoriteEvent(
  userId: string | null,
  event: FavoriteEvent
): Promise<{ favorited: boolean }> {
  if (!userId) {
    // localStorage only
    const local = getLocalFavEvents();
    const exists = local.some((e) => e.event_code === event.event_code);
    if (exists) {
      setLocalFavEvents(local.filter((e) => e.event_code !== event.event_code));
      return { favorited: false };
    } else {
      setLocalFavEvents([...local, event]);
      return { favorited: true };
    }
  }

  // Always update localStorage as the durable local cache
  const local = getLocalFavEvents();
  const existsLocally = local.some((e) => e.event_code === event.event_code);
  if (existsLocally) {
    setLocalFavEvents(local.filter((e) => e.event_code !== event.event_code));
  } else {
    setLocalFavEvents([...local, event]);
  }

  try {
    // Check if exists in Supabase
    const { data: existing } = await supabase
      .from("favorite_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_code", event.event_code)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("favorite_events")
        .delete()
        .eq("user_id", userId)
        .eq("event_code", event.event_code);
      return { favorited: false };
    } else {
      await supabase.from("favorite_events").insert({
        user_id: userId,
        event_code: event.event_code,
        event_name: event.event_name,
        season: event.season,
      });
      return { favorited: true };
    }
  } catch {
    // Supabase failed, but localStorage is already updated
    return { favorited: !existsLocally };
  }
}

// ── Favorite Teams API ──

export async function loadFavoriteTeams(userId: string | null): Promise<FavoriteTeam[]> {
  const local = getLocalFavTeams();
  if (!userId) return local;

  try {
    const { data, error } = await supabase
      .from("favorite_teams")
      .select("team_number, team_name, notes")
      .eq("user_id", userId);

    if (error) throw error;
    const cloud = (data ?? []) as FavoriteTeam[];

    // Merge: deduplicate by team_number, preferring cloud data
    const merged = new Map<number, FavoriteTeam>();
    for (const t of local) merged.set(t.team_number, t);
    for (const t of cloud) merged.set(t.team_number, t);
    const result = Array.from(merged.values());

    setLocalFavTeams(result);
    return result;
  } catch {
    return local;
  }
}

export async function toggleFavoriteTeam(
  userId: string | null,
  team: FavoriteTeam
): Promise<{ favorited: boolean }> {
  if (!userId) {
    const local = getLocalFavTeams();
    const exists = local.some((t) => t.team_number === team.team_number);
    if (exists) {
      setLocalFavTeams(local.filter((t) => t.team_number !== team.team_number));
      return { favorited: false };
    } else {
      setLocalFavTeams([...local, team]);
      return { favorited: true };
    }
  }

  // Always update localStorage as the durable local cache
  const local = getLocalFavTeams();
  const existsLocally = local.some((t) => t.team_number === team.team_number);
  if (existsLocally) {
    setLocalFavTeams(local.filter((t) => t.team_number !== team.team_number));
  } else {
    setLocalFavTeams([...local, team]);
  }

  try {
    const { data: existing } = await supabase
      .from("favorite_teams")
      .select("id")
      .eq("user_id", userId)
      .eq("team_number", team.team_number)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("favorite_teams")
        .delete()
        .eq("user_id", userId)
        .eq("team_number", team.team_number);
      return { favorited: false };
    } else {
      await supabase.from("favorite_teams").insert({
        user_id: userId,
        team_number: team.team_number,
        team_name: team.team_name,
        notes: team.notes,
      });
      return { favorited: true };
    }
  } catch {
    // Supabase failed, but localStorage is already updated
    return { favorited: !existsLocally };
  }
}

// ── Migration: push local favorites to Supabase ──

export async function migrateLocalFavorites(userId: string): Promise<void> {
  const localEvents = getLocalFavEvents();
  const localTeams = getLocalFavTeams();

  if (localEvents.length > 0) {
    const rows = localEvents.map((e) => ({
      user_id: userId,
      event_code: e.event_code,
      event_name: e.event_name,
      season: e.season,
    }));
    await supabase.from("favorite_events").upsert(rows, {
      onConflict: "user_id,event_code,season",
    });
  }

  if (localTeams.length > 0) {
    const rows = localTeams.map((t) => ({
      user_id: userId,
      team_number: t.team_number,
      team_name: t.team_name,
      notes: t.notes,
    }));
    await supabase.from("favorite_teams").upsert(rows, {
      onConflict: "user_id,team_number",
    });
  }
}
