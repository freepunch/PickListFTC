"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useAuth, useMigrationAccepted } from "@/context/AuthContext";
import {
  FavoriteEvent,
  FavoriteTeam,
  loadFavoriteEvents,
  loadFavoriteTeams,
  toggleFavoriteEvent,
  toggleFavoriteTeam,
  migrateLocalFavorites,
} from "@/lib/favorites";
import { migrateLocalNotes } from "@/lib/notes";
import { migrateLocalPickLists } from "@/lib/picklist-sync";
import { favEventsKey, favTeamsKey, migrateUnscopedKeys } from "@/lib/storage";

interface FavoritesContextValue {
  favoriteEvents: FavoriteEvent[];
  favoriteTeams: FavoriteTeam[];
  isEventFavorited: (eventCode: string) => boolean;
  isTeamFavorited: (teamNumber: number) => boolean;
  toggleEventFav: (event: FavoriteEvent) => Promise<void>;
  toggleTeamFav: (team: FavoriteTeam) => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const migrationAccepted = useMigrationAccepted();
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEvent[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>([]);
  const loadedRef = useRef(false);
  const migrationDoneRef = useRef(false);
  const togglingEventsRef = useRef(new Set<string>());
  const togglingTeamsRef = useRef(new Set<number>());

  const userId = user?.id ?? null;

  const refreshFavorites = useCallback(async () => {
    const [events, teams] = await Promise.all([
      loadFavoriteEvents(userId),
      loadFavoriteTeams(userId),
    ]);
    setFavoriteEvents(events);
    setFavoriteTeams(teams);
  }, [userId]);

  // Migrate unscoped keys on user change, then reload.
  // Guard on authLoading: if we fire with userId=null while auth is still
  // resolving, we read from plftc:anon: localStorage (empty on new devices)
  // and show nothing until auth settles. Waiting for auth to resolve means we
  // fire exactly once, with the correct userId.
  useEffect(() => {
    if (authLoading) return;
    loadedRef.current = false;
    setFavoriteEvents([]);
    setFavoriteTeams([]);
    // Migrate any old unscoped keys to user-scoped keys before loading
    migrateUnscopedKeys(userId);
    refreshFavorites().then(() => { loadedRef.current = true; });
  }, [refreshFavorites, userId, authLoading]);

  // Sync state → localStorage on every change (scoped by userId)
  useEffect(() => {
    if (typeof window === "undefined" || !loadedRef.current) return;
    try {
      localStorage.setItem(favEventsKey(userId), JSON.stringify(favoriteEvents));
    } catch { /* quota exceeded or private mode */ }
  }, [favoriteEvents, userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !loadedRef.current) return;
    try {
      localStorage.setItem(favTeamsKey(userId), JSON.stringify(favoriteTeams));
    } catch { /* quota exceeded or private mode */ }
  }, [favoriteTeams, userId]);

  // Run full migration when user accepts the prompt
  useEffect(() => {
    if (!migrationAccepted || !userId || migrationDoneRef.current) return;
    migrationDoneRef.current = true;

    (async () => {
      await Promise.all([
        migrateLocalFavorites(userId),
        migrateLocalNotes(userId),
        migrateLocalPickLists(userId),
      ]);
      // Refresh favorites after migration
      refreshFavorites();
    })();
  }, [migrationAccepted, userId, refreshFavorites]);

  const isEventFavorited = useCallback(
    (eventCode: string) => favoriteEvents.some((e) => e.event_code === eventCode),
    [favoriteEvents]
  );

  const isTeamFavorited = useCallback(
    (teamNumber: number) => favoriteTeams.some((t) => t.team_number === teamNumber),
    [favoriteTeams]
  );

  const toggleEventFav = useCallback(
    async (event: FavoriteEvent) => {
      if (togglingEventsRef.current.has(event.event_code)) return;
      togglingEventsRef.current.add(event.event_code);
      try {
        const { favorited } = await toggleFavoriteEvent(userId, event);
        if (favorited) {
          setFavoriteEvents((prev) =>
            prev.some((e) => e.event_code === event.event_code)
              ? prev
              : [...prev, event]
          );
        } else {
          setFavoriteEvents((prev) =>
            prev.filter((e) => e.event_code !== event.event_code)
          );
        }
      } finally {
        togglingEventsRef.current.delete(event.event_code);
      }
    },
    [userId]
  );

  const toggleTeamFav = useCallback(
    async (team: FavoriteTeam) => {
      if (togglingTeamsRef.current.has(team.team_number)) return;
      togglingTeamsRef.current.add(team.team_number);
      try {
        const { favorited } = await toggleFavoriteTeam(userId, team);
        if (favorited) {
          setFavoriteTeams((prev) =>
            prev.some((t) => t.team_number === team.team_number)
              ? prev
              : [...prev, team]
          );
        } else {
          setFavoriteTeams((prev) =>
            prev.filter((t) => t.team_number !== team.team_number)
          );
        }
      } finally {
        togglingTeamsRef.current.delete(team.team_number);
      }
    },
    [userId]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favoriteEvents,
        favoriteTeams,
        isEventFavorited,
        isTeamFavorited,
        toggleEventFav,
        toggleTeamFav,
        refreshFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
