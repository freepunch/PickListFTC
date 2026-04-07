"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Event, ProcessedTeam, TeamEventStats2025, PrescoutTeamData, PrescoutRankedTeam } from "@/lib/types";
import { getEventData, getPrescoutData } from "@/lib/api";
import { getPrescoutRanking } from "@/lib/calculations";

interface EventState {
  event: Event | null;
  teams: ProcessedTeam[];
  loading: boolean;
  error: string | null;
  selectedTeams: number[];
  eventCode: string;
  lastUpdated: number | null;
  highContrast: boolean;
  isPrescout: boolean;
  prescoutData: PrescoutTeamData[];
  prescoutRanking: PrescoutRankedTeam[];
  prescoutLoading: boolean;
  showLiveToast: boolean;
}

interface EventContextValue extends EventState {
  loadEvent: (code: string) => Promise<void>;
  refreshEvent: () => Promise<void>;
  toggleTeamSelection: (teamNumber: number) => void;
  clearSelection: () => void;
  setEventCode: (code: string) => void;
  setHighContrast: (on: boolean) => void;
  dismissLiveToast: () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

// ── In-memory cache (survives re-renders, cleared on page unload) ─────────────
interface CacheEntry { event: Event; timestamp: number }
const eventCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(code: string): Event | null {
  const entry = eventCache.get(code.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) { eventCache.delete(code.toUpperCase()); return null; }
  return entry.event;
}

function setCached(code: string, event: Event) {
  eventCache.set(code.toUpperCase(), { event, timestamp: Date.now() });
}

function isEventPrescout(event: Event): boolean {
  if (!event.matches || event.matches.length === 0) return true;
  return event.matches.every((m) => !m.hasBeenPlayed);
}

const EMPTY_STATS: TeamEventStats2025 = {
  rank: 0, rp: 0, tb1: 0, tb2: 0,
  wins: 0, losses: 0, ties: 0, dqs: 0, qualMatchesPlayed: 0,
  opr: { totalPointsNp: 0, autoPoints: 0, dcPoints: 0, autoArtifactPoints: 0, autoPatternPoints: 0, dcArtifactPoints: 0, dcBasePoints: 0, dcPatternPoints: 0 },
  avg: { totalPointsNp: 0, autoPoints: 0, dcPoints: 0, autoArtifactPoints: 0, autoPatternPoints: 0, dcArtifactPoints: 0, dcBasePoints: 0, dcPatternPoints: 0 },
  max: { totalPointsNp: 0, autoPoints: 0, dcPoints: 0 },
  dev: { totalPointsNp: 0, autoPoints: 0, dcPoints: 0 },
};

function processTeams(event: Event, prescout: boolean): ProcessedTeam[] {
  if (prescout) {
    // In prescout mode, no team has event stats yet — return stub entries so selectors work
    return event.teams.map((tep, i) => ({
      teamNumber: tep.teamNumber,
      teamName: tep.team.name,
      schoolName: tep.team.schoolName,
      stats: { ...EMPTY_STATS, rank: i + 1 },
    }));
  }
  return event.teams
    .filter((tep) => tep.stats !== null)
    .map((tep) => ({
      teamNumber: tep.teamNumber,
      teamName: tep.team.name,
      schoolName: tep.team.schoolName,
      stats: tep.stats as TeamEventStats2025,
    }))
    .sort((a, b) => a.stats.rank - b.stats.rank);
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EventState>({
    event: null,
    teams: [],
    loading: false,
    error: null,
    selectedTeams: [],
    eventCode: "",
    lastUpdated: null,
    highContrast: false,
    isPrescout: false,
    prescoutData: [],
    prescoutRanking: [],
    prescoutLoading: false,
    showLiveToast: false,
  });

  const loadEvent = useCallback(async (code: string) => {
    const upper = code.toUpperCase();
    const cached = getCached(upper);
    // Serve from cache instantly, then still refresh in background if >2min old
    if (cached) {
      const prescout = isEventPrescout(cached);
      const teams = processTeams(cached, prescout);
      setState((prev) => ({
        ...prev, event: cached, teams, loading: false, error: null,
        eventCode: upper, selectedTeams: [], lastUpdated: eventCache.get(upper)!.timestamp,
        isPrescout: prescout, showLiveToast: false,
        ...(prescout ? {} : { prescoutData: [], prescoutRanking: [], prescoutLoading: false }),
      }));
      const age = Date.now() - eventCache.get(upper)!.timestamp;
      if (age < 2 * 60 * 1000) return; // fresh enough — skip background refresh
    }

    setState((prev) => ({ ...prev, event: cached ?? null, teams: cached ? processTeams(cached, isEventPrescout(cached)) : [], loading: true, error: null, eventCode: upper, selectedTeams: [] }));
    try {
      const event = await getEventData(upper);
      setCached(upper, event);
      const prescout = isEventPrescout(event);
      const teams = processTeams(event, prescout);

      setState((prev) => ({
        ...prev,
        event,
        teams,
        loading: false,
        selectedTeams: [],
        lastUpdated: Date.now(),
        isPrescout: prescout,
        prescoutData: [],
        prescoutRanking: [],
        prescoutLoading: prescout,
        showLiveToast: false,
      }));

      if (prescout) {
        const teamNumbers = event.teams.map((t) => t.teamNumber);
        const prescoutData = await getPrescoutData(teamNumbers);
        const prescoutRanking = getPrescoutRanking(prescoutData);
        setState((prev) => ({
          ...prev,
          prescoutData,
          prescoutRanking,
          prescoutLoading: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load event",
      }));
    }
  }, []);

  const refreshEvent = useCallback(async () => {
    const code = state.eventCode;
    if (!code) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const event = await getEventData(code);
      setCached(code, event);
      const prescout = isEventPrescout(event);
      const teams = processTeams(event, prescout);
      const wasPrescout = state.isPrescout;

      setState((prev) => ({
        ...prev,
        event,
        teams,
        loading: false,
        lastUpdated: Date.now(),
        isPrescout: prescout,
        showLiveToast: wasPrescout && !prescout,
        ...(!prescout ? { prescoutData: [], prescoutRanking: [], prescoutLoading: false } : {}),
        ...(prescout ? { prescoutLoading: true } : {}),
      }));

      if (prescout) {
        const teamNumbers = event.teams.map((t) => t.teamNumber);
        const prescoutData = await getPrescoutData(teamNumbers);
        const prescoutRanking = getPrescoutRanking(prescoutData);
        setState((prev) => ({
          ...prev,
          prescoutData,
          prescoutRanking,
          prescoutLoading: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to refresh event",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.eventCode, state.isPrescout]);

  const toggleTeamSelection = useCallback((teamNumber: number) => {
    setState((prev) => {
      const selected = prev.selectedTeams.includes(teamNumber)
        ? prev.selectedTeams.filter((n) => n !== teamNumber)
        : [...prev.selectedTeams, teamNumber];
      return { ...prev, selectedTeams: selected };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({ ...prev, selectedTeams: [] }));
  }, []);

  const setEventCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, eventCode: code }));
  }, []);

  const setHighContrast = useCallback((on: boolean) => {
    setState((prev) => ({ ...prev, highContrast: on }));
  }, []);

  const dismissLiveToast = useCallback(() => {
    setState((prev) => ({ ...prev, showLiveToast: false }));
  }, []);

  return (
    <EventContext.Provider
      value={{
        ...state,
        loadEvent,
        refreshEvent,
        toggleTeamSelection,
        clearSelection,
        setEventCode,
        setHighContrast,
        dismissLiveToast,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return ctx;
}
