"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { picklistKey } from "@/lib/storage";

const NOTIF_PREF_KEYS = {
  myMatches: "plftc:notif:myMatches",
  pickListMatches: "plftc:notif:pickListMatches",
  upsetAlerts: "plftc:notif:upsetAlerts",
};

function getPref(key: string, defaultVal: boolean): boolean {
  if (typeof window === "undefined") return defaultVal;
  const v = localStorage.getItem(key);
  return v === null ? defaultVal : v === "true";
}

function getPickListTeams(eventCode: string, userId: string | null | undefined): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(picklistKey(eventCode, userId));
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    const entries: { teamNumber: number }[] = data?.entries ?? [];
    return new Set(entries.map((e) => e.teamNumber));
  } catch {
    return new Set();
  }
}

function fire(body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification("PickListFTC", { body, icon: "/favicon.ico", tag });
}

export function useMatchNotifications() {
  const { event, lastUpdated } = useEvent();
  const { profile, user } = useAuth();
  const prevPlayedIds = useRef<Set<number>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Reset on event change
  useEffect(() => {
    prevPlayedIds.current = new Set();
  }, [event?.code]);

  // Check for notification triggers after each refresh
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

    const myTeam = profile?.team_number ?? null;
    const pickListTeams = getPickListTeams(event.code, user?.id);
    const canNotify = typeof Notification !== "undefined" && Notification.permission === "granted";
    if (!canNotify) {
      prevPlayedIds.current = currentIds;
      return;
    }

    for (const match of event.matches) {
      if (!match.hasBeenPlayed || prev.has(match.id)) continue;
      const matchTeams = match.teams.map((t) => t.teamNumber);

      // My team match result
      if (myTeam && matchTeams.includes(myTeam) && getPref(NOTIF_PREF_KEYS.myMatches, true)) {
        const myAlliance = match.teams.find((t) => t.teamNumber === myTeam)?.alliance;
        const myScore = myAlliance === "Red" ? match.scores?.red.totalPointsNp : match.scores?.blue.totalPointsNp;
        const oppScore = myAlliance === "Red" ? match.scores?.blue.totalPointsNp : match.scores?.red.totalPointsNp;
        const result =
          myScore !== undefined && oppScore !== undefined && myScore !== null && oppScore !== null
            ? myScore > oppScore ? "Won" : myScore < oppScore ? "Lost" : "Tied"
            : "Played";
        fire(
          `Team ${myTeam} ${result} ${match.description ?? `Match ${match.matchNum}`} · ${myScore ?? "?"} – ${oppScore ?? "?"}`,
          `match-myteam-${match.id}`
        );
        continue;
      }

      // Pick list team result
      if (
        getPref(NOTIF_PREF_KEYS.pickListMatches, true) &&
        matchTeams.some((n) => pickListTeams.has(n))
      ) {
        const watchedTeams = matchTeams.filter((n) => pickListTeams.has(n));
        const desc = match.description ?? `Match ${match.matchNum}`;
        const scoreStr =
          match.scores ? `${match.scores.red.totalPointsNp} – ${match.scores.blue.totalPointsNp}` : "";
        fire(
          `Pick list team${watchedTeams.length > 1 ? "s" : ""} ${watchedTeams.join(", ")} played ${desc}${scoreStr ? ` · ${scoreStr}` : ""}`,
          `match-picklist-${match.id}`
        );
        continue;
      }

      // Upset alert: lower-predicted side wins by >15 pts
      if (getPref(NOTIF_PREF_KEYS.upsetAlerts, false) && match.scores) {
        const rScore = match.scores.red.totalPointsNp;
        const bScore = match.scores.blue.totalPointsNp;
        const margin = Math.abs(rScore - bScore);
        if (margin > 15) {
          fire(
            `Upset in ${match.description ?? `Match ${match.matchNum}`} · ${rScore} – ${bScore}`,
            `match-upset-${match.id}`
          );
        }
      }
    }

    prevPlayedIds.current = currentIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}

export { NOTIF_PREF_KEYS, getPref };
