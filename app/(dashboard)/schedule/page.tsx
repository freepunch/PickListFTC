"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { useEvent } from "@/context/EventContext";
import { EventLoader } from "@/components/EventLoader";
import { PrescoutBanner } from "@/components/PrescoutBanner";

// ── Win probability ──
// Logistic function tuned so a 20-point margin → ~85% win probability.

const WIN_K = 20 / Math.log(0.85 / 0.15); // ≈ 11.53

function winProb(diff: number): number {
  return 1 / (1 + Math.exp(-diff / WIN_K));
}

// ── Internal types ──

interface ParsedMatch {
  id: number;
  played: boolean;
  red: [number, number];
  blue: [number, number];
  // Completed
  redScore: number | null;
  blueScore: number | null;
  autoRed: number | null;
  autoBlue: number | null;
  dcRed: number | null;
  dcBlue: number | null;
  // Prediction
  redPred: number;
  bluePred: number;
  redWinProb: number; // 0–1
}

type StatusFilter = "all" | "completed" | "upcoming";

// ── Helpers ──

function TeamLink({ num }: { num: number }) {
  if (!num) return <span className="text-zinc-700">—</span>;
  return (
    <Link
      href={`/report/${num}`}
      onClick={(e) => e.stopPropagation()}
      className="font-mono font-semibold text-white hover:text-[var(--accent)] transition-colors tabular-nums"
    >
      {num}
    </Link>
  );
}

function StatusPill({ played, isNow }: { played: boolean; isNow: boolean }) {
  if (isNow) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Now
      </span>
    );
  }
  if (played) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-500 uppercase tracking-wide">
        Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/60 text-zinc-600 uppercase tracking-wide">
      Upcoming
    </span>
  );
}

// ── Expanded detail: completed match ──

