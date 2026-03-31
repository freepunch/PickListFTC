import { supabase } from "@/lib/supabase";
import { favEventsKey, favTeamsKey } from "@/lib/storage";

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

// ── localStorage helpers (all keys scoped by userId) ──

function getLocalFavEvents(userId?: string | null): FavoriteEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: FavoriteEvent[] = JSON.parse(localStorage.getItem(favEventsKey(userId)) || "[]");
    // Filter out corrupt entries (e.g. from earlier bug where event_code was undefined)
    return parsed.filter((e) => typeof e.event_code === "string" && e.event_code);
  } catch {
    return [];
  }
}

function setLocalFavEvents(favs: FavoriteEvent[], userId?: string | null) {
  try {
    localStorage.setItem(favEventsKey(userId), JSON.stringify(favs));
  } catch { /* quota exceeded or private mode */ }
}

function getLocalFavTeams(userId?: string | null): FavoriteTeam[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(favTeamsKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function setLocalFavTeams(favs: FavoriteTeam[], userId?: string | null) {
  try {
    localStorage.setItem(favTeamsKey(userId), JSON.stringify(favs));
  } catch { /* quota exceeded or private mode */ }
}

// ── Favorite Events API ──

export async function loadFavoriteEvents(userId: string | null): Promise<FavoriteEvent[]> {
  if (!userId) return getLocalFavEvents(null);

  try {
    // Verify session is active before querying (RLS requires auth)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return getLocalFavEvents(userId);

    const { data, error } = await supabase
      .from("favorite_events")
      .select("event_code, event_name, season, start")
      .eq("user_id", session.user.id);

    if (error) throw error;
    const cloud = (data ?? []) as FavoriteEvent[];

    // When signed in, cloud is the source of truth — replace localStorage
    setLocalFavEvents(cloud, userId);
    return cloud;
  } catch {
    return getLocalFavEvents(userId);
  }
}

export async function toggleFavoriteEvent(
  userId: string | null,
  event: FavoriteEvent
): Promise<{ favorited: boolean }> {
  if (!userId) {
    // localStorage only
    const local = getLocalFavEvents(null);
    const exists = local.some((e) => e.event_code === event.event_code);
    if (exists) {
      setLocalFavEvents(local.filter((e) => e.event_code !== event.event_code), null);
      return { favorited: false };
    } else {
      setLocalFavEvents([...local, event], null);
      return { favorited: true };
    }
  }

  try {
    // Verify we have an active session (RLS requires auth)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // No session — fall back to localStorage-only with userId scope
      const local = getLocalFavEvents(userId);
      const exists = local.some((e) => e.event_code === event.event_code);
      if (exists) {
        setLocalFavEvents(local.filter((e) => e.event_code !== event.event_code), userId);
      } else {
        setLocalFavEvents([...local, event], userId);
      }
      return { favorited: !exists };
    }

    // Determine current state from localStorage (kept in sync with cloud)
    const local = getLocalFavEvents(userId);
    const existsLocally = local.some((e) => e.event_code === event.event_code);

    if (existsLocally) {
      // Was favorited, now unfavoriting — delete from Supabase
      const { data, error } = await supabase
        .from("favorite_events")
        .delete()
        .eq("user_id", session.user.id)
        .eq("event_code", event.event_code);
      if (error) console.error("[favorites] delete error:", error);
      // Update localStorage to match cloud state
      setLocalFavEvents(local.filter((e) => e.event_code !== event.event_code), userId);
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
      // Update localStorage to match cloud state
      setLocalFavEvents([...local, event], userId);
      return { favorited: true };
    }
  } catch (err) {
    console.warn("[favorites] toggle failed:", err);
    return { favorited: false };
  }
}

// ── Favorite Teams API ──

export async function loadFavoriteTeams(userId: string | null): Promise<FavoriteTeam[]> {
  if (!userId) return getLocalFavTeams(null);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return getLocalFavTeams(userId);

    const { data, error } = await supabase
      .from("favorite_teams")
      .select("team_number, team_name, notes")
      .eq("user_id", session.user.id);

    if (error) throw error;
    const cloud = (data ?? []) as FavoriteTeam[];

    // When signed in, cloud is the source of truth — replace localStorage
    setLocalFavTeams(cloud, userId);
    return cloud;
  } catch {
    return getLocalFavTeams(userId);
  }
}

export async function toggleFavoriteTeam(
  userId: string | null,
  team: FavoriteTeam
): Promise<{ favorited: boolean }> {
  if (!userId) {
    const local = getLocalFavTeams(null);
    const exists = local.some((t) => t.team_number === team.team_number);
    if (exists) {
      setLocalFavTeams(local.filter((t) => t.team_number !== team.team_number), null);
      return { favorited: false };
    } else {
      setLocalFavTeams([...local, team], null);
      return { favorited: true };
    }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // No session — fall back to localStorage-only with userId scope
      const local = getLocalFavTeams(userId);
      const exists = local.some((t) => t.team_number === team.team_number);
      if (exists) {
        setLocalFavTeams(local.filter((t) => t.team_number !== team.team_number), userId);
      } else {
        setLocalFavTeams([...local, team], userId);
      }
      return { favorited: !exists };
    }

    // Determine current state from localStorage (kept in sync with cloud)
    const local = getLocalFavTeams(userId);
    const existsLocally = local.some((t) => t.team_number === team.team_number);

    if (existsLocally) {
      const { data, error } = await supabase
        .from("favorite_teams")
        .delete()
        .eq("user_id", session.user.id)
        .eq("team_number", team.team_number);
      if (error) console.error("[favorites] delete team error:", error);
      // Update localStorage to match cloud state
      setLocalFavTeams(local.filter((t) => t.team_number !== team.team_number), userId);
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
      // Update localStorage to match cloud state
      setLocalFavTeams([...local, team], userId);
      return { favorited: true };
    }
  } catch (err) {
    console.warn("[favorites] toggle team failed:", err);
    return { favorited: false };
  }
}

// ── Migration: push local favorites to Supabase ──

export async function migrateLocalFavorites(userId: string): Promise<void> {
  // Read from anon scope (data created before login) to migrate to cloud
  const localEvents = getLocalFavEvents(null);
  const localTeams = getLocalFavTeams(null);

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
