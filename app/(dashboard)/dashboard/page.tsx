"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { useEvent } from "@/context/EventContext";
import { EventLoader, focusEventInput } from "@/components/EventLoader";
import { PrescoutBanner } from "@/components/PrescoutBanner";
import { StatCard } from "@/components/StatCard";
import { ScoreDistribution } from "@/components/ScoreDistribution";
import { ScoringTrendHeatmap } from "@/components/ScoringTrendHeatmap";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PrescoutRankedTeam } from "@/lib/types";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { findScopedKeys } from "@/lib/storage";
import { AddToPickListButton } from "@/components/AddToPickListButton";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useMatchNotifications } from "@/hooks/useMatchNotifications";

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="skeleton h-3 w-20 mb-3" />
      <div className="skeleton h-7 w-16 mb-2" />
      <div className="skeleton h-3 w-24" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-3 w-14" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-4 w-6" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="skeleton h-4 w-32 mb-4" />
      <div className="skeleton h-64 w-full" />
    </div>
  );
}

const TREND_ICON: Record<string, { icon: string; color: string }> = {
  improving: { icon: "\u2191", color: "text-emerald-400" },
  declining: { icon: "\u2193", color: "text-red-400" },
  stable: { icon: "\u2192", color: "text-zinc-400" },
};

// ── Prescout Dashboard ──

