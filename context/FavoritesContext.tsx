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
  setFavoriteEventRemote,
  setFavoriteTeamRemote,
  migrateLocalFavorites,
} from "@/lib/favorites";
import { useToast } from "@/context/ToastContext";
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
  const { toast } = useToast();
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEvent[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>([]);
  const loadedRef = useRef(false);
  const migrationDoneRef = useRef(false);
  // Trailing-sync state: latest desired favorited value per key, and which keys
  // currently have a cloud request in flight. Lets us serialize rapid on/off
  // toggles so the final cloud state always matches the final UI state.
  const eventSyncTargets = useRef(new Map<string, boolean>());
  const eventSyncing = useRef(new Set<string>());
  const teamSyncTargets = useRef(new Map<number, boolean>());
  const teamSyncing = useRef(new Set<number>());

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

  // Drain the latest desired state for an event to the cloud, one request at a
  // time per event. On failure, reconcile UI back to cloud truth and toast.
  const syncEvent = useCallback(
    (event: FavoriteEvent, desired: boolean) => {
      const code = event.event_code;
      eventSyncTargets.current.set(code, desired);
      if (eventSyncing.current.has(code)) return; // a runner will pick up the latest target
      eventSyncing.current.add(code);
      (async () => {
        try {
          while (eventSyncTargets.current.has(code)) {
            const target = eventSyncTargets.current.get(code)!;
            eventSyncTargets.current.delete(code);
            await setFavoriteEventRemote(userId, event, target);
          }
        } catch {
          eventSyncTargets.current.delete(code);
          toast("Couldn't save favorite — try again", "error");
          // Pull authoritative cloud state so the star reflects what was saved.
          refreshFavorites();
        } finally {
          eventSyncing.current.delete(code);
        }
      })();
    },
    [userId, toast, refreshFavorites]
  );

  const toggleEventFav = useCallback(
    async (event: FavoriteEvent) => {
      const code = event.event_code;
      const willFavorite = !favoriteEvents.some((e) => e.event_code === code);
      // Optimistic: flip the star immediately.
      setFavoriteEvents((prev) =>
        willFavorite
          ? prev.some((e) => e.event_code === code)
            ? prev
            : [...prev, event]
          : prev.filter((e) => e.event_code !== code)
      );
      syncEvent(event, willFavorite);
    },
    [favoriteEvents, syncEvent]
  );

  const syncTeam = useCallback(
    (team: FavoriteTeam, desired: boolean) => {
      const num = team.team_number;
      teamSyncTargets.current.set(num, desired);
      if (teamSyncing.current.has(num)) return;
      teamSyncing.current.add(num);
      (async () => {
        try {
          while (teamSyncTargets.current.has(num)) {
            const target = teamSyncTargets.current.get(num)!;
            teamSyncTargets.current.delete(num);
            await setFavoriteTeamRemote(userId, team, target);
          }
        } catch {
          teamSyncTargets.current.delete(num);
          toast("Couldn't save favorite — try again", "error");
          refreshFavorites();
        } finally {
          teamSyncing.current.delete(num);
        }
      })();
    },
    [userId, toast, refreshFavorites]
  );

  const toggleTeamFav = useCallback(
    async (team: FavoriteTeam) => {
      const num = team.team_number;
      const willFavorite = !favoriteTeams.some((t) => t.team_number === num);
      setFavoriteTeams((prev) =>
        willFavorite
          ? prev.some((t) => t.team_number === num)
            ? prev
            : [...prev, team]
          : prev.filter((t) => t.team_number !== num)
      );
      syncTeam(team, willFavorite);
    },
    [favoriteTeams, syncTeam]
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
