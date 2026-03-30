"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useFavorites } from "@/context/FavoritesContext";
import { getTeamReport } from "@/lib/api";
import { TeamReport, TeamEventStats2025 } from "@/lib/types";

interface WatchedTeamData {
  teamNumber: number;
  teamName: string;
  latestOpr: number;
  lastEvent: string;
  eventCount: number;
  trend: "up" | "down" | "stable";
  record: { wins: number; losses: number; ties: number };
}

export default function WatchedTeamsPage() {
  const { favoriteTeams, toggleTeamFav } = useFavorites();
  const [teamData, setTeamData] = useState<Map<number, WatchedTeamData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadedTeams, setLoadedTeams] = useState<Set<number>>(new Set());

  // Fetch report data for favorited teams
  useEffect(() => {
    if (favoriteTeams.length === 0) return;

    const toFetch = favoriteTeams.filter((t) => !loadedTeams.has(t.team_number));
    if (toFetch.length === 0) return;

    setLoading(true);

    Promise.allSettled(
      toFetch.map(async (fav) => {
        try {
          const report = await getTeamReport(fav.team_number);
          return { teamNumber: fav.team_number, report };
        } catch {
          return { teamNumber: fav.team_number, report: null };
        }
      })
    ).then((results) => {
      setTeamData((prev) => {
        const next = new Map(prev);
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { teamNumber, report } = result.value;
          if (!report) continue;

          const eventsWithStats = report.events
            .filter((e) => e.stats !== null)
            .sort(
              (a, b) =>
                new Date(a.event.start).getTime() -
                new Date(b.event.start).getTime()
            );

          if (eventsWithStats.length === 0) {
            next.set(teamNumber, {
              teamNumber,
              teamName: report.name,
              latestOpr: 0,
              lastEvent: "No events",
              eventCount: 0,
              trend: "stable",
              record: { wins: 0, losses: 0, ties: 0 },
            });
            continue;
          }

          const stats = eventsWithStats.map((e) => e.stats as TeamEventStats2025);
          const latest = stats[stats.length - 1];
          const latestEvent = eventsWithStats[eventsWithStats.length - 1];

          // Trend: compare last two events
          let trend: "up" | "down" | "stable" = "stable";
          if (stats.length >= 2) {
            const prev = stats[stats.length - 2];
            const diff = latest.opr.totalPointsNp - prev.opr.totalPointsNp;
            if (diff > 2) trend = "up";
            else if (diff < -2) trend = "down";
          }

          const totalRecord = stats.reduce(
            (acc, s) => ({
              wins: acc.wins + s.wins,
              losses: acc.losses + s.losses,
              ties: acc.ties + s.ties,
            }),
            { wins: 0, losses: 0, ties: 0 }
          );

          next.set(teamNumber, {
            teamNumber,
            teamName: report.name,
            latestOpr: latest.opr.totalPointsNp,
            lastEvent: latestEvent.event.name,
            eventCount: eventsWithStats.length,
            trend,
            record: totalRecord,
          });
        }
        return next;
      });

      setLoadedTeams((prev) => {
        const next = new Set(prev);
        for (const result of results) {
          if (result.status === "fulfilled") {
            next.add(result.value.teamNumber);
          }
        }
        return next;
      });
      setLoading(false);
    });
  }, [favoriteTeams, loadedTeams]);

  const sortedTeams = useMemo(() => {
    return favoriteTeams
      .map((fav) => ({
        fav,
        data: teamData.get(fav.team_number),
      }))
      .sort((a, b) => {
        const oprA = a.data?.latestOpr ?? 0;
        const oprB = b.data?.latestOpr ?? 0;
        return oprB - oprA;
      });
  }, [favoriteTeams, teamData]);

  const trendIcon = { up: "\u2191", down: "\u2193", stable: "\u2192" };
  const trendColor = {
    up: "text-emerald-400",
    down: "text-red-400",
    stable: "text-zinc-400",
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Watched Teams</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {favoriteTeams.length} team{favoriteTeams.length !== 1 ? "s" : ""} across all events
            </p>
          </div>
        </div>

        {favoriteTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-zinc-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">
              No watched teams yet
            </h2>
            <p className="text-sm text-zinc-500 max-w-sm">
              Star teams from the leaderboard or team reports to track them here
              across all events.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Latest OPR
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">
                      Last Event
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Events
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">
                      Record
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      Trend
                    </th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map(({ fav, data }, i) => (
                    <tr
                      key={fav.team_number}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors ${
                        i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/60"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/report/${fav.team_number}`}
                          className="hover:underline"
                        >
                          <span className="font-mono text-white text-sm font-medium mr-2">
                            {fav.team_number}
                          </span>
                          <span className="text-zinc-400">
                            {data?.teamName ?? fav.team_name ?? ""}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white text-sm">
                        {loading && !data ? (
                          <span className="skeleton inline-block h-4 w-10" />
                        ) : (
                          data?.latestOpr.toFixed(1) ?? "\u2014"
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-sm hidden sm:table-cell truncate max-w-[200px]">
                        {loading && !data ? (
                          <span className="skeleton inline-block h-4 w-24" />
                        ) : (
                          data?.lastEvent ?? "\u2014"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-zinc-400 text-sm">
                        {loading && !data ? (
                          <span className="skeleton inline-block h-4 w-6" />
                        ) : (
                          data?.eventCount ?? "\u2014"
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400 text-sm hidden md:table-cell">
                        {data
                          ? `${data.record.wins}-${data.record.losses}-${data.record.ties}`
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {data ? (
                          <span className={`text-sm ${trendColor[data.trend]}`}>
                            {trendIcon[data.trend]}
                          </span>
                        ) : (
                          "\u2014"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() =>
                            toggleTeamFav({
                              team_number: fav.team_number,
                              team_name: fav.team_name,
                              notes: null,
                            })
                          }
                          title="Remove from watched"
                          className="p-1 text-amber-400 hover:text-red-400 transition-colors"
                        >
                          <svg
                            className="w-4 h-4 fill-current"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