function PrescoutDashboard() {
  const { event, prescoutRanking, prescoutLoading } = useEvent();

  const { avgOpr, strongestTeam, mostExperienced, teamsToWatch } = useMemo(() => {
    if (prescoutRanking.length === 0) {
      return { avgOpr: 0, strongestTeam: null as PrescoutRankedTeam | null, mostExperienced: null as PrescoutRankedTeam | null, teamsToWatch: [] as PrescoutRankedTeam[] };
    }

    const avgOpr = prescoutRanking.reduce((s, t) => s + t.bestOpr, 0) / prescoutRanking.length;
    const strongestTeam = prescoutRanking[0];
    const mostExperienced = [...prescoutRanking].sort((a, b) => b.eventCount - a.eventCount)[0];

    // Teams to watch: top 3 + improving teams with recent OPR above season avg
    const top3 = prescoutRanking.slice(0, 3);
    const risers = prescoutRanking.filter(
      (t) => t.trend === "improving" && !top3.some((x) => x.teamNumber === t.teamNumber)
    ).slice(0, 2);
    const teamsToWatch = [...top3, ...risers];

    return { avgOpr, strongestTeam, mostExperienced, teamsToWatch };
  }, [prescoutRanking]);

  if (prescoutLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonTable />
          <SkeletonTable />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Teams Registered"
          value={event?.teams.length ?? 0}
          mono={false}
        />
        <StatCard
          label="Avg Season Best OPR"
          value={avgOpr.toFixed(1)}
          subtitle="Across registered teams"
        />
        <StatCard
          label="Strongest Team"
          value={strongestTeam ? strongestTeam.bestOpr.toFixed(1) : "\u2014"}
          subtitle={
            strongestTeam
              ? `#${strongestTeam.teamNumber} ${strongestTeam.teamName}`
              : undefined
          }
        />
        <StatCard
          label="Most Experienced"
          value={mostExperienced ? `${mostExperienced.eventCount} events` : "\u2014"}
          subtitle={
            mostExperienced
              ? `#${mostExperienced.teamNumber} ${mostExperienced.teamName}`
              : undefined
          }
          mono={false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Prescout Rankings \u2014 seamless, no card chrome */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-medium text-[var(--text-primary)] tracking-tight">
              Rankings
            </h3>
            <Link
              href="/leaderboard"
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              View all \u2192
            </Link>
          </div>
          <div className="overflow-x-auto -mx-2 group/table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                  <th className="text-left px-3 py-2 w-12 font-medium">#</th>
                  <th className="text-left py-2 font-medium">Team</th>
                  <th className="text-right px-3 py-2 font-medium">Best OPR</th>
                  <th className="text-right px-3 py-2 font-medium">Avg</th>
                  <th className="text-left px-3 py-2 font-medium">Record</th>
                  <th className="text-center px-3 py-2 font-medium">Events</th>
                  <th className="text-center px-3 py-2 font-medium">Trend</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {prescoutRanking.slice(0, 10).map((team) => {
                  const trend = TREND_ICON[team.trend];
                  return (
                    <tr
                      key={team.teamNumber}
                      className="group/row border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <td className="px-3 py-3 text-[var(--text-muted)] font-mono text-xs">
                        {team.rank}
                      </td>
                      <td className="py-3">
                        <Link href={`/report/${team.teamNumber}`} className="hover:underline">
                          <span className="font-mono text-[var(--text-primary)] text-xs mr-2">
                            {team.teamNumber}
                          </span>
                          <span className="text-[var(--text-secondary)] hidden sm:inline">
                            {team.teamName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[var(--text-primary)] text-xs tabular-nums">
                        {team.bestOpr.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[var(--text-secondary)] text-xs tabular-nums">
                        {team.seasonAvg.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 font-mono text-[var(--text-secondary)] text-xs">
                        {team.record.wins}-{team.record.losses}-{team.record.ties}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[var(--text-secondary)] text-xs">
                        {team.eventCount}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm ${trend.color}`}>{trend.icon}</span>
                      </td>
                      <td className="px-2 py-3">
                        <span className="opacity-0 group-hover/row:opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity">
                          <AddToPickListButton
                            team={{ teamNumber: team.teamNumber, teamName: team.teamName, opr: team.bestOpr }}
                            size="xs"
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Teams to Watch \u2014 minimal list, no boxed cards */}
        <div>
          <h3 className="font-display text-lg font-medium text-[var(--text-primary)] tracking-tight mb-3">
            Watch
          </h3>
          <div className="space-y-1">
            {teamsToWatch.map((team) => {
              const trend = TREND_ICON[team.trend];
              const isTop3 = team.rank <= 3;
              return (
                <Link
                  key={team.teamNumber}
                  href={`/report/${team.teamNumber}`}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isTop3
                        ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                        : `bg-transparent ${trend.color}`
                    }`}
                  >
                    {isTop3 ? team.rank : trend.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] font-medium truncate">
                      <span className="font-mono mr-1.5 text-[var(--text-secondary)]">{team.teamNumber}</span>
                      {team.teamName}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {team.bestOpr.toFixed(1)} OPR \u00b7 {team.eventCount} events
                    </p>
                  </div>
                </Link>
              );
            })}
            {teamsToWatch.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                No prescout data yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live refresh bar ──

function LiveRefreshBar() {
  const { isLive, isComplete, newMatchCount, lastUpdatedText, isRefreshing, refresh } =
    useAutoRefresh();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (newMatchCount > 0) {
      setToast(`${newMatchCount} new score${newMatchCount !== 1 ? "s" : ""} available`);
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [newMatchCount]);

  if (!isLive && !isComplete) return null;

  return (
    <>
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-5 py-3 shadow-2xl text-sm text-[var(--foreground)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            {toast}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-[var(--bg-card)] border-b border-[var(--border)] text-xs text-[var(--foreground-dim)]">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span className="text-green-400 font-medium">Live</span>
            </span>
          )}
          {isComplete && (
            <span className="text-zinc-500">Event complete · auto-refresh off</span>
          )}
          {lastUpdatedText && (
            <>
              <span className="text-zinc-700">·</span>
              <span>Updated {lastUpdatedText}</span>
            </>
          )}
        </div>
        {isLive && (
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-40"
            title="Refresh now"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Refresh
          </button>
        )}
      </div>
    </>
  );
}

// ── Main Page ──

// My Events card removed — sidebar duplicates this surface.

// ── Season overview (shown when no event loaded but user has watched events) ──

function getEventStatus(start?: string | null): "live" | "upcoming" | "finished" {
  if (!start) return "upcoming";
  const startDate = new Date(start);
  const now = new Date();
  const endEstimate = new Date(startDate);
  endEstimate.setDate(endEstimate.getDate() + 2);
  if (now < startDate) return "upcoming";
  if (now > endEstimate) return "finished";
  return "live";
}

function getPickListStats(userId?: string | null): { totalLists: number; totalTeamsScouted: number; teamCounts: Map<number, number> } {
  if (typeof window === "undefined") return { totalLists: 0, totalTeamsScouted: 0, teamCounts: new Map() };

  let totalLists = 0;
  const teamCounts = new Map<number, number>();

  for (const { key } of findScopedKeys("picklist", userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stored = JSON.parse(raw);
      if (!stored.entries || stored.entries.length === 0) continue;
      totalLists++;
      for (const entry of stored.entries) {
        teamCounts.set(entry.teamNumber, (teamCounts.get(entry.teamNumber) ?? 0) + 1);
      }
    } catch {
      continue;
    }
  }

  // Also count teams with notes
  for (const { key } of findScopedKeys("notes", userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const notes = JSON.parse(raw);
      if (!Array.isArray(notes)) continue;
      for (const note of notes) {
        if (note.teamNumber) {
          teamCounts.set(note.teamNumber, (teamCounts.get(note.teamNumber) ?? 0) + 1);
        }
      }
    } catch {
      continue;
    }
  }

  return { totalLists, totalTeamsScouted: teamCounts.size, teamCounts };
}

const STATUS_COLORS: Record<string, string> = {
  live: "bg-green-400",
  upcoming: "bg-amber-400",
  finished: "bg-zinc-600",
};

const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  upcoming: "Upcoming",
  finished: "Finished",
};

function SeasonOverviewOrEmpty() {
  const { favoriteEvents } = useFavorites();
  const { loadEvent, setEventCode } = useEvent();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [stats, setStats] = useState({ totalLists: 0, totalTeamsScouted: 0, teamCounts: new Map<number, number>() });
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setStats(getPickListStats(userId));
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, [userId]);

  if (favoriteEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">
          No event loaded
        </h2>
        <p className="text-sm text-zinc-500 max-w-sm">
          Enter an FTC event code in the bar above to load team stats,
          match scores, and OPR breakdowns.
        </p>
        <p className="text-xs text-zinc-600 mt-3">
          Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">/</kbd> to focus search
          {" "}&middot;{" "}
          <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">
            {isMac ? "\u2318K" : "Ctrl+K"}
          </kbd> quick switch
        </p>
      </div>
    );
  }

  // Sort events: upcoming first, then live, then finished
  const sortedEvents = [...favoriteEvents].sort((a, b) => {
    const statusOrder = { live: 0, upcoming: 1, finished: 2 };
    const sa = getEventStatus(a.start);
    const sb = getEventStatus(b.start);
    if (statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb];
    const da = a.start ? new Date(a.start).getTime() : 0;
    const db = b.start ? new Date(b.start).getTime() : 0;
    return da - db;
  });

  // Find next upcoming event
  const nextEvent = sortedEvents.find((e) => getEventStatus(e.start) === "upcoming");

  // Top scouted teams
  const topTeams = Array.from(stats.teamCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const upcomingCount = favoriteEvents.filter((e) => getEventStatus(e.start) === "upcoming").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-1">Season Overview</h2>
        <p className="text-sm text-zinc-500">Your scouting season at a glance</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Events Watched" value={favoriteEvents.length} mono={false} />
        <StatCard label="Pick Lists" value={stats.totalLists} mono={false} />
        <StatCard label="Teams Scouted" value={stats.totalTeamsScouted} mono={false} />
        <StatCard label="Upcoming" value={upcomingCount} mono={false} subtitle={upcomingCount === 1 ? "event" : "events"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watched events */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">My Events</h3>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {sortedEvents.map((ev) => {
              const status = getEventStatus(ev.start);
              return (
                <button
                  key={ev.event_code}
                  onClick={() => {
                    setEventCode(ev.event_code);
                    loadEvent(ev.event_code);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {ev.event_name ?? ev.event_code}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--accent)] font-mono">{ev.event_code}</span>
                      {ev.start && (
                        <span className="text-xs text-zinc-500">
                          {new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    status === "live" ? "bg-green-500/10 text-green-400"
                      : status === "upcoming" ? "bg-amber-500/10 text-amber-400"
                        : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {STATUS_LABELS[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Next event countdown */}
          {nextEvent && nextEvent.start && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Next Event
              </h3>
              <p className="text-sm font-medium text-white truncate">
                {nextEvent.event_name ?? nextEvent.event_code}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {new Date(nextEvent.start).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {(() => {
                const days = Math.ceil(
                  (new Date(nextEvent.start).getTime() - Date.now()) / 86400000
                );
                return (
                  <p className="text-2xl font-bold text-[var(--accent)] mt-2">
                    {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "Today"}
                  </p>
                );
              })()}
              <button
                onClick={() => {
                  setEventCode(nextEvent.event_code);
                  loadEvent(nextEvent.event_code);
                }}
                className="mt-3 w-full py-2 text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)]
                  hover:bg-[var(--accent)]/25 rounded-lg transition-colors"
              >
                Load Event
              </button>
            </div>
          )}

          {/* Most scouted teams */}
          {topTeams.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Most Scouted Teams
              </h3>
              <div className="space-y-2">
                {topTeams.map(([teamNum, count]) => (
                  <Link
                    key={teamNum}
                    href={`/report/${teamNum}`}
                    className="flex items-center justify-between py-1 hover:bg-zinc-800/50 rounded px-1 -mx-1 transition-colors"
                  >
                    <span className="font-mono text-sm text-white">{teamNum}</span>
                    <span className="text-xs text-zinc-500">
                      {count} mention{count !== 1 ? "s" : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { event, teams, loading, isPrescout, dataSource, prescoutRanking, prescoutLoading } = useEvent();
  const useSeasonData = isPrescout || dataSource === 'season';
  const { profile } = useAuth();
  useMatchNotifications();

  // "/" keyboard shortcut to focus event search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        focusEventInput();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const playedMatches = useMemo(
    () => event?.matches.filter((m) => m.hasBeenPlayed && m.scores?.red && m.scores?.blue) ?? [],
    [event]
  );

  const { highestScore, avgScore } = useMemo(() => {
    if (playedMatches.length === 0) return { highestScore: 0, avgScore: 0 };
    let max = 0;
    let total = 0;
    for (const m of playedMatches) {
      const r = m.scores!.red.totalPointsNp;
      const b = m.scores!.blue.totalPointsNp;
      if (r > max) max = r;
      if (b > max) max = b;
      total += r + b;
    }
    return {
      highestScore: max,
      avgScore: total / (playedMatches.length * 2),
    };
  }, [playedMatches]);

  const topOprTeam = useMemo(() => {
    if (useSeasonData && prescoutRanking.length > 0) return prescoutRanking[0];
    if (teams.length === 0) return null;
    return teams.reduce((best, t) =>
      t.stats.opr.totalPointsNp > best.stats.opr.totalPointsNp ? t : best
    );
  }, [teams, useSeasonData, prescoutRanking]);

  const top10 = useMemo(() => {
    if (useSeasonData && prescoutRanking.length > 0) return prescoutRanking.slice(0, 10);
    return [...teams].sort((a, b) => a.stats.rank - b.stats.rank).slice(0, 10);
  }, [teams, useSeasonData, prescoutRanking]);

  return (
    <div className="min-h-screen flex flex-col">
      <EventLoader />
      <PrescoutBanner />
      <LiveRefreshBar />

      <div className="flex-1 p-4 sm:p-6 animate-page-fade-in max-w-[1200px] mx-auto w-full">
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonTable />
              <SkeletonChart />
            </div>
          </div>
        )}

        {!event && !loading && <SeasonOverviewOrEmpty />}

        {event && !loading && isPrescout && <PrescoutDashboard />}

        {event && !loading && !isPrescout && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                label="Total Teams"
                value={teams.length}
                mono={false}
              />
              <StatCard
                label="Matches Played"
                value={playedMatches.length}
              />
              <StatCard
                label="Highest Score"
                value={highestScore.toFixed(0)}
              />
              <StatCard
                label="Avg Score"
                value={avgScore.toFixed(1)}
                subtitle="Per alliance"
              />
              <StatCard
                label={useSeasonData ? "Top Season OPR" : "Top OPR"}
                value={
                  topOprTeam
                    ? ("bestOpr" in topOprTeam
                        ? (topOprTeam as import("@/lib/types").PrescoutRankedTeam).bestOpr.toFixed(1)
                        : (topOprTeam as import("@/lib/types").ProcessedTeam).stats.opr.totalPointsNp.toFixed(1))
                    : "\u2014"
                }
                subtitle={
                  topOprTeam
                    ? `#${topOprTeam.teamNumber} ${topOprTeam.teamName}`
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top 10 — seamless, no card chrome */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-lg font-medium text-[var(--text-primary)] tracking-tight">
                    {useSeasonData ? "Top 10 · season OPR" : "Top 10"}
                  </h3>
                  <Link
                    href="/leaderboard"
                    className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                  >
                    View all →
                  </Link>
                </div>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                        <th className="text-left px-3 py-2 w-12 font-medium">#</th>
                        <th className="text-left py-2 font-medium">Team</th>
                        <th className="text-right px-3 py-2 font-medium">OPR</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((team, i) => {
                        const isPsTeam = "bestOpr" in team;
                        const opr = isPsTeam
                          ? (team as import("@/lib/types").PrescoutRankedTeam).bestOpr.toFixed(1)
                          : (team as import("@/lib/types").ProcessedTeam).stats.opr.totalPointsNp.toFixed(1);
                        return (
                          <tr
                            key={team.teamNumber}
                            className="group/row border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-card-hover)] transition-colors"
                          >
                            <td className="px-3 py-3 text-[var(--text-muted)] font-mono text-xs">
                              {i + 1}
                            </td>
                            <td className="py-3">
                              <span className="font-mono text-[var(--text-primary)] text-xs mr-2">
                                {team.teamNumber}
                              </span>
                              <span className="text-[var(--text-secondary)] hidden sm:inline">
                                {team.teamName}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-[var(--text-primary)] text-xs tabular-nums">
                              {opr}
                            </td>
                            <td className="px-2 py-3">
                              <span className="opacity-0 group-hover/row:opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity">
                                <AddToPickListButton
                                  team={{
                                    teamNumber: team.teamNumber,
                                    teamName: team.teamName,
                                    opr: isPsTeam
                                      ? (team as import("@/lib/types").PrescoutRankedTeam).bestOpr
                                      : (team as import("@/lib/types").ProcessedTeam).stats.opr.totalPointsNp,
                                  }}
                                  size="xs"
                                />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Score distribution */}
              <div>
                <h3 className="font-display text-lg font-medium text-[var(--text-primary)] tracking-tight mb-3">
                  Score distribution
                </h3>
                <div className="bg-[var(--bg-card)] rounded-xl p-5">
                  <ScoreDistribution matches={event.matches} />
                </div>
              </div>
            </div>

            {/* Scoring Trends Heatmap */}
            <WorkspaceGate
              feature="Scoring Trends"
              description="Create or join a workspace to unlock the Scoring Trend Heatmap, Draft Board, Alliance Simulator, and more."
            >
              <div>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <h3 className="font-display text-lg font-medium text-[var(--text-primary)] tracking-tight">
                      Scoring trends
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Team performance across all matches · sorted by OPR
                    </p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {playedMatches.length} matches · {teams.length} teams
                  </span>
                </div>
                <div className="bg-[var(--bg-card)] rounded-xl p-4">
                  {playedMatches.length >= 3 ? (
                    <ScoringTrendHeatmap
                      matches={event.matches}
                      teams={teams}
                      eventCode={event.code}
                      myTeam={profile?.team_number ?? null}
                    />
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-[var(--text-secondary)]">
                        Scoring trends will appear after more matches are played.
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {playedMatches.length} of 3 needed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </WorkspaceGate>
          </div>
        )}
      </div>
    </div>
  );
}