function CompletedDetail({ m }: { m: ParsedMatch }) {
  const redWon = (m.redScore ?? 0) > (m.blueScore ?? 0);
  const blueWon = (m.blueScore ?? 0) > (m.redScore ?? 0);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-wider border-b border-zinc-800/50">
              <th className="text-left py-1.5 pr-4">Alliance</th>
              <th className="text-right py-1.5 pr-4">Auto</th>
              <th className="text-right py-1.5 pr-4">Driver</th>
              <th className="text-right py-1.5">Total (NP)</th>
            </tr>
          </thead>
          <tbody>
            <tr className={`border-b border-zinc-800/30 ${redWon ? "text-white" : "text-zinc-400"}`}>
              <td className="py-1.5 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  Red
                  {redWon && <span className="text-[10px] text-emerald-400 font-medium">Win</span>}
                </span>
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.autoRed?.toFixed(0) ?? "—"}
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.dcRed?.toFixed(0) ?? "—"}
              </td>
              <td className={`py-1.5 text-right font-mono font-semibold ${redWon ? "text-emerald-400" : ""}`}>
                {m.redScore?.toFixed(0) ?? "—"}
              </td>
            </tr>
            <tr className={blueWon ? "text-white" : "text-zinc-400"}>
              <td className="py-1.5 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  Blue
                  {blueWon && <span className="text-[10px] text-emerald-400 font-medium">Win</span>}
                </span>
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.autoBlue?.toFixed(0) ?? "—"}
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.dcBlue?.toFixed(0) ?? "—"}
              </td>
              <td className={`py-1.5 text-right font-mono font-semibold ${blueWon ? "text-emerald-400" : ""}`}>
                {m.blueScore?.toFixed(0) ?? "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expanded detail: upcoming match ──

function UpcomingDetail({
  m,
  oprMap,
  devMap,
}: {
  m: ParsedMatch;
  oprMap: Map<number, number>;
  devMap: Map<number, number>;
}) {
  const allTeams = [...m.red, ...m.blue];
  const maxOpr = Math.max(...allTeams.map((n) => oprMap.get(n) ?? 0), 1);

  function TeamRow({
    num,
    alliance,
  }: {
    num: number;
    alliance: "red" | "blue";
  }) {
    const opr = oprMap.get(num) ?? 0;
    const dev = devMap.get(num) ?? 0;
    const isWildcard = dev > 35;
    const barPct = (opr / maxOpr) * 100;

    return (
      <div className="flex items-center gap-3 py-1">
        <Link
          href={`/report/${num}`}
          onClick={(e) => e.stopPropagation()}
          className={`font-mono text-sm font-semibold w-14 shrink-0 hover:underline ${
            alliance === "red" ? "text-red-300" : "text-blue-300"
          }`}
        >
          {num || "—"}
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-zinc-500">OPR</span>
            <span className="text-xs font-mono text-zinc-300 tabular-nums">
              {opr.toFixed(1)}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                alliance === "red" ? "bg-red-500/50" : "bg-blue-500/50"
              }`}
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>
        {isWildcard && (
          <span
            title="High score variance — unpredictable"
            className="text-amber-500/70 shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6">
      {/* Red */}
      <div className="flex-1">
        <p className="text-[10px] font-medium text-red-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Red Alliance
        </p>
        {m.red.map((n) => (
          <TeamRow key={n} num={n} alliance="red" />
        ))}
        <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center justify-between">
          <span className="text-xs text-zinc-600">Predicted</span>
          <span className="text-sm font-mono font-semibold text-red-300">
            {m.redPred}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-zinc-800 self-stretch" />

      {/* Blue */}
      <div className="flex-1">
        <p className="text-[10px] font-medium text-blue-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Blue Alliance
        </p>
        {m.blue.map((n) => (
          <TeamRow key={n} num={n} alliance="blue" />
        ))}
        <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center justify-between">
          <span className="text-xs text-zinc-600">Predicted</span>
          <span className="text-sm font-mono font-semibold text-blue-300">
            {m.bluePred}
          </span>
        </div>
      </div>

      {/* Win probability */}
      <div className="sm:w-40 shrink-0">
        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Win Probability
        </p>
        <div className="h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-red-500/60 transition-all duration-300"
            style={{ width: `${m.redWinProb * 100}%` }}
          />
          <div
            className="bg-blue-500/60 transition-all duration-300"
            style={{ width: `${(1 - m.redWinProb) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-mono text-red-400">
            {(m.redWinProb * 100).toFixed(0)}%
          </span>
          <span className="text-xs font-mono text-blue-400">
            {((1 - m.redWinProb) * 100).toFixed(0)}%
          </span>
        </div>
        {devMap.size > 0 && (
          <p className="text-[10px] text-zinc-700 mt-2 flex items-center gap-1">
            <svg className="w-3 h-3 text-amber-500/50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Wildcard = high variance
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function SchedulePage() {
  const {
    event, teams, loading,
    isPrescout, prescoutRanking, prescoutLoading,
  } = useEvent();

  const [teamQuery, setTeamQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  // OPR + dev maps
  const { oprMap, devMap } = useMemo(() => {
    const opr = new Map<number, number>();
    const dev = new Map<number, number>();
    if (isPrescout) {
      for (const t of prescoutRanking) opr.set(t.teamNumber, t.bestOpr);
    } else {
      for (const t of teams) {
        opr.set(t.teamNumber, t.stats.opr.totalPointsNp);
        dev.set(t.teamNumber, t.stats.dev.totalPointsNp);
      }
    }
    return { oprMap: opr, devMap: dev };
  }, [teams, isPrescout, prescoutRanking]);

  // Parse + sort matches
  const allMatches = useMemo<ParsedMatch[]>(() => {
    if (!event) return [];
    return [...event.matches]
      .sort((a, b) => a.id - b.id)
      .map((m) => {
        const red = m.teams
          .filter((t) => t.alliance === "Red")
          .sort((a, b) => a.station - b.station)
          .map((t) => t.teamNumber);
        const blue = m.teams
          .filter((t) => t.alliance === "Blue")
          .sort((a, b) => a.station - b.station)
          .map((t) => t.teamNumber);

        const r1 = red[0] ?? 0;
        const r2 = red[1] ?? 0;
        const b1 = blue[0] ?? 0;
        const b2 = blue[1] ?? 0;

        const redOpr = (oprMap.get(r1) ?? 0) + (oprMap.get(r2) ?? 0);
        const blueOpr = (oprMap.get(b1) ?? 0) + (oprMap.get(b2) ?? 0);

        return {
          id: m.id,
          played: m.hasBeenPlayed,
          red: [r1, r2],
          blue: [b1, b2],
          redScore: m.scores?.red.totalPointsNp ?? null,
          blueScore: m.scores?.blue.totalPointsNp ?? null,
          autoRed: m.scores?.red.autoPoints ?? null,
          autoBlue: m.scores?.blue.autoPoints ?? null,
          dcRed: m.scores?.red.dcPoints ?? null,
          dcBlue: m.scores?.blue.dcPoints ?? null,
          redPred: Math.round(redOpr),
          bluePred: Math.round(blueOpr),
          redWinProb: winProb(redOpr - blueOpr),
        };
      });
  }, [event, oprMap]);

  // "Now" = first unplayed match when at least one has been played
  const nowId = useMemo(() => {
    if (!allMatches.some((m) => m.played)) return null;
    return allMatches.find((m) => !m.played)?.id ?? null;
  }, [allMatches]);

  // Team highlight
  const highlightTeam = useMemo(() => {
    const n = parseInt(teamQuery.trim(), 10);
    return isNaN(n) || n <= 0 ? null : n;
  }, [teamQuery]);

  // Team summary card
  const teamSummary = useMemo(() => {
    if (!highlightTeam) return null;
    const involved = allMatches.filter(
      (m) => m.red.includes(highlightTeam) || m.blue.includes(highlightTeam)
    );
    const played = involved.filter((m) => m.played);
    const upcoming = involved.filter((m) => !m.played);

    let w = 0, l = 0, t = 0;
    for (const m of played) {
      if (m.redScore === null || m.blueScore === null) continue;
      const isRed = m.red.includes(highlightTeam);
      const mine = isRed ? m.redScore : m.blueScore;
      const opp = isRed ? m.blueScore : m.redScore;
      if (mine > opp) w++;
      else if (mine < opp) l++;
      else t++;
    }

    const next = upcoming[0];
    let nextDesc = "";
    if (next) {
      const isRed = next.red.includes(highlightTeam);
      const partner = (isRed ? next.red : next.blue).find((n) => n !== highlightTeam);
      const opponents = isRed ? next.blue : next.red;
      nextDesc = `Match ${next.id} · partner ${partner ?? "?"} vs ${opponents.filter(Boolean).join(" & ")}`;
    }

    return { played: played.length, upcoming: upcoming.length, w, l, t, next: nextDesc };
  }, [highlightTeam, allMatches]);

  // Filtered list
  const visible = useMemo(() => {
    if (statusFilter === "completed") return allMatches.filter((m) => m.played);
    if (statusFilter === "upcoming") return allMatches.filter((m) => !m.played);
    return allMatches;
  }, [allMatches, statusFilter]);

  const isLoading = loading || (isPrescout && prescoutLoading);

  // ── Empty states ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="w-5 h-5 animate-spin mr-3 text-zinc-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-zinc-500">Loading schedule…</p>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div className="min-h-screen flex flex-col">
      <EventLoader />
      <PrescoutBanner />

      <div className="flex-1 p-4 sm:p-6 pb-24 space-y-4">

        {!event && !isLoading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">Schedule</h2>
            <p className="text-sm text-zinc-500">Load an event to see the match schedule</p>
          </div>
        )}

        {event && (
          <>
            {/* Search + filter bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Team search */}
              <div className="relative w-full sm:w-56">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamQuery}
                  onChange={(e) => setTeamQuery(e.target.value)}
                  placeholder="Highlight team #…"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-8 py-2.5 text-sm text-white
                    placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
                />
                {teamQuery && (
                  <button
                    onClick={() => setTeamQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-0.5">
                {(["all", "completed", "upcoming"] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                      statusFilter === f
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Match count */}
              <p className="text-xs text-zinc-600 sm:ml-auto">
                {visible.length} match{visible.length !== 1 ? "es" : ""}
                {allMatches.some((m) => m.played) && (
                  <span className="ml-1">
                    · {allMatches.filter((m) => m.played).length} played
                  </span>
                )}
              </p>
            </div>

            {/* Team summary card */}
            {teamSummary && highlightTeam && (
              <div className="bg-zinc-900 border border-[var(--accent)]/30 rounded-xl px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Team{" "}
                      <Link
                        href={`/report/${highlightTeam}`}
                        className="font-mono text-[var(--accent)] hover:underline"
                      >
                        {highlightTeam}
                      </Link>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {teamSummary.played} played, {teamSummary.upcoming} remaining
                    </p>
                  </div>
                  <div className="sm:border-l sm:border-zinc-800 sm:pl-4">
                    <p className="text-xs text-zinc-500 mb-0.5">Record</p>
                    <p className="font-mono text-sm font-semibold text-white">
                      {teamSummary.w}-{teamSummary.l}-{teamSummary.t}
                    </p>
                  </div>
                  {teamSummary.next && (
                    <div className="sm:border-l sm:border-zinc-800 sm:pl-4 flex-1">
                      <p className="text-xs text-zinc-500 mb-0.5">Next</p>
                      <p className="text-xs text-zinc-300">{teamSummary.next}</p>
                    </div>
                  )}
                  {!teamSummary.next && (
                    <div className="sm:border-l sm:border-zinc-800 sm:pl-4">
                      <p className="text-xs text-zinc-600">No remaining matches</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Match table */}
            {visible.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 text-center text-sm text-zinc-500">
                No matches to display
              </div>
            ) : (
              <>
                {/* ── Desktop table (sm+) ── */}
                <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[580px]">
                      <thead>
                        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                          <th className="text-left px-4 py-3 w-20">Match</th>
                          <th className="text-center px-3 py-3 bg-red-500/5">Red 1</th>
                          <th className="text-center px-3 py-3 bg-red-500/5">Red 2</th>
                          <th className="text-center px-3 py-3 bg-blue-500/5">Blue 1</th>
                          <th className="text-center px-3 py-3 bg-blue-500/5">Blue 2</th>
                          <th className="text-right px-4 py-3">Score / Prediction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((m) => {
                          const isNow = m.id === nowId;
                          const isExpanded = expandedMatch === m.id;
                          const highlighted = !!(highlightTeam && (
                            m.red.includes(highlightTeam) || m.blue.includes(highlightTeam)
                          ));
                          const redWon = m.played && (m.redScore ?? 0) > (m.blueScore ?? 0);
                          const blueWon = m.played && (m.blueScore ?? 0) > (m.redScore ?? 0);
                          const rowBg = isNow
                            ? "bg-amber-500/5 border-l-2 border-l-amber-500/50"
                            : highlighted ? "bg-[var(--accent)]/5" : "";

                          return (
                            <Fragment key={m.id}>
                              <tr
                                onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                                className={`border-b border-zinc-800/50 last:border-0 cursor-pointer hover:bg-zinc-800/50 transition-colors ${rowBg}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-mono text-sm font-semibold text-zinc-200 tabular-nums">Q{m.id}</span>
                                    <StatusPill played={m.played} isNow={isNow} />
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center bg-red-500/5"><TeamLink num={m.red[0]} /></td>
                                <td className="px-3 py-3 text-center bg-red-500/5"><TeamLink num={m.red[1]} /></td>
                                <td className="px-3 py-3 text-center bg-blue-500/5"><TeamLink num={m.blue[0]} /></td>
                                <td className="px-3 py-3 text-center bg-blue-500/5"><TeamLink num={m.blue[1]} /></td>
                                <td className="px-4 py-3 text-right">
                                  {m.played ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <span className={`font-mono text-sm font-bold tabular-nums ${redWon ? "text-red-300" : "text-zinc-400"}`}>{m.redScore?.toFixed(0) ?? "—"}</span>
                                      <span className="text-zinc-700 text-xs">–</span>
                                      <span className={`font-mono text-sm font-bold tabular-nums ${blueWon ? "text-blue-300" : "text-zinc-400"}`}>{m.blueScore?.toFixed(0) ?? "—"}</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-mono text-xs text-red-400/60 italic tabular-nums">~{m.redPred}</span>
                                        <span className="text-zinc-700 text-[10px]">–</span>
                                        <span className="font-mono text-xs text-blue-400/60 italic tabular-nums">~{m.bluePred}</span>
                                      </div>
                                      <div className="h-1.5 rounded-full overflow-hidden flex w-24 ml-auto">
                                        <div className="bg-red-500/50 transition-all" style={{ width: `${m.redWinProb * 100}%` }} />
                                        <div className="bg-blue-500/50 transition-all" style={{ width: `${(1 - m.redWinProb) * 100}%` }} />
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-zinc-800/20 border-b border-zinc-800/50">
                                  <td colSpan={6} className="px-5 py-4">
                                    {m.played ? <CompletedDetail m={m} /> : <UpcomingDetail m={m} oprMap={oprMap} devMap={devMap} />}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Mobile card list (<sm) ── */}
                <div className="sm:hidden space-y-2">
                  {visible.map((m) => {
                    const isNow = m.id === nowId;
                    const isExpanded = expandedMatch === m.id;
                    const highlighted = !!(highlightTeam && (
                      m.red.includes(highlightTeam) || m.blue.includes(highlightTeam)
                    ));
                    const redWon = m.played && (m.redScore ?? 0) > (m.blueScore ?? 0);
                    const blueWon = m.played && (m.blueScore ?? 0) > (m.redScore ?? 0);

                    return (
                      <Fragment key={m.id}>
                        <div
                          onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                          className={`bg-zinc-900 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                            isNow
                              ? "border-amber-500/40 bg-amber-500/5"
                              : highlighted
                                ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                                : "border-zinc-800 hover:bg-zinc-800/50"
                          }`}
                        >
                          {/* Header row */}
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-zinc-200 tabular-nums">Q{m.id}</span>
                              <StatusPill played={m.played} isNow={isNow} />
                            </div>
                            {/* Score / prediction */}
                            {m.played ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono text-sm font-bold tabular-nums ${redWon ? "text-red-300" : "text-zinc-400"}`}>{m.redScore?.toFixed(0) ?? "—"}</span>
                                <span className="text-zinc-600 text-xs">–</span>
                                <span className={`font-mono text-sm font-bold tabular-nums ${blueWon ? "text-blue-300" : "text-zinc-400"}`}>{m.blueScore?.toFixed(0) ?? "—"}</span>
                              </div>
                            ) : (
                              <span className="font-mono text-xs text-zinc-500 italic">~{m.redPred} – ~{m.bluePred}</span>
                            )}
                          </div>

                          {/* Alliances */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 bg-red-500/5 rounded-lg px-2.5 py-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                              <span className="text-xs text-zinc-500 w-7 shrink-0">Red</span>
                              <div className="flex gap-3">
                                <TeamLink num={m.red[0]} />
                                <TeamLink num={m.red[1]} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-blue-500/5 rounded-lg px-2.5 py-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              <span className="text-xs text-zinc-500 w-7 shrink-0">Blue</span>
                              <div className="flex gap-3">
                                <TeamLink num={m.blue[0]} />
                                <TeamLink num={m.blue[1]} />
                              </div>
                            </div>
                          </div>

                          {/* Prediction bar for upcoming */}
                          {!m.played && (
                            <div className="mt-2.5 h-1.5 rounded-full overflow-hidden flex">
                              <div className="bg-red-500/50" style={{ width: `${m.redWinProb * 100}%` }} />
                              <div className="bg-blue-500/50" style={{ width: `${(1 - m.redWinProb) * 100}%` }} />
                            </div>
                          )}
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl px-4 py-4">
                            {m.played ? <CompletedDetail m={m} /> : <UpcomingDetail m={m} oprMap={oprMap} devMap={devMap} />}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
