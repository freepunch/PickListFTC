"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getTeamReport } from "@/lib/api";
import { getWLT } from "@/lib/calculations";
import { TeamReport, TeamEventEntry, TeamEventStats2025 } from "@/lib/types";
import { useEvent } from "@/context/EventContext";

// ── Executive summary builder ──

function buildSummary(report: TeamReport): string {
  const eventsWithStats = report.events.filter((e) => e.stats !== null);
  const count = eventsWithStats.length;
  if (count === 0) return "No event data available for this season.";

  const stats = eventsWithStats.map((e) => e.stats as TeamEventStats2025);

  const bestTotalOpr = Math.max(...stats.map((s) => s.opr.totalPointsNp));
  const bestAutoOpr = Math.max(...stats.map((s) => s.opr.autoPoints));
  const bestDcOpr = Math.max(...stats.map((s) => s.opr.dcPoints));

  // Classification
  const avgAutoRatio =
    stats.reduce(
      (sum, s) => sum + s.opr.autoPoints / (s.opr.totalPointsNp || 1),
      0
    ) / count;
  const avgDcRatio =
    stats.reduce(
      (sum, s) => sum + s.opr.dcPoints / (s.opr.totalPointsNp || 1),
      0
    ) / count;

  let classification: string;
  if (avgAutoRatio > avgDcRatio * 1.3) {
    classification = "auto-first";
  } else if (avgDcRatio > avgAutoRatio * 1.3) {
    classification = "DC-first";
  } else {
    classification = "balanced";
  }

  // Consistency
  const avgDev =
    stats.reduce((sum, s) => sum + s.dev.totalPointsNp, 0) / count;
  const avgTotal =
    stats.reduce((sum, s) => sum + s.avg.totalPointsNp, 0) / count;
  const isConsistent = avgDev < avgTotal * 0.25;

  // RP rates
  const avgMovementRp =
    stats.reduce((sum, s) => sum + (s.avg.movementRp ?? 0), 0) / count;
  const avgGoalRp =
    stats.reduce((sum, s) => sum + (s.avg.goalRp ?? 0), 0) / count;
  const avgPatternRp =
    stats.reduce((sum, s) => sum + (s.avg.patternRp ?? 0), 0) / count;

  const parts: string[] = [];

  parts.push(
    `Team ${report.number} has competed in ${count} event${count !== 1 ? "s" : ""} this season, achieving a peak OPR of ${bestTotalOpr.toFixed(1)} (Auto: ${bestAutoOpr.toFixed(1)}, DC: ${bestDcOpr.toFixed(1)}).`
  );

  const classLabels: Record<string, string> = {
    "auto-first": "an auto-first team, generating most of their scoring in autonomous",
    "DC-first": "a DC-first team, excelling during driver-controlled play",
    balanced: "a balanced team with well-distributed scoring across game phases",
  };
  parts.push(`They are ${classLabels[classification]}.`);

  if (isConsistent) {
    parts.push(
      `They are notably consistent, with low score variance across matches.`
    );
  }

  const rpNotes: string[] = [];
  if (avgMovementRp > 0.5)
    rpNotes.push(`movement (${(avgMovementRp * 100).toFixed(0)}%)`);
  if (avgGoalRp > 0.5)
    rpNotes.push(`goal (${(avgGoalRp * 100).toFixed(0)}%)`);
  if (avgPatternRp > 0.5)
    rpNotes.push(`pattern (${(avgPatternRp * 100).toFixed(0)}%)`);
  if (rpNotes.length > 0) {
    parts.push(`Strong RP achievement rates: ${rpNotes.join(", ")}.`);
  }

  // Alliance recommendation
  if (classification === "auto-first" && isConsistent) {
    parts.push(
      "Strong first-pick for alliances needing autonomous reliability."
    );
  } else if (classification === "DC-first") {
    parts.push(
      "Ideal partner for teams needing driver-controlled scoring power."
    );
  } else if (classification === "balanced" && isConsistent) {
    parts.push("Versatile partner with balanced scoring and reliable output.");
  } else {
    parts.push(
      "Flexible alliance partner who can contribute across all game phases."
    );
  }

  return parts.join(" ");
}

// ── Strength classification ──

