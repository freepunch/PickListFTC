"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Event, ProcessedTeam, TeamEventStats2025 } from "@/lib/types";
import { getEventData } from "@/lib/api";

interface EventState {
  event: Event | null;
  teams: ProcessedTeam[];
  loading: boolean;
  error: string | null;
  selectedTeams: number[];
  eventCode: string;
  lastUpdated: number | null;
  highContrast: boolean;
}

interface EventContextValue extends EventState {
  loadEvent: (code: string, season?: number) => Promise<void>;
  refreshEvent: () => Promise<void>;
  toggleTeamSelection: (teamNumber: number) => void;
  clearSelection: () => void;
  setEventCode: (code: string) => void;
  setHighContrast: (on: boolean) => void;
}

const EventContext = createContext<EventContextValue | null>(null);

function processTeams(event: Event): ProcessedTeam[] {
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
  });

  const loadEvent = useCallback(async (code: string, season: number = 2025) => {
    setState((prev) => ({ ...prev, loading: true, error: null, eventCode: code }));
    try {
      const event = await getEventData(code, season);
      const teams = processTeams(event);
      setState((prev) => ({
        ...prev,
        event,
        teams,
        loading: false,
        selectedTeams: [],
        lastUpdated: Date.now(),
      }));
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
      const teams = processTeams(event);
      setState((prev) => ({
        ...prev,
        event,
        teams,
        loading: false,
        lastUpdated: Date.now(),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to refresh event",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.eventCode]);

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
