"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEvent } from "@/context/EventContext";

export interface AutoRefreshState {
  isLive: boolean;
  isComplete: boolean;
  newMatchCount: number;
  newMatchIds: Set<number>;
  lastUpdatedText: string;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

export function useAutoRefresh(): AutoRefreshState {
  const { event, refreshEvent, loading, isPrescout, lastUpdated } = useEvent();
  const [newMatchIds, setNewMatchIds] = useState<Set<number>>(new Set());
  const [newMatchCount, setNewMatchCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, tick] = useState(0);

  const prevPlayedIds = useRef<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = event?.matches ?? [];
  const somePlayed = matches.some((m) => m.hasBeenPlayed);
  const allPlayed = matches.length > 0 && matches.every((m) => m.hasBeenPlayed);
  const isLive = !isPrescout && somePlayed && !allPlayed;
  const isComplete = !isPrescout && allPlayed && matches.length > 0;

  // Tick every second so lastUpdatedText stays current
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Detect newly played matches whenever lastUpdated changes (i.e., after refresh)
  useEffect(() => {
    if (!event || !lastUpdated) return;
    const currentIds = new Set(
      event.matches.filter((m) => m.hasBeenPlayed).map((m) => m.id)
    );
    const prev = prevPlayedIds.current;
    if (prev.size === 0) {
      prevPlayedIds.current = currentIds;
      return;
    }
    const newIds = new Set<number>();
    for (const id of currentIds) {
      if (!prev.has(id)) newIds.add(id);
    }
    if (newIds.size > 0) {
      setNewMatchIds(newIds);
      setNewMatchCount(newIds.size);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setNewMatchIds(new Set()), 3000);
    }
    prevPlayedIds.current = currentIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  // Reset prev state when event code changes
  useEffect(() => {
    prevPlayedIds.current = new Set();
    setNewMatchIds(new Set());
    setNewMatchCount(0);
  }, [event?.code]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshEvent();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshEvent]);

  // 60s auto-poll while live; skips hidden tabs
  useEffect(() => {
    if (!isLive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      refresh();
    }, 60_000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLive, refresh]);

  // Refresh immediately when the tab becomes visible again. The 60s poll above
  // skips hidden tabs, so returning to a backgrounded tab could otherwise show
  // stale scores for up to a minute. Only while live (cheap single fetch).
  useEffect(() => {
    if (!isLive) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isLive, refresh]);

  const lastUpdatedText = (() => {
    if (!lastUpdated) return "";
    const s = Math.floor((Date.now() - lastUpdated) / 1000);
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  })();

  return {
    isLive,
    isComplete,
    newMatchCount,
    newMatchIds,
    lastUpdatedText,
    isRefreshing: isRefreshing || loading,
    refresh,
  };
}