function getStrengthProfile(
  stats: TeamEventStats2025[]
): { label: string; color: string } {
  if (stats.length === 0) return { label: "Unknown", color: "text-zinc-500" };

  const avgAutoOpr =
    stats.reduce((s, st) => s + st.opr.autoPoints, 0) / stats.length;
  const avgDcOpr =
    stats.reduce((s, st) => s + st.opr.dcPoints, 0) / stats.length;

  if (avgAutoOpr > avgDcOpr * 1.3) {
    return { label: "Auto-heavy", color: "text-blue-400" };
  }
  if (avgDcOpr > avgAutoOpr * 1.3) {
    return { label: "DC-heavy", color: "text-teal-400" };
  }
  return { label: "Balanced", color: "text-amber-400" };
}

// ── RP color helper ──

function rpColor(val: number): string {
  if (val >= 0.6) return "text-emerald-400";
  if (val >= 0.3) return "text-amber-400";
  return "text-red-400";
}

function rpBg(val: number): string {
  if (val >= 0.6) return "bg-emerald-500/15";
  if (val >= 0.3) return "bg-amber-500/15";
  return "bg-red-500/15";
}

// ── Main Page ──

export default function TeamReportPage({
  params,
}: {
  params: { teamNumber: string };
}) {
  const teamNumber = parseInt(params.teamNumber, 10);
  const [report, setReport] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { loadEvent } = useEvent();

  useEffect(() => {
    if (isNaN(teamNumber)) {
      setError("Invalid team number");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getTeamReport(teamNumber)
      .then(setReport)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load team")
      )
      .finally(() => setLoading(false));
  }, [teamNumber]);

  const eventsWithStats = useMemo(
    () =>
      (report?.events ?? [])
        .filter((e) => e.stats !== null)
        .sort(
          (a, b) =>
            new Date(a.event.start).getTime() -
            new Date(b.event.start).getTime()
        ),
    [report]
  );

  const allStats = useMemo(
    () => eventsWithStats.map((e) => e.stats as TeamEventStats2025),
    [eventsWithStats]
  );

  const trendData = useMemo(
    () =>
      eventsWithStats.map((e) => {
        const s = e.stats as TeamEventStats2025;
        return {
          event: e.event.name.length > 20
            ? e.event.name.slice(0, 18) + "..."
            : e.event.name,
          "Total OPR": parseFloat(s.opr.totalPointsNp.toFixed(1)),
          "Auto OPR": parseFloat(s.opr.autoPoints.toFixed(1)),
          "DC OPR": parseFloat(s.opr.dcPoints.toFixed(1)),
        };
      }),
    [eventsWithStats]
  );

  const strengthProfile = useMemo(
    () => getStrengthProfile(allStats),
    [allStats]
  );

  // Average RP rates
  const avgRp = useMemo(() => {
    if (allStats.length === 0)
      return { movement: 0, goal: 0, pattern: 0 };
    const n = allStats.length;
    return {
      movement:
        allStats.reduce((s, st) => s + (st.avg.movementRp ?? 0), 0) / n,
      goal: allStats.reduce((s, st) => s + (st.avg.goalRp ?? 0), 0) / n,
      pattern:
        allStats.reduce((s, st) => s + (st.avg.patternRp ?? 0), 0) / n,
    };
  }, [allStats]);

  const handleEventClick = (entry: TeamEventEntry) => {
    loadEvent(entry.eventCode, 2025);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        <svg className="w-5 h-5 animate-spin mr-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading team report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-lg text-zinc-200 mb-1">
          {error || "Team not found"}
        </p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline mt-2">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-bold font-mono text-white">
              {report.number}
            </h1>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${strengthProfile.color} ${
                strengthProfile.label === "Auto-heavy"
                  ? "bg-blue-500/15"
                  : strengthProfile.label === "DC-heavy"
                    ? "bg-teal-500/15"
                    : "bg-amber-500/15"
              }`}
            >
              {strengthProfile.label}
            </span>
          </div>
          <p className="text-lg text-zinc-300">{report.name}</p>
          <p className="text-sm text-zinc-500">
            {report.schoolName}
            {report.rookieYear > 0 && (
              <span className="ml-2 text-zinc-600">
                &middot; Rookie {report.rookieYear}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="font-mono">{eventsWithStats.length}</span>
            event{eventsWithStats.length !== 1 ? "s" : ""} this season
          </span>
        </div>
      </div>

      {/* Executive summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {buildSummary(report)}
          </p>
        </div>
      </div>

      {/* Season OPR trend chart */}
      {trendData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">
            Season OPR Trend
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 5, right: 20, bottom: 5, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="event"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#fafafa",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
                />
                <Line
                  type="monotone"
                  dataKey="Total OPR"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ fill: "#3b82f6", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#60a5fa", strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Auto OPR"
                  stroke="#93c5fd"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={{ fill: "#93c5fd", r: 3, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="DC OPR"
                  stroke="#14b8a6"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={{ fill: "#14b8a6", r: 3, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* QuickStats + RP profile row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QuickStats */}
        {report.quickStats && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-zinc-200 mb-4">
              Season Best (QuickStats)
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {(
                [
                  { key: "tot" as const, label: "Total" },
                  { key: "auto" as const, label: "Auto" },
                  { key: "dc" as const, label: "DC" },
                  { key: "eg" as const, label: "Endgame" },
                ] as const
              ).map(({ key, label }) => {
                const qs = report.quickStats![key];
                return (
                  <div key={key} className="text-center">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                      {label}
                    </p>
                    <p className="text-xs text-zinc-400 mb-0.5">
                      <span className="font-mono text-[var(--accent)]">
                        #{qs.rank}
                      </span>
                    </p>
                    <p className="text-xl font-mono font-semibold text-white">
                      {qs.value.toFixed(1)}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-zinc-600 mt-3 text-center">
              Across {report.quickStats.count} matches
            </p>
          </div>
        )}

        {/* RP profile */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-200 mb-4">
            RP Profile
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Movement", value: avgRp.movement },
              { label: "Goal", value: avgRp.goal },
              { label: "Pattern", value: avgRp.pattern },
            ].map(({ label, value }) => (
              <div
                key={label}
                className={`rounded-xl p-4 text-center ${rpBg(value)}`}
              >
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  {label}
                </p>
                <p className={`text-2xl font-mono font-semibold ${rpColor(value)}`}>
                  {(value * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strengths bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">
          Scoring Profile
        </h3>
        {allStats.length > 0 ? (
          <div className="space-y-3">
            {(() => {
              const avgAutoOpr =
                allStats.reduce((s, st) => s + st.opr.autoPoints, 0) /
                allStats.length;
              const avgDcOpr =
                allStats.reduce((s, st) => s + st.opr.dcPoints, 0) /
                allStats.length;
              const maxOpr = Math.max(avgAutoOpr, avgDcOpr, 1);

              return (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">Auto OPR (avg)</span>
                      <span className="font-mono text-xs text-zinc-200">
                        {avgAutoOpr.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${(avgAutoOpr / maxOpr) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">DC OPR (avg)</span>
                      <span className="font-mono text-xs text-zinc-200">
                        {avgDcOpr.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-500"
                        style={{ width: `${(avgDcOpr / maxOpr) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No data available.</p>
        )}
      </div>

      {/* Event-by-event table */}
      {eventsWithStats.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">
              Event History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="text-left px-6 py-2.5">Event</th>
                  <th className="text-left px-3 py-2.5">Date</th>
                  <th className="text-right px-3 py-2.5">Rank</th>
                  <th className="text-left px-3 py-2.5">W-L-T</th>
                  <th className="text-right px-3 py-2.5">OPR</th>
                  <th className="text-right px-3 py-2.5">Avg Score</th>
                  <th className="text-right px-6 py-2.5">Matches</th>
                </tr>
              </thead>
              <tbody>
                {eventsWithStats.map((entry) => {
                  const s = entry.stats as TeamEventStats2025;
                  return (
                    <tr
                      key={entry.eventCode}
                      onClick={() => handleEventClick(entry)}
                      className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-2.5 text-zinc-200 max-w-[200px] truncate">
                        {entry.event.name}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500 text-xs font-mono">
                        {new Date(entry.event.start).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-200">
                        {s.rank}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-zinc-400">
                        {getWLT(s)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white font-medium">
                        {s.opr.totalPointsNp.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-400">
                        {s.avg.totalPointsNp.toFixed(1)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-zinc-500">
                        {s.qualMatchesPlayed}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="text-center pb-6">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
