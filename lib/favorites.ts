import { supabase } from "@/lib/supabase";

// ── Helpers ──

/** Ensure a profiles row exists for this user (FK target for favorites). */
async function ensureProfile(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" });
  if (error) console.error("[favorites] ensureProfile error:", error);
}

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

const LOCAL_FAV_EVENTS = "plftc:watchedEvents";
const LOCAL_FAV_TEAMS = "plftc:watchedTeams";

// ── localStorage helpers ──

export function getLocalFavEventsPublic(): FavoriteEvent[] {
  return getLocalFavEvents();
}

function getLocalFavEvents(): FavoriteEvent[] {
  if (typeof window === "undefined") return [];
  try {
    // Migrate from old key name if present
    const oldKey = "picklistftc_fav_events";
    const oldData = localStorage.getItem(oldKey);
    if (oldData && !localStorage.getItem(LOCAL_FAV_EVENTS)) {
      localStorage.setItem(LOCAL_FAV_EVENTS, oldData);
      localStorage.removeItem(oldKey);
    }
    const parsed: FavoriteEvent[] = JSON.parse(localStorage.getItem(LOCAL_FAV_EVENTS) || "[]");
    // Filter out corrupt entries (e.g. from earlier bug where event_code was undefined)
    return parsed.filter((e) => typeof e.event_code === "string" && e.event_code);
  } catch {
    return [];
  }
}

function setLocalFavEvents(favs: FavoriteEvent[]) {
  localStorage.setItem(LOCAL_FAV_EVENTS, JSON.stringify(favs));
}

export function getLocalFavTeamsPublic(): FavoriteTeam[] {
  return getLocalFavTeams();
}

function getLocalFavTeams(): FavoriteTeam[] {
  if (typeof window === "undefined") return [];
  try {
    // Migrate from old key name if present
    const oldKey = "picklistftc_fav_teams";
    const oldData = localStorage.getItem(oldKey);
    if (oldData && !localStorage.getItem(LOCAL_FAV_TEAMS)) {
      localStorage.setItem(LOCAL_FAV_TEAMS, oldData);
      localStorage.removeItem(oldKey);
    }
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
    // Verify session is active before querying (RLS requires auth)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return local;

    const { data, error } = await supabase
      .from("favorite_events")
      .select("event_code, event_name, season, start")
      .eq("user_id", session.user.id);

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
    // Verify we have an active session (RLS requires auth)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { favorited: !existsLocally };
    }

    if (existsLocally) {
      // Was favorited, now unfavoriting — delete from Supabase
      const { data, error } = await supabase
        .from("favorite_events")
        .delete()
        .eq("user_id", session.user.id)
        .eq("event_code", event.event_code);
      if (error) console.error("[favorites] delete error:", error);
      return { favorited: false };
    } else {
      // Ensure profile row exists (FK target) before inserting favorite
      await ensureProfile(session.user.id);

      // Not favorited, now adding — upsert to handle duplicates gracefully
      const { data, error } = await supabase.from("favorite_events").upsert(
        {
          user_id: session.user.id,
          event_code: event.event_code,
          event_name: event.event_name,
          season: event.season,
        },
        { onConflict: "user_id,event_code,season" }
      );
      if (error) console.error("[favorites] upsert error:", error);
      return { favorited: true };
    }
  } catch (err) {
    console.warn("[favorites] toggle failed:", err);
    // Supabase failed, but localStorage is already updated
    return { favorited: !existsLocally };
  }
}

// ── Favorite Teams API ──

export async function loadFavoriteTeams(userId: string | null): Promise<FavoriteTeam[]> {
  const local = getLocalFavTeams();
  if (!userId) return local;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return local;

    const { data, error } = await supabase
      .from("favorite_teams")
      .select("team_number, team_name, notes")
      .eq("user_id", session.user.id);

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { favorited: !existsLocally };
    }

    if (existsLocally) {
      const { data, error } = await supabase
        .from("favorite_teams")
        .delete()
        .eq("user_id", session.user.id)
        .eq("team_number", team.team_number);
      if (error) console.error("[favorites] delete team error:", error);
      else console.debug("[favorites] deleted team:", team.team_number, data);
      return { favorited: false };
    } else {
      // Ensure profile row exists (FK target) before inserting favorite
      await ensureProfile(session.user.id);

      const { data, error } = await supabase.from("favorite_teams").upsert(
        {
          user_id: session.user.id,
          team_number: team.team_number,
          team_name: team.team_name,
          notes: team.notes,
        },
        { onConflict: "user_id,team_number" }
      );
      if (error) console.error("[favorites] upsert team error:", error);
      else console.debug("[favorites] upserted team:", team.team_number, data);
      return { favorited: true };
    }
  } catch (err) {
    console.warn("[favorites] toggle team failed:", err);
    return { favorited: !existsLocally };
  }
}

// ── Migration: push local favorites to Supabase ──

export async function migrateLocalFavorites(userId: string): Promise<void> {
  const localEvents = getLocalFavEvents();
  const localTeams = getLocalFavTeams();

  // Ensure profile row exists before migrating (FK target)
  if (localEvents.length > 0 || localTeams.length > 0) {
    await ensureProfile(userId);
  }

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
