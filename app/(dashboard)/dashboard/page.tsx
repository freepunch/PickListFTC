"use client";

import { useMemo, useEffect } from "react";
import Link from "next/link";
import { useEvent } from "@/context/EventContext";
import { EventLoader, focusEventInput } from "@/components/EventLoader";
import { StatCard } from "@/components/StatCard";
import { ScoreDistribution } from "@/components/ScoreDistribution";

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

export default function DashboardPage() {
  const { event, teams, loading } = useEvent();

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

  const topOprTeam = useMemo(
    () =>
      teams.length > 0
        ? teams.reduce((best, t) =>
            t.stats.opr.totalPointsNp > best.stats.opr.totalPointsNp ? t : best
          )
        : null,
    [teams]
  );

  const top10 = useMemo(
    () => [...teams].sort((a, b) => a.stats.rank - b.stats.rank).slice(0, 10),
    [teams]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <EventLoader />

      <div className="flex-1 p-4 sm:p-6">
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

        {!event && !loading && (
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
            </p>
          </div>
        )}

        {event && !loading && (
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
                label="Top OPR"
                value={topOprTeam ? topOprTeam.stats.opr.totalPointsNp.toFixed(1) : "\u2014"}
                subtitle={
                  topOprTeam
                    ? `#${topOprTeam.teamNumber} ${topOprTeam.teamName}`
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Top 10 Teams
                  </h3>
                  <Link
                    href="/leaderboard"
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                  >
                    View all
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50">
                        <th className="text-left px-5 py-2.5 w-12">#</th>
                        <th className="text-left py-2.5">Team</th>
                        <th className="text-right px-5 py-2.5">OPR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((team, i) => (
                        <tr
                          key={team.teamNumber}
                          className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-2.5 text-zinc-500 font-mono text-xs">
                            {i + 1}
                          </td>
                          <td className="py-2.5">
                            <span className="font-mono text-white text-xs mr-2">
                              {team.teamNumber}
                            </span>
                            <span className="text-zinc-400 hidden sm:inline">
                              {team.teamName}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-white text-xs">
                            {team.stats.opr.totalPointsNp.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Score distribution */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-200 mb-4">
                  Score Distribution
                </h3>
                <ScoreDistribution matches={event.matches} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
