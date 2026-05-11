"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceOptional } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import { EventLoader } from "@/components/EventLoader";
import { PrescoutBanner } from "@/components/PrescoutBanner";
import { AddToPickListButton } from "@/components/AddToPickListButton";
import { TeamSearch, TeamSearchOption } from "@/components/TeamSearch";
import type { Match } from "@/lib/types";
import {
  MatchAssignment,
  MatchAssignmentConfidence,
  loadMatchAssignments,
  upsertMatchAssignment,
  deleteMatchAssignment,
} from "@/lib/workspace";

// ── Win probability ──
const WIN_K = 20 / Math.log(0.85 / 0.15);
function winProb(diff: number): number {
  return 1 / (1 + Math.exp(-diff / WIN_K));
}

/** Best-of-3 series win probability for one alliance, given how many wins
 *  each side already has and the per-match win probability for the focus
 *  alliance. Recursive expansion is fine — the tree is at most 3 deep. */
function seriesWinProb(focusWins: number, oppWins: number, p: number): number {
  if (focusWins >= 2) return 1;
  if (oppWins >= 2) return 0;
  // Probability focus wins THIS match, then wins the resulting series state,
  // plus probability focus loses then wins from the new state.
  return p * seriesWinProb(focusWins + 1, oppWins, p) +
    (1 - p) * seriesWinProb(focusWins, oppWins + 1, p);
}

const MY_TEAM_KEY = "plftc:scheduleMyTeam";

// ── Types ──

type MatchPhase = "quals" | "semis" | "finals" | "doubleElim";

interface ParsedMatch {
  id: number;
  matchNum: number;
  series: number;
  description: string;
  phase: MatchPhase;
  /** Compact display label, e.g. "Q12", "M-7", "SF1-2", "F-1". */
  label: string;
  played: boolean;
  /** On-field teams (station One, Two). */
  red: [number, number];
  blue: [number, number];
  /** Backup team on the bench (station NotOnField). Elims only; null otherwise. */
  redBackup: number | null;
  blueBackup: number | null;
  /** Alliance captain team numbers, when known. Used to identify "Alliance #N". */
  redCaptain: number | null;
  blueCaptain: number | null;
  redScore: number | null;
  blueScore: number | null;
  autoRed: number | null;
  autoBlue: number | null;
  dcRed: number | null;
  dcBlue: number | null;
  penaltyRed: number | null;
  penaltyBlue: number | null;
  redOpr: number;
  blueOpr: number;
  redPred: number;
  bluePred: number;
  redWinProb: number;
}

type StatusFilter = "all" | "quals" | "elims" | "mine";

// ── Match-phase helpers ──────────────────────────────────────────────────────

const PHASE_ORDER: Record<MatchPhase, number> = {
  quals: 0,
  semis: 1,
  finals: 2,
  doubleElim: 3,
};

const PHASE_LABEL: Record<MatchPhase, string> = {
  quals: "Qualification Matches",
  semis: "Semifinals",
  finals: "Finals",
  doubleElim: "Playoff Bracket",
};

function detectPhase(level: string | null | undefined, description: string): MatchPhase {
  // Prefer the explicit tournamentLevel; fall back to description heuristics
  // for older API responses that may not return the field.
  switch (level) {
    case "Quals":
      return "quals";
    case "Semis":
      return "semis";
    case "Finals":
      return "finals";
    case "DoubleElim":
      return "doubleElim";
  }
  const d = (description ?? "").toUpperCase();
  if (d.startsWith("SF")) return "semis";
  if (d.startsWith("F-") || d === "F") return "finals";
  if (d.startsWith("M-") || d.startsWith("M")) return "doubleElim";
  return "quals";
}

function buildMatchLabel(phase: MatchPhase, matchNum: number, series: number, description: string): string {
  // Use the API's description when present — it already follows FTC conventions.
  if (description && description.length > 0 && description !== "?") return description;
  if (phase === "quals") return `Q-${matchNum || "?"}`;
  if (phase === "semis") return `SF${series || "?"}-${matchNum || "?"}`;
  if (phase === "finals") return `F-${matchNum || "?"}`;
  if (phase === "doubleElim") return `M-${series || matchNum || "?"}`;
  return `#${matchNum || "?"}`;
}

/** Convert station enum to a sortable index. Strings are the modern API; ints
 *  are accepted for resilience. NotOnField is the bench / backup spot. */
function stationOrder(station: unknown): number {
  if (typeof station === "number") return station;
  if (station === "One") return 1;
  if (station === "Two") return 2;
  if (station === "NotOnField") return 99;
  if (station === "Solo") return 0;
  return 50;
}

// ── Small helpers ──

function TeamLink({ num, highlight }: { num: number; highlight?: boolean }) {
  if (!num) return <span className="text-zinc-700">—</span>;
  return (
    <Link
      href={`/report/${num}`}
      onClick={(e) => e.stopPropagation()}
      className={`font-mono tabular-nums hover:text-[var(--accent)] transition-colors ${
        highlight ? "font-bold text-[var(--accent)]" : "font-semibold text-white"
      }`}
    >
      {num}
    </Link>
  );
}

function StatusBadge({
  played,
  isOnDeck,
  isInTheHole,
  pulse,
}: {
  played: boolean;
  isOnDeck: boolean;
  isInTheHole: boolean;
  pulse: boolean;
}) {
  if (isOnDeck) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40 ${
          pulse ? "animate-pulse" : ""
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        On Deck
      </span>
    );
  }
  if (isInTheHole) {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wide bg-zinc-800 text-zinc-300 border-zinc-700 ${
          pulse ? "animate-pulse" : ""
        }`}
      >
        In The Hole
      </span>
    );
  }
  if (played) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-500 uppercase tracking-wide">
        Played
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/60 text-zinc-600 uppercase tracking-wide">
      Upcoming
    </span>
  );
}

// ── Heatmap bar: 4px-tall colored strip whose intensity reflects combined OPR
// relative to the event-wide range. Rendered in normal flow as the last item
// in the alliance cell so it sits BELOW the team numbers and combined OPR text.
function HeatmapBar({
  side,
  oprSum,
  min,
  max,
  played,
  outcome,
}: {
  side: "red" | "blue";
  oprSum: number;
  min: number;
  max: number;
  /** When true, this match has been played; outcome marker is shown. */
  played: boolean;
  /** "win" | "loss" | "tie" relative to this side. Only used when played. */
  outcome: "win" | "loss" | "tie";
}) {
  // Intensity: 0..1. If event has no spread, fall back to 0.5.
  const span = max - min;
  const t = span > 0 ? Math.max(0, Math.min(1, (oprSum - min) / span)) : 0.5;
  // Map t to opacity 0.2..0.8 per spec.
  const opacity = 0.2 + 0.6 * t;
  const colorClass = side === "red" ? "bg-red-500" : "bg-blue-500";
  return (
    <div
      aria-hidden="true"
      className="relative w-full h-1 mt-1 rounded-full overflow-hidden pointer-events-none"
    >
      <div
        className={`h-full w-full ${colorClass} transition-opacity duration-300`}
        style={{ opacity }}
      />
      {played && outcome !== "tie" && (
        <span
          className={`absolute -top-3.5 ${side === "red" ? "left-0" : "right-0"} text-[10px] font-bold leading-none ${
            outcome === "win" ? "text-emerald-400/80" : "text-zinc-600"
          }`}
        >
          {outcome === "win" ? "✓" : "✗"}
        </span>
      )}
    </div>
  );
}

function AllianceCell({
  teams,
  backup,
  side,
  oprSum,
  brighter,
  myTeam,
  isPrescout,
  heatmapRange,
  played,
  outcome,
}: {
  teams: [number, number];
  /** Backup team on the bench. Only present in elimination matches. */
  backup: number | null;
  side: "red" | "blue";
  oprSum: number;
  brighter: boolean;
  myTeam: number | null;
  isPrescout: boolean;
  heatmapRange: { min: number; max: number } | null;
  played: boolean;
  outcome: "win" | "loss" | "tie";
}) {
  const tone = side === "red" ? "text-red-300" : "text-blue-300";
  const muted = side === "red" ? "text-red-400/50" : "text-blue-400/50";
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      {/* Line 1: on-field team numbers (with optional backup styled lightly) */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <TeamLink num={teams[0]} highlight={myTeam === teams[0]} />
        <TeamLink num={teams[1]} highlight={myTeam === teams[1]} />
        {backup !== null && backup > 0 && (
          <span
            className={`font-mono tabular-nums text-xs ${myTeam === backup ? "font-bold text-[var(--accent)]" : "text-zinc-500 italic"}`}
            title="Backup (not on field this match)"
          >
            +{backup}
          </span>
        )}
      </div>
      {/* Line 2: combined OPR */}
      {!isPrescout && oprSum > 0 && (
        <span className={`text-[10px] font-mono tabular-nums ${brighter ? tone : muted}`}>
          {oprSum.toFixed(1)}
        </span>
      )}
      {/* Line 3: heatmap bar */}
      {heatmapRange && oprSum > 0 && !isPrescout && (
        <HeatmapBar
          side={side}
          oprSum={oprSum}
          min={heatmapRange.min}
          max={heatmapRange.max}
          played={played}
          outcome={outcome}
        />
      )}
    </div>
  );
}

// ── Win-probability donut: animated SVG ring showing red vs blue win odds.
// Center text shows the favored alliance's predicted score.
function WinProbDonut({
  redWinProb,
  redPred,
  bluePred,
  size = 48,
}: {
  redWinProb: number;
  redPred: number;
  bluePred: number;
  size?: number;
}) {
  const [animatedProb, setAnimatedProb] = useState(0.5);
  useEffect(() => {
    // Animate from 50/50 to actual on mount / when redWinProb changes.
    const id = window.requestAnimationFrame(() => setAnimatedProb(redWinProb));
    return () => window.cancelAnimationFrame(id);
  }, [redWinProb]);

  const radius = size / 2 - 6; // stroke 6, fits inside size
  const circumference = 2 * Math.PI * radius;
  // Gap at 12 o'clock: rotate the visible segments by -90deg and add a small gap.
  const gapPx = 4;
  const usable = circumference - gapPx;
  const redLen = usable * animatedProb;
  const blueLen = usable * (1 - animatedProb);

  const redFavored = redPred >= bluePred;
  const favoredScore = redFavored ? redPred : bluePred;
  const favoredColor = redFavored ? "text-red-300" : "text-blue-300";
  const redPct = Math.round(animatedProb * 100);
  const bluePct = 100 - redPct;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={`Red ${redPct}% — Blue ${bluePct}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          style={{ stroke: "var(--donut-track)" }}
          strokeWidth={6}
        />
        {/* Red arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(248 113 113)" /* red-400 */
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${redLen} ${circumference}`}
          strokeDashoffset={circumference / 4 - gapPx / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 320ms ease-out" }}
        />
        {/* Blue arc starts where red ended (clockwise). */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(96 165 250)" /* blue-400 */
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${blueLen} ${circumference}`}
          strokeDashoffset={-redLen + circumference / 4 - gapPx / 2}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 320ms ease-out, stroke-dashoffset 320ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-mono text-[11px] font-semibold tabular-nums ${favoredColor}`}>
          {favoredScore}
        </span>
      </div>
    </div>
  );
}

// ── Score / prediction display ──

function ScoreDisplay({
  m,
  myTeam,
  /** Optional override for the donut probability — used to surface series win
   *  probability for best-of-3 elims, where a single-match prob alone is
   *  misleading. */
  redWinProbOverride,
}: {
  m: ParsedMatch;
  myTeam: number | null;
  redWinProbOverride?: number | null;
}) {
  const redWon = m.played && (m.redScore ?? 0) > (m.blueScore ?? 0);
  const blueWon = m.played && (m.blueScore ?? 0) > (m.redScore ?? 0);
  const myAlliance = myTeam
    ? m.red.includes(myTeam)
      ? "red"
      : m.blue.includes(myTeam)
        ? "blue"
        : null
    : null;

  if (m.played) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            redWon ? "text-red-300" : "text-zinc-500"
          } ${myAlliance === "red" ? "underline decoration-[var(--accent)]/40 underline-offset-2" : ""}`}
        >
          {m.redScore?.toFixed(0) ?? "—"}
        </span>
        <span className="text-zinc-700 text-xs">–</span>
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            blueWon ? "text-blue-300" : "text-zinc-500"
          } ${myAlliance === "blue" ? "underline decoration-[var(--accent)]/40 underline-offset-2" : ""}`}
        >
          {m.blueScore?.toFixed(0) ?? "—"}
        </span>
      </div>
    );
  }
  // Upcoming match: show the win-probability donut.
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="flex flex-col items-end">
        <span className="font-mono text-[10px] text-red-400/60 italic tabular-nums leading-tight">
          ~{m.redPred}
        </span>
        <span className="font-mono text-[10px] text-blue-400/60 italic tabular-nums leading-tight">
          ~{m.bluePred}
        </span>
      </div>
      <WinProbDonut
        redWinProb={redWinProbOverride ?? m.redWinProb}
        redPred={m.redPred}
        bluePred={m.bluePred}
        size={48}
      />
    </div>
  );
}

// ── Expanded detail: completed match ──

function CompletedDetail({
  m,
  oprMap,
  predictionCorrect,
}: {
  m: ParsedMatch;
  oprMap: Map<number, number>;
  predictionCorrect: boolean;
}) {
  const redWon = (m.redScore ?? 0) > (m.blueScore ?? 0);
  const blueWon = (m.blueScore ?? 0) > (m.redScore ?? 0);
  const tied = m.played && (m.redScore ?? 0) === (m.blueScore ?? 0);

  function TeamContribution({ num, side }: { num: number; side: "red" | "blue" }) {
    const opr = oprMap.get(num) ?? 0;
    const tone = side === "red" ? "text-red-300" : "text-blue-300";
    return (
      <div className="flex items-center gap-2 text-xs">
        <Link
          href={`/report/${num}`}
          onClick={(e) => e.stopPropagation()}
          className={`font-mono font-semibold ${tone} hover:underline`}
        >
          {num || "—"}
        </Link>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">OPR</span>
        <span className="font-mono tabular-nums text-zinc-300">
          {opr.toFixed(1)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Score breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-wider border-b border-zinc-800/50">
              <th className="text-left py-1.5 pr-4">Alliance</th>
              <th className="text-right py-1.5 pr-4">Auto</th>
              <th className="text-right py-1.5 pr-4">Driver</th>
              <th className="text-right py-1.5 pr-4">Pen.</th>
              <th className="text-right py-1.5">Total (NP)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              className={`border-b border-zinc-800/30 ${
                redWon ? "text-white" : "text-zinc-400"
              }`}
            >
              <td className="py-1.5 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  Red
                  {redWon && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Win
                    </span>
                  )}
                </span>
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.autoRed?.toFixed(0) ?? "—"}
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.dcRed?.toFixed(0) ?? "—"}
              </td>
              <td className="py-1.5 pr-4 text-right font-mono text-zinc-500">
                {m.penaltyRed != null ? m.penaltyRed.toFixed(0) : "—"}
              </td>
              <td
                className={`py-1.5 text-right font-mono font-semibold ${
                  redWon ? "text-emerald-400" : ""
                }`}
              >
                {m.redScore?.toFixed(0) ?? "—"}
              </td>
            </tr>
            <tr className={blueWon ? "text-white" : "text-zinc-400"}>
              <td className="py-1.5 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  Blue
                  {blueWon && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Win
                    </span>
                  )}
                </span>
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.autoBlue?.toFixed(0) ?? "—"}
              </td>
              <td className="py-1.5 pr-4 text-right font-mono">
                {m.dcBlue?.toFixed(0) ?? "—"}
              </td>
              <td className="py-1.5 pr-4 text-right font-mono text-zinc-500">
                {m.penaltyBlue != null ? m.penaltyBlue.toFixed(0) : "—"}
              </td>
              <td
                className={`py-1.5 text-right font-mono font-semibold ${
                  blueWon ? "text-emerald-400" : ""
                }`}
              >
                {m.blueScore?.toFixed(0) ?? "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Per-team OPR contribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-800/40">
        <div>
          <p className="text-[10px] font-medium text-red-400/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Red contribution
          </p>
          <div className="space-y-1">
            {m.red.map((n) => (
              <TeamContribution key={n} num={n} side="red" />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium text-blue-400/70 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Blue contribution
          </p>
          <div className="space-y-1">
            {m.blue.map((n) => (
              <TeamContribution key={n} num={n} side="blue" />
            ))}
          </div>
        </div>
      </div>

      {/* Prediction accuracy */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-zinc-800/40">
        <span className="text-zinc-500">
          Predicted: <span className="font-mono">{m.redPred}</span> –{" "}
          <span className="font-mono">{m.bluePred}</span>
        </span>
        {tied ? (
          <span className="text-zinc-500">Tie</span>
        ) : predictionCorrect ? (
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Prediction correct
          </span>
        ) : (
          <span className="text-amber-400 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Upset
          </span>
        )}
      </div>
    </div>
  );
}

// ── Expanded detail: upcoming match ──

function UpcomingDetail({
  m,
  oprMap,
  devMap,
  wildcardThreshold,
  myTeam,
  teamNameMap,
}: {
  m: ParsedMatch;
  oprMap: Map<number, number>;
  devMap: Map<number, number>;
  wildcardThreshold: number;
  myTeam: number | null;
  teamNameMap: Map<number, string>;
}) {
  const allTeams = [...m.red, ...m.blue].filter(Boolean);
  const maxOpr = Math.max(...allTeams.map((n) => oprMap.get(n) ?? 0), 1);
  const myAlliance = myTeam
    ? m.red.includes(myTeam)
      ? "red"
      : m.blue.includes(myTeam)
        ? "blue"
        : null
    : null;
  const opponents = myAlliance === "red" ? m.blue : myAlliance === "blue" ? m.red : null;

  function TeamRow({ num, alliance }: { num: number; alliance: "red" | "blue" }) {
    const opr = oprMap.get(num) ?? 0;
    const dev = devMap.get(num) ?? 0;
    const isWildcard = dev >= wildcardThreshold && devMap.size > 0;
    const barPct = (opr / maxOpr) * 100;

    return (
      <div className="flex items-center gap-3 py-1">
        <Link
          href={`/report/${num}`}
          onClick={(e) => e.stopPropagation()}
          className={`font-mono text-sm font-semibold w-14 shrink-0 hover:underline ${
            alliance === "red" ? "text-red-300" : "text-blue-300"
          } ${myTeam === num ? "ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-zinc-900 rounded px-1" : ""}`}
        >
          {num || "—"}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5 gap-2">
            <span className="text-[10px] text-zinc-500 truncate">
              {teamNameMap.get(num) || ""}
            </span>
            <span className="text-xs font-mono text-zinc-300 tabular-nums shrink-0">
              {opr.toFixed(1)}
            </span>
          </div>
          <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
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
            className="text-amber-500/70 shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Wildcard
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/40">
        {opponents && opponents.filter(Boolean).length > 0 && (
          <Link
            href={`/compare?teams=${opponents.filter(Boolean).join(",")}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/25 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
            Scout opposing alliance
          </Link>
        )}
        {opponents && opponents.filter(Boolean).map((num) => (
          <div key={num} onClick={(e) => e.stopPropagation()}>
            <AddToPickListButtonWithLabel
              num={num}
              name={teamNameMap.get(num) || ""}
              opr={oprMap.get(num) ?? 0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AddToPickListButtonWithLabel({
  num,
  name,
  opr,
}: {
  num: number;
  name: string;
  opr: number;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs">
      <span className="font-mono font-semibold text-zinc-300">{num}</span>
      <AddToPickListButton
        team={{ teamNumber: num, teamName: name, opr }}
        size="xs"
      />
    </div>
  );
}

// ── BattleCard: head-to-head VS layout used as match expansion content.
// Works for both completed and upcoming matches.

function BattleStatBar({
  label,
  redValue,
  blueValue,
  redLabel,
  blueLabel,
  invertWinner = false,
}: {
  label: string;
  redValue: number;
  blueValue: number;
  redLabel: string;
  blueLabel: string;
  /** When true, the LOWER value is the better outcome (e.g., penalties). */
  invertWinner?: boolean;
}) {
  const max = Math.max(redValue, blueValue, 0.0001);
  const redPct = Math.max(0, Math.min(1, redValue / max)) * 100;
  const bluePct = Math.max(0, Math.min(1, blueValue / max)) * 100;

  // Highlight the favoured side for this stat.
  const redFavored = invertWinner ? redValue < blueValue : redValue > blueValue;
  const blueFavored = invertWinner ? blueValue < redValue : blueValue > redValue;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      {/* Red side — bar grows from center toward the left edge */}
      <div className="flex flex-row-reverse items-center gap-2 min-w-0">
        <span className={`font-mono text-xs tabular-nums ${redFavored ? "text-red-300 font-semibold" : "text-red-400/60"}`}>
          {redLabel}
        </span>
        <div className="h-1.5 flex-1 max-w-[140px] flex flex-row-reverse">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${redFavored ? "bg-red-500/80" : "bg-red-500/40"}`}
            style={{ width: `${redPct}%` }}
          />
        </div>
      </div>

      {/* Center label */}
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 px-2 whitespace-nowrap">
        {label}
      </span>

      {/* Blue side — bar grows from center toward the right edge */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-1.5 flex-1 max-w-[140px]">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${blueFavored ? "bg-blue-500/80" : "bg-blue-500/40"}`}
            style={{ width: `${bluePct}%` }}
          />
        </div>
        <span className={`font-mono text-xs tabular-nums ${blueFavored ? "text-blue-300 font-semibold" : "text-blue-400/60"}`}>
          {blueLabel}
        </span>
      </div>
    </div>
  );
}

function tacticalInsight(args: {
  redPred: number;
  bluePred: number;
  redAuto: number;
  blueAuto: number;
  redDc: number;
  blueDc: number;
  redPenalty: number;
  bluePenalty: number;
  /** Series score going into this match (for best-of-3 elims). */
  seriesScore?: { redWins: number; blueWins: number } | null;
  /** Most recent played match in the same series — used to comment on momentum. */
  priorMatch?: ParsedMatch | null;
}): string {
  const { redPred, bluePred, redAuto, blueAuto, redDc, blueDc, redPenalty, bluePenalty, seriesScore, priorMatch } = args;

  // Series-aware insights: trump generic ones when an elim is in progress.
  if (seriesScore && (seriesScore.redWins > 0 || seriesScore.blueWins > 0)) {
    const leader = seriesScore.redWins > seriesScore.blueWins ? "Red" :
      seriesScore.blueWins > seriesScore.redWins ? "Blue" : null;
    if (priorMatch && priorMatch.played && priorMatch.redScore != null && priorMatch.blueScore != null) {
      const margin = Math.abs(priorMatch.redScore - priorMatch.blueScore);
      const winner = priorMatch.redScore > priorMatch.blueScore ? "Red" :
        priorMatch.blueScore > priorMatch.redScore ? "Blue" : null;
      if (winner && margin >= 25) {
        const trailing = winner === "Red" ? "Blue" : "Red";
        return `${winner} won the prior match by ${margin} points — ${trailing} needs to adjust strategy.`;
      }
    }
    if (leader && (seriesScore.redWins === 1 && seriesScore.blueWins === 0 || seriesScore.blueWins === 1 && seriesScore.redWins === 0)) {
      const trailing = leader === "Red" ? "Blue" : "Red";
      return `${leader} leads the series — a ${trailing} win forces a decisive Match 3.`;
    }
    if (seriesScore.redWins === 1 && seriesScore.blueWins === 1) {
      return "Series is tied — winner of this match takes it all.";
    }
  }

  const predDiff = Math.abs(redPred - bluePred);
  const autoLeader = redAuto > blueAuto ? "Red" : blueAuto > redAuto ? "Blue" : null;
  const dcLeader = redDc > blueDc ? "Red" : blueDc > redDc ? "Blue" : null;
  const autoGap = Math.abs(redAuto - blueAuto);
  const dcGap = Math.abs(redDc - blueDc);

  if (autoLeader && dcLeader && autoLeader !== dcLeader && autoGap > 6 && dcGap > 8) {
    return `${autoLeader} dominates auto, ${dcLeader} stronger in driver-controlled — expect a close finish.`;
  }

  if (predDiff >= 40) {
    const favored = redPred > bluePred ? "Red" : "Blue";
    const underdog = favored === "Red" ? "Blue" : "Red";
    return `${favored} favored by ${Math.round(predDiff)}+ points — ${underdog} needs a standout performance.`;
  }

  const worstPenalty = Math.max(redPenalty, bluePenalty);
  if (worstPenalty >= 10) {
    const culprit = redPenalty > bluePenalty ? "Red" : "Blue";
    return `Watch for ${culprit} penalties — they average ${worstPenalty.toFixed(1)} pts/match in fouls.`;
  }

  if (predDiff < 12) {
    return "Tight matchup — consistency will decide this one.";
  }

  const favored = redPred > bluePred ? "Red" : "Blue";
  return `${favored} has a moderate edge on paper — execution will tell.`;
}

function BattleCard({
  m,
  oprMap,
  autoMap,
  dcMap,
  devMap,
  penaltyMap,
  teamNameMap,
  isPrescout,
  seriesScore,
  priorSeriesMatch,
}: {
  m: ParsedMatch;
  oprMap: Map<number, number>;
  autoMap: Map<number, number>;
  dcMap: Map<number, number>;
  devMap: Map<number, number>;
  penaltyMap: Map<number, number>;
  teamNameMap: Map<number, string>;
  isPrescout: boolean;
  /** Series score (red wins / blue wins) for best-of-3 elim series. null for quals/doubleElim. */
  seriesScore: { redWins: number; blueWins: number } | null;
  /** Most recent played match in the same series, used for series-aware insights. */
  priorSeriesMatch: ParsedMatch | null;
}) {
  // Per-alliance aggregates (totals across both teams).
  const sum = (map: Map<number, number>, teams: [number, number]) =>
    (map.get(teams[0]) ?? 0) + (map.get(teams[1]) ?? 0);

  const redAuto = sum(autoMap, m.red);
  const blueAuto = sum(autoMap, m.blue);
  const redDc = sum(dcMap, m.red);
  const blueDc = sum(dcMap, m.blue);
  const redDev = sum(devMap, m.red);
  const blueDev = sum(devMap, m.blue);
  const redPenalty = sum(penaltyMap, m.red);
  const bluePenalty = sum(penaltyMap, m.blue);

  // Consistency: lower dev = better. Convert into a positive score for the bar
  // visualization. Floor at 1 to avoid divide-by-zero / huge ratios.
  const redConsistency = redDev > 0 ? 100 / Math.max(redDev, 1) : 0;
  const blueConsistency = blueDev > 0 ? 100 / Math.max(blueDev, 1) : 0;

  // Outcome state (only meaningful when played).
  const tied = m.played && m.redScore === m.blueScore;
  const redWon = m.played && (m.redScore ?? 0) > (m.blueScore ?? 0);
  const blueWon = m.played && (m.blueScore ?? 0) > (m.redScore ?? 0);
  const predRedWin = m.redPred > m.bluePred;
  const actualRedWin = (m.redScore ?? 0) > (m.blueScore ?? 0);
  const predictionCorrect =
    m.played && !tied && m.redPred !== m.bluePred ? predRedWin === actualRedWin : null;

  const isElim = m.phase !== "quals";
  const captainSeed = (captain: number | null) => captain ? `Alliance Captain ${captain}` : null;

  function AllianceColumn({ side }: { side: "red" | "blue" }) {
    const onField = side === "red" ? m.red : m.blue;
    const backup = side === "red" ? m.redBackup : m.blueBackup;
    const captain = side === "red" ? m.redCaptain : m.blueCaptain;
    const bg = side === "red" ? "bg-red-500/5 border-red-500/20" : "bg-blue-500/5 border-blue-500/20";
    const dot = side === "red" ? "bg-red-500" : "bg-blue-500";
    const baseLabel = side === "red" ? "Red Alliance" : "Blue Alliance";
    const labelColor = side === "red" ? "text-red-300" : "text-blue-300";
    const oprColor = side === "red" ? "text-red-300" : "text-blue-300";
    const oprSum = side === "red" ? m.redOpr : m.blueOpr;
    const score = side === "red" ? m.redScore : m.blueScore;
    const won = side === "red" ? redWon : blueWon;

    // Show all alliance teams in elim matches; on-field only in quals.
    const allTeams: { num: number; isBackup: boolean }[] = [
      ...onField.filter((n) => n > 0).map((n) => ({ num: n, isBackup: false })),
    ];
    if (isElim && backup !== null && backup > 0) {
      allTeams.push({ num: backup, isBackup: true });
    }

    return (
      <div className={`flex-1 rounded-xl border ${bg} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className={`text-[10px] font-medium uppercase tracking-wider ${labelColor}`}>
            {baseLabel}
          </span>
          {won && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Win
            </span>
          )}
        </div>
        <div className="space-y-1.5 mb-3">
          {allTeams.map(({ num: n, isBackup }) => (
            <div key={n} className="flex items-center gap-2">
              <Link
                href={`/report/${n}`}
                onClick={(e) => e.stopPropagation()}
                title={captain === n ? captainSeed(captain) ?? undefined : undefined}
                className={`font-mono text-base font-bold hover:underline ${
                  isBackup ? "text-zinc-500 italic" : oprColor
                }`}
              >
                {n || "—"}
                {captain === n && !isBackup && (
                  <span className="ml-1 text-[10px] font-medium text-zinc-500 align-middle">
                    (C)
                  </span>
                )}
              </Link>
              <span className={`text-xs truncate ${isBackup ? "text-zinc-600" : "text-zinc-500"}`}>
                {teamNameMap.get(n) || ""}
                {isBackup && " · backup"}
              </span>
            </div>
          ))}
        </div>
        {m.played && score !== null ? (
          <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-800/40">
            <span className={`font-mono text-2xl font-bold ${oprColor}`}>{score.toFixed(0)}</span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">actual</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-800/40">
            <span className={`font-mono text-2xl font-bold ${oprColor}`}>{oprSum.toFixed(1)}</span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">combined OPR</span>
          </div>
        )}
      </div>
    );
  }

  // Series header line — only meaningful for elim phases.
  let seriesTitle: string | null = null;
  let seriesScoreLabel: string | null = null;
  if (m.phase === "semis") {
    seriesTitle = `Semifinal ${m.series} — Match ${m.matchNum} of 3`;
  } else if (m.phase === "finals") {
    seriesTitle = `Finals — Match ${m.matchNum} of 3`;
  } else if (m.phase === "doubleElim") {
    seriesTitle = `Playoff Bracket — ${m.label}`;
  }
  if (seriesScore && (seriesScore.redWins > 0 || seriesScore.blueWins > 0)) {
    if (seriesScore.redWins === seriesScore.blueWins) {
      seriesScoreLabel = `Tied ${seriesScore.redWins}-${seriesScore.blueWins}`;
    } else if (seriesScore.redWins > seriesScore.blueWins) {
      seriesScoreLabel = `Red leads ${seriesScore.redWins}-${seriesScore.blueWins}`;
    } else {
      seriesScoreLabel = `Blue leads ${seriesScore.blueWins}-${seriesScore.redWins}`;
    }
  }

  return (
    <div className="space-y-4">
      {/* Series context (elims only) */}
      {seriesTitle && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{seriesTitle}</p>
          {seriesScoreLabel && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
              {seriesScoreLabel}
            </span>
          )}
        </div>
      )}

      {/* VS layout */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3 relative">
        <AllianceColumn side="red" />
        <div className="flex sm:flex-col items-center justify-center text-zinc-500 select-none">
          <span className="font-bold text-xs sm:text-sm tracking-[0.3em] text-zinc-600">VS</span>
        </div>
        <AllianceColumn side="blue" />
      </div>

      {/* Stat bars (skip in prescout when most maps are empty) */}
      {!isPrescout && (
        <div className="space-y-2.5 px-1">
          <BattleStatBar
            label="Auto OPR"
            redValue={redAuto}
            blueValue={blueAuto}
            redLabel={redAuto.toFixed(1)}
            blueLabel={blueAuto.toFixed(1)}
          />
          <BattleStatBar
            label="DC OPR"
            redValue={redDc}
            blueValue={blueDc}
            redLabel={redDc.toFixed(1)}
            blueLabel={blueDc.toFixed(1)}
          />
          <BattleStatBar
            label="Consistency"
            redValue={redConsistency}
            blueValue={blueConsistency}
            redLabel={redDev > 0 ? `±${redDev.toFixed(1)}` : "—"}
            blueLabel={blueDev > 0 ? `±${blueDev.toFixed(1)}` : "—"}
          />
          {(redPenalty > 0 || bluePenalty > 0) && (
            <BattleStatBar
              label="Penalties"
              redValue={redPenalty}
              blueValue={bluePenalty}
              redLabel={redPenalty.toFixed(1)}
              blueLabel={bluePenalty.toFixed(1)}
              invertWinner
            />
          )}
        </div>
      )}

      {/* Tactical insight — only meaningful for upcoming matches */}
      {!m.played && !isPrescout && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-400/70 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {tacticalInsight({
              redPred: m.redPred, bluePred: m.bluePred,
              redAuto, blueAuto, redDc, blueDc,
              redPenalty, bluePenalty,
              seriesScore, priorMatch: priorSeriesMatch,
            })}
          </p>
        </div>
      )}

      {/* Predicted vs Actual — only meaningful for completed matches */}
      {m.played && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Predicted</p>
              <p className="font-mono text-zinc-300">
                <span className="text-red-300">Red {m.redPred}</span>
                <span className="text-zinc-600 mx-1.5">–</span>
                <span className="text-blue-300">{m.bluePred} Blue</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Actual</p>
              <p className="font-mono text-zinc-300">
                <span className="text-red-300">Red {m.redScore?.toFixed(0) ?? "—"}</span>
                <span className="text-zinc-600 mx-1.5">–</span>
                <span className="text-blue-300">{m.blueScore?.toFixed(0) ?? "—"} Blue</span>
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800/60">
            {tied ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tie</span>
            ) : predictionCorrect === true ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                As Expected
              </span>
            ) : predictionCorrect === false ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upset!
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Win/Loss tracker ──

interface MyMatchOutcome {
  matchId: number;
  matchNum: number;
  outcome: "win" | "loss" | "tie" | "upcoming";
  predictionCorrect: boolean | null;
  myAlliance: "red" | "blue";
  myScore: number | null;
  oppScore: number | null;
}

function buildMyMatchHistory(
  matches: ParsedMatch[],
  myTeam: number | null
): MyMatchOutcome[] {
  if (!myTeam) return [];
  return matches
    // Qualification matches only — the running record tracker visualizes
    // qual performance. Elim performance is shown in the progression timeline.
    .filter((m) => m.phase === "quals" && (m.red.includes(myTeam) || m.blue.includes(myTeam)))
    .map((m) => {
      const myAlliance: "red" | "blue" = m.red.includes(myTeam) ? "red" : "blue";
      if (!m.played || m.redScore == null || m.blueScore == null) {
        return {
          matchId: m.id,
          matchNum: m.matchNum,
          outcome: "upcoming" as const,
          predictionCorrect: null,
          myAlliance,
          myScore: null,
          oppScore: null,
        };
      }
      const myScore = myAlliance === "red" ? m.redScore : m.blueScore;
      const oppScore = myAlliance === "red" ? m.blueScore : m.redScore;
      const outcome: "win" | "loss" | "tie" =
        myScore > oppScore ? "win" : myScore < oppScore ? "loss" : "tie";
      const predictedRedWin = m.redPred > m.bluePred;
      const actualRedWin = m.redScore > m.blueScore;
      const predictionCorrect =
        m.redPred === m.bluePred
          ? null
          : m.redScore === m.blueScore
            ? null
            : predictedRedWin === actualRedWin;
      return {
        matchId: m.id,
        matchNum: m.matchNum,
        outcome,
        predictionCorrect,
        myAlliance,
        myScore,
        oppScore,
      };
    });
}

function RecordTracker({
  history,
  isPrescout,
}: {
  history: MyMatchOutcome[];
  isPrescout: boolean;
}) {
  const played = history.filter((h) => h.outcome !== "upcoming");
  if (history.length === 0) return null;

  const w = played.filter((h) => h.outcome === "win").length;
  const l = played.filter((h) => h.outcome === "loss").length;
  const t = played.filter((h) => h.outcome === "tie").length;
  const accChecked = played.filter((h) => h.predictionCorrect !== null);
  const accCorrect = accChecked.filter((h) => h.predictionCorrect === true).length;
  const accuracyPct = accChecked.length > 0
    ? Math.round((accCorrect / accChecked.length) * 100)
    : null;

  return (
    <div className="flex flex-col gap-2">
      {played.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {played.map((h) => {
            const base = "w-3 h-3 rounded-full shrink-0";
            let color = "bg-zinc-500";
            if (h.outcome === "win") color = "bg-emerald-500/80";
            else if (h.outcome === "loss") color = "bg-red-500/80";
            return (
              <span
                key={h.matchId}
                className={`${base} ${color}`}
                title={`Q${h.matchNum} — ${h.outcome.toUpperCase()} ${h.myScore}–${h.oppScore}`}
              />
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-zinc-300 font-mono font-semibold">
          {w}-{l}-{t}{" "}
          <span className="text-zinc-500 font-sans font-normal">
            after {played.length} match{played.length === 1 ? "" : "es"}
          </span>
        </span>
        {accuracyPct !== null && !isPrescout && (
          <span className="text-zinc-500">
            Prediction accuracy:{" "}
            <span className="text-zinc-300 font-mono">
              {accCorrect}/{accChecked.length}
            </span>{" "}
            <span className="text-zinc-400">({accuracyPct}%)</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Tournament progression timeline ─────────────────────────────────────────
// Compact horizontal sequence showing a team's path through the event:
// Quals → Alliance → Elim phases. Each step shows record + a result chip.

function ProgressionTimeline({
  qualRecord,
  qualRank,
  allianceSeed,
  phaseEntries,
}: {
  qualRecord: { w: number; l: number; t: number };
  qualRank: number | null;
  allianceSeed: number | null;
  phaseEntries: { phase: MatchPhase; record: { w: number; l: number; t: number }; matchCount: number }[];
}) {
  const PHASE_SHORT: Record<MatchPhase, string> = {
    quals: "Quals",
    semis: "Semis",
    finals: "Finals",
    doubleElim: "Playoffs",
  };

  function chipColor(record: { w: number; l: number; t: number }) {
    if (record.w === 0 && record.l === 0) return "bg-zinc-800 text-zinc-500 border-zinc-700";
    if (record.w > record.l) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (record.w < record.l) return "bg-red-500/15 text-red-300 border-red-500/30";
    return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Quals chip */}
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${chipColor(qualRecord)}`}>
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Quals</span>
        <span className="font-mono">{qualRecord.w}-{qualRecord.l}-{qualRecord.t}</span>
        {qualRank !== null && qualRank > 0 && (
          <span className="text-[10px] text-zinc-400">#{qualRank}</span>
        )}
      </span>

      {/* Alliance chip */}
      {allianceSeed !== null && (
        <>
          <span className="text-zinc-600 text-xs">→</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30">
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">Alliance</span>
            <span className="font-mono">#{allianceSeed}</span>
          </span>
        </>
      )}

      {/* Elim phase chips */}
      {phaseEntries.map((entry) => (
        <span key={entry.phase} className="inline-flex items-center gap-1.5">
          <span className="text-zinc-600 text-xs">→</span>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${chipColor(entry.record)}`}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{PHASE_SHORT[entry.phase]}</span>
            <span className="font-mono">{entry.record.w}-{entry.record.l}{entry.record.t > 0 ? `-${entry.record.t}` : ""}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

// ── Main page ──

export default function SchedulePage() {
  const {
    event,
    teams,
    loading,
    isPrescout,
    prescoutRanking,
    prescoutLoading,
    prescoutData,
  } = useEvent();
  const { profile, user } = useAuth();
  const ws = useWorkspaceOptional();

  // My team state
  const [myTeam, setMyTeam] = useState<number | null>(null);
  const [myTeamInput, setMyTeamInput] = useState<string>("");
  const myTeamHydratedRef = useRef(false);

  useEffect(() => {
    if (myTeamHydratedRef.current) return;
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(MY_TEAM_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n > 0) {
        setMyTeam(n);
        setMyTeamInput(String(n));
        myTeamHydratedRef.current = true;
        return;
      }
    }
    if (profile?.team_number) {
      setMyTeam(profile.team_number);
      setMyTeamInput(String(profile.team_number));
      myTeamHydratedRef.current = true;
    }
  }, [profile?.team_number]);

  function selectMyTeam(num: number) {
    setMyTeam(num);
    setMyTeamInput(String(num));
    if (typeof window !== "undefined") localStorage.setItem(MY_TEAM_KEY, String(num));
  }

  function clearMyTeam() {
    setMyTeam(null);
    setMyTeamInput("");
    if (typeof window !== "undefined") localStorage.removeItem(MY_TEAM_KEY);
  }

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterDefaulted, setFilterDefaulted] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);

  // Match assignments (workspace feature)
  const [assignments, setAssignments] = useState<MatchAssignment[]>([]);

  useEffect(() => {
    if (!ws?.workspace || !event) { setAssignments([]); return; }
    loadMatchAssignments(ws.workspace.id, event.code).then(setAssignments);
  }, [ws?.workspace, event]);

  useEffect(() => {
    if (!ws?.workspace || !event) return;
    const ch = supabase
      .channel(`ws-match-assign:${ws.workspace.id}:${event.code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_match_assignments",
          filter: `workspace_id=eq.${ws.workspace.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { event_code?: string } | undefined;
          if (row?.event_code && row.event_code !== event.code) return;
          loadMatchAssignments(ws.workspace!.id, event.code).then(setAssignments);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ws?.workspace, event]);

  const assignmentsByMatch = useMemo(
    () => new Map(assignments.map((a) => [a.match_id, a])),
    [assignments]
  );

  // Default to "mine" once we have a team and matches
  useEffect(() => {
    if (filterDefaulted) return;
    if (myTeam && event?.matches?.length) {
      setStatusFilter("mine");
      setFilterDefaulted(true);
    }
  }, [myTeam, event, filterDefaulted]);

  // If myTeam clears while on "mine", switch to "all"
  useEffect(() => {
    if (!myTeam && statusFilter === "mine") setStatusFilter("all");
  }, [myTeam, statusFilter]);

  // Searchable team list for the My Team picker
  const searchableTeams = useMemo<TeamSearchOption[]>(() => {
    if (!event) return [];
    return event.teams
      .map((tep) => ({
        teamNumber: tep.teamNumber,
        teamName: tep.team?.name ?? "",
        rank: tep.stats?.rank,
      }))
      .sort((a, b) => a.teamNumber - b.teamNumber);
  }, [event]);

  // OPR + dev + name + auto/dc/penalty maps
  const { oprMap, devMap, teamNameMap, autoMap, dcMap, penaltyMap } = useMemo(() => {
    const opr = new Map<number, number>();
    const dev = new Map<number, number>();
    const name = new Map<number, string>();
    const auto = new Map<number, number>();
    const dc = new Map<number, number>();
    const penalty = new Map<number, number>();

    if (event) {
      for (const tep of event.teams) {
        if (tep.team?.name) name.set(tep.teamNumber, tep.team.name);
      }
    }

    if (isPrescout) {
      for (const t of prescoutRanking) opr.set(t.teamNumber, t.bestOpr);
      for (const t of prescoutData) {
        const best = t.events
          .filter((e) => e.stats !== null)
          .map((e) => e.stats?.dev?.totalPointsNp ?? 0)
          .reduce((max, v) => Math.max(max, v), 0);
        if (best > 0) dev.set(t.number, best);
        if (t.name) name.set(t.number, t.name);
        // Best season auto/dc OPR for prescout battle card
        const bestAuto = t.events
          .map((e) => e.stats?.opr?.autoPoints ?? 0)
          .reduce((m, v) => Math.max(m, v), 0);
        const bestDc = t.events
          .map((e) => e.stats?.opr?.dcPoints ?? 0)
          .reduce((m, v) => Math.max(m, v), 0);
        if (bestAuto > 0) auto.set(t.number, bestAuto);
        if (bestDc > 0) dc.set(t.number, bestDc);
      }
    } else {
      for (const t of teams) {
        opr.set(t.teamNumber, t.stats.opr.totalPointsNp);
        dev.set(t.teamNumber, t.stats.dev.totalPointsNp);
        name.set(t.teamNumber, t.teamName);
        auto.set(t.teamNumber, t.stats.opr.autoPoints);
        dc.set(t.teamNumber, t.stats.opr.dcPoints);
        penalty.set(t.teamNumber, t.stats.avg.penaltyPointsCommitted ?? 0);
      }
    }
    return { oprMap: opr, devMap: dev, teamNameMap: name, autoMap: auto, dcMap: dc, penaltyMap: penalty };
  }, [teams, event, isPrescout, prescoutRanking, prescoutData]);

  // Wildcard threshold (top 25% of dev)
  const wildcardThreshold = useMemo(() => {
    const devs = Array.from(devMap.values()).filter((d) => d > 0).sort((a, b) => b - a);
    if (devs.length === 0) return Infinity;
    const idx = Math.max(0, Math.floor(devs.length * 0.25) - 1);
    return devs[idx] ?? Infinity;
  }, [devMap]);

  // Parse matches
  const allMatches = useMemo<ParsedMatch[]>(() => {
    if (!event?.matches) return [];

    function parseSide(teams: Match["teams"], side: "Red" | "Blue") {
      const filtered = teams.filter((t) => t.alliance === side);
      // Sort by station so One < Two < NotOnField. Captures captains in alliance roles.
      const sorted = [...filtered].sort((a, b) => stationOrder(a.station) - stationOrder(b.station));
      const onField = sorted.filter((t) => stationOrder(t.station) < 50);
      const backup = sorted.find((t) => stationOrder(t.station) >= 50);
      const captain = sorted.find((t) => t.allianceRole === "Captain") ?? null;
      return {
        on: [onField[0]?.teamNumber ?? 0, onField[1]?.teamNumber ?? 0] as [number, number],
        backup: backup?.teamNumber ?? null,
        captain: captain?.teamNumber ?? null,
      };
    }

    const parsed: ParsedMatch[] = event.matches.map((m) => {
      const phase = detectPhase(m.tournamentLevel, m.description ?? "");
      const matchNum = m.matchNum ?? m.id;
      const series = m.series ?? 0;
      const description = m.description ?? "";

      const red = parseSide(m.teams, "Red");
      const blue = parseSide(m.teams, "Blue");

      const redOpr = (oprMap.get(red.on[0]) ?? 0) + (oprMap.get(red.on[1]) ?? 0);
      const blueOpr = (oprMap.get(blue.on[0]) ?? 0) + (oprMap.get(blue.on[1]) ?? 0);

      return {
        id: m.id,
        matchNum,
        series,
        description,
        phase,
        label: buildMatchLabel(phase, matchNum, series, description),
        played: m.hasBeenPlayed,
        red: red.on,
        blue: blue.on,
        redBackup: red.backup,
        blueBackup: blue.backup,
        redCaptain: red.captain,
        blueCaptain: blue.captain,
        redScore: m.scores?.red.totalPointsNp ?? null,
        blueScore: m.scores?.blue.totalPointsNp ?? null,
        autoRed: m.scores?.red.autoPoints ?? null,
        autoBlue: m.scores?.blue.autoPoints ?? null,
        dcRed: m.scores?.red.dcPoints ?? null,
        dcBlue: m.scores?.blue.dcPoints ?? null,
        penaltyRed: m.scores?.red.penaltyPointsCommitted ?? null,
        penaltyBlue: m.scores?.blue.penaltyPointsCommitted ?? null,
        redOpr,
        blueOpr,
        redPred: Math.round(redOpr),
        bluePred: Math.round(blueOpr),
        redWinProb: winProb(redOpr - blueOpr),
      };
    });

    // Sort: phase first (quals → semis → finals → doubleElim), then by series,
    // then by matchNum so each section displays in chronological order.
    parsed.sort((a, b) => {
      const phaseDiff = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
      if (phaseDiff !== 0) return phaseDiff;
      if (a.series !== b.series) return a.series - b.series;
      if (a.matchNum !== b.matchNum) return a.matchNum - b.matchNum;
      return a.id - b.id;
    });

    return parsed;
  }, [event, oprMap]);

  // Series score map: for elim phases (semis/finals), look up how many wins
  // each alliance has in the current series so we can adjust win-prob and show
  // a series header. Keyed by `${phase}:${series}` for safety across phases.
  const seriesScoreMap = useMemo(() => {
    const map = new Map<string, { redWins: number; blueWins: number }>();
    for (const m of allMatches) {
      if (m.phase !== "semis" && m.phase !== "finals") continue;
      if (!m.played || m.redScore == null || m.blueScore == null) continue;
      if (m.redScore === m.blueScore) continue; // ties don't add to series wins
      const key = `${m.phase}:${m.series}`;
      const existing = map.get(key) ?? { redWins: 0, blueWins: 0 };
      if (m.redScore > m.blueScore) existing.redWins += 1;
      else existing.blueWins += 1;
      map.set(key, existing);
    }
    return map;
  }, [allMatches]);

  /** Returns series-aware context for a match: current series score (semis/finals
   *  only) and the most recent played match in the same series. */
  function getSeriesContext(m: ParsedMatch): {
    seriesScore: { redWins: number; blueWins: number } | null;
    priorMatch: ParsedMatch | null;
  } {
    if (m.phase !== "semis" && m.phase !== "finals") {
      return { seriesScore: null, priorMatch: null };
    }
    const seriesScore = seriesScoreMap.get(`${m.phase}:${m.series}`) ?? { redWins: 0, blueWins: 0 };
    const prior = allMatches
      .filter((x) => x.phase === m.phase && x.series === m.series && x.id !== m.id && x.played)
      .sort((a, b) => b.matchNum - a.matchNum)[0] ?? null;
    return { seriesScore, priorMatch: prior };
  }

  // Event-wide heatmap range: min/max combined alliance OPR across all matches.
  // Used to scale the saturation/opacity of the heatmap bar behind alliance cells.
  const heatmapRange = useMemo(() => {
    if (isPrescout || allMatches.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const m of allMatches) {
      if (m.redOpr > 0) { min = Math.min(min, m.redOpr); max = Math.max(max, m.redOpr); }
      if (m.blueOpr > 0) { min = Math.min(min, m.blueOpr); max = Math.max(max, m.blueOpr); }
    }
    if (!isFinite(min) || !isFinite(max) || max <= 0) return null;
    return { min, max };
  }, [allMatches, isPrescout]);

  // On Deck = first unplayed; In The Hole = second unplayed
  const { onDeckId, inTheHoleId } = useMemo(() => {
    let onDeck: number | null = null;
    let inTheHole: number | null = null;
    for (const m of allMatches) {
      if (!m.played) {
        if (onDeck === null) onDeck = m.id;
        else if (inTheHole === null) {
          inTheHole = m.id;
          break;
        }
      }
    }
    return { onDeckId: onDeck, inTheHoleId: inTheHole };
  }, [allMatches]);

  // My match history
  const myMatchHistory = useMemo(
    () => buildMyMatchHistory(allMatches, myTeam),
    [allMatches, myTeam]
  );

  // My team summary
  const myTeamSummary = useMemo(() => {
    if (!myTeam) return null;
    const teamNum: number = myTeam;

    // On-field involvement: matches where the team is one of the playing two.
    // (Backup-only inclusion is shown via progression record but excluded from
    //  the qualification W-L-T to avoid double-counting bench appearances.)
    const involvedOnField = allMatches.filter(
      (m) => m.red.includes(teamNum) || m.blue.includes(teamNum)
    );
    // All elim matches the team's alliance was rostered for, including backup.
    const elimRoster = allMatches.filter(
      (m) => m.phase !== "quals" && (
        m.red.includes(teamNum) || m.blue.includes(teamNum) ||
        m.redBackup === teamNum || m.blueBackup === teamNum
      )
    );

    // Per-phase records (counts only on-field appearances).
    function recordOf(matches: ParsedMatch[]) {
      let w = 0, l = 0, t = 0;
      for (const m of matches) {
        if (!m.played) continue;
        if (m.redScore === null || m.blueScore === null) continue;
        const isRed = m.red.includes(teamNum);
        const isBlue = m.blue.includes(teamNum);
        if (!isRed && !isBlue) continue;
        const mine = isRed ? m.redScore : m.blueScore;
        const opp = isRed ? m.blueScore : m.redScore;
        if (mine > opp) w++;
        else if (mine < opp) l++;
        else t++;
      }
      return { w, l, t };
    }

    const qualMatches = involvedOnField.filter((m) => m.phase === "quals");
    const semiMatches = involvedOnField.filter((m) => m.phase === "semis");
    const finalMatches = involvedOnField.filter((m) => m.phase === "finals");
    const deMatches = involvedOnField.filter((m) => m.phase === "doubleElim");
    const qualPlayed = qualMatches.filter((m) => m.played);
    const qualUpcoming = qualMatches.filter((m) => !m.played);

    const qualRecord = recordOf(qualMatches);
    const semiRecord = recordOf(semiMatches);
    const finalRecord = recordOf(finalMatches);
    const deRecord = recordOf(deMatches);

    // Pick next upcoming match across ALL phases (elims sort after quals so this
    // naturally surfaces playoff matches once quals end).
    const next = involvedOnField.find((m) => !m.played) ?? null;
    let nextInfo: {
      label: string;
      alliance: "red" | "blue";
      partner: number;
      opponents: [number, number];
      redPred: number;
      bluePred: number;
      myWinProb: number;
    } | null = null;
    if (next) {
      const isRed = next.red.includes(teamNum);
      const partner = (isRed ? next.red : next.blue).find((n) => n !== teamNum) ?? 0;
      const oppList = (isRed ? next.blue : next.red) as [number, number];
      nextInfo = {
        label: next.label,
        alliance: isRed ? "red" : "blue",
        partner,
        opponents: oppList,
        redPred: next.redPred,
        bluePred: next.bluePred,
        myWinProb: isRed ? next.redWinProb : 1 - next.redWinProb,
      };
    }

    // Identify the team's alliance captain (from any elim match).
    let captain: number | null = null;
    for (const m of elimRoster) {
      const onRed = m.red.includes(teamNum) || m.redBackup === teamNum;
      if (onRed && m.redCaptain) { captain = m.redCaptain; break; }
      const onBlue = m.blue.includes(teamNum) || m.blueBackup === teamNum;
      if (onBlue && m.blueCaptain) { captain = m.blueCaptain; break; }
    }
    // If the captain is found, their qualification rank is the alliance seed.
    const captainStats = captain
      ? event?.teams.find((tep) => tep.teamNumber === captain)?.stats
      : null;
    const allianceSeed = captainStats?.rank ?? null;

    // Qualification rank for THIS team (from event roster).
    const myQualStats = event?.teams.find((tep) => tep.teamNumber === teamNum)?.stats;
    const myQualRank = myQualStats?.rank ?? null;

    // Build progression entries: quals → alliance → each elim phase the team appeared in.
    type PhaseEntry = { phase: MatchPhase; record: { w: number; l: number; t: number }; matchCount: number };
    const phaseEntries: PhaseEntry[] = [];
    if (semiMatches.length > 0) phaseEntries.push({ phase: "semis", record: semiRecord, matchCount: semiMatches.length });
    if (finalMatches.length > 0) phaseEntries.push({ phase: "finals", record: finalRecord, matchCount: finalMatches.length });
    if (deMatches.length > 0) phaseEntries.push({ phase: "doubleElim", record: deRecord, matchCount: deMatches.length });

    const teamName =
      teamNameMap.get(teamNum) ||
      (event?.teams.find((tep) => tep.teamNumber === teamNum)?.team.name ?? "");

    return {
      teamName,
      played: qualPlayed.length,
      upcoming: qualUpcoming.length,
      involvedCount: involvedOnField.length + (elimRoster.length - elimRoster.filter((m) => m.red.includes(teamNum) || m.blue.includes(teamNum)).length),
      w: qualRecord.w, l: qualRecord.l, t: qualRecord.t,
      qualRank: myQualRank,
      nextInfo,
      isInEvent: involvedOnField.length > 0 || elimRoster.length > 0,
      // Progression timeline data
      captain,
      allianceSeed,
      phaseEntries,
      hasElims: phaseEntries.length > 0,
    };
  }, [myTeam, allMatches, teamNameMap, event]);

  // Filtered list
  const visible = useMemo(() => {
    if (statusFilter === "quals") return allMatches.filter((m) => m.phase === "quals");
    if (statusFilter === "elims") return allMatches.filter((m) => m.phase !== "quals");
    if (statusFilter === "mine" && myTeam) {
      return allMatches.filter(
        (m) =>
          m.red.includes(myTeam) ||
          m.blue.includes(myTeam) ||
          m.redBackup === myTeam ||
          m.blueBackup === myTeam
      );
    }
    return allMatches;
  }, [allMatches, statusFilter, myTeam]);

  /** Group visible matches by phase, then by series within elim phases.
   *  Used by the renderer to inject section headers and series headers. */
  const groupedView = useMemo(() => {
    const phases: { phase: MatchPhase; matches: ParsedMatch[] }[] = [];
    let current: { phase: MatchPhase; matches: ParsedMatch[] } | null = null;
    for (const m of visible) {
      if (!current || current.phase !== m.phase) {
        current = { phase: m.phase, matches: [] };
        phases.push(current);
      }
      current.matches.push(m);
    }
    return phases;
  }, [visible]);

  // Auto-scroll target: first unplayed match in the visible list (event On Deck if visible)
  const scrollTargetId = useMemo(() => {
    if (!visible.length) return null;
    if (onDeckId !== null && visible.some((m) => m.id === onDeckId)) return onDeckId;
    return visible.find((m) => !m.played)?.id ?? null;
  }, [visible, onDeckId]);

  const scrolledRef = useRef(false);
  const scrollTargetDesktopRef = useRef<HTMLTableRowElement | null>(null);
  const scrollTargetMobileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrolledRef.current) return;
    if (!scrollTargetId) return;
    const id = window.requestAnimationFrame(() => {
      const target = scrollTargetDesktopRef.current ?? scrollTargetMobileRef.current;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        scrolledRef.current = true;
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [scrollTargetId]);

  const isLoading = loading || (isPrescout && prescoutLoading);

  // ── Empty / loading ──

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

  const hasNoSchedule = !!event && (!event.matches || event.matches.length === 0);
  const allMatchesComplete =
    allMatches.length > 0 && allMatches.every((m) => m.played);

  // ── Render ──

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
            {/* My Team input */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <TeamSearch
                teams={searchableTeams}
                inputValue={myTeamInput}
                onInputChange={setMyTeamInput}
                onSelect={(t) => selectMyTeam(t.teamNumber)}
                onClear={clearMyTeam}
                placeholder="My team # or name…"
                className="w-full sm:w-72"
                showRank
                enterToSelect
              />

              {/* Status filter */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 gap-0.5 overflow-x-auto scrollbar-hide">
                {(["all", "quals", "elims", "mine"] as StatusFilter[]).map((f) => {
                  const hasElims = allMatches.some((m) => m.phase !== "quals");
                  const disabled =
                    (f === "mine" && !myTeam) ||
                    (f === "elims" && !hasElims);
                  const label =
                    f === "mine"
                      ? "My Matches"
                      : f === "all"
                        ? "All"
                        : f === "quals"
                          ? "Quals"
                          : "Elims";
                  return (
                    <button
                      key={f}
                      onClick={() => !disabled && setStatusFilter(f)}
                      disabled={disabled}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                        statusFilter === f
                          ? "bg-zinc-800 text-white shadow-sm"
                          : disabled
                            ? "text-zinc-700 cursor-not-allowed"
                            : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-zinc-600 sm:ml-auto">
                {visible.length} match{visible.length !== 1 ? "es" : ""}
                {allMatches.some((m) => m.played) && (
                  <span className="ml-1">
                    · {allMatches.filter((m) => m.played).length} played
                  </span>
                )}
              </p>
            </div>

            {/* My Team summary card */}
            {myTeam && myTeamSummary && (
              <div className="bg-zinc-900 border border-[var(--accent)]/30 rounded-xl px-5 py-4">
                {!myTeamSummary.isInEvent ? (
                  <p className="text-sm text-zinc-400">
                    Team{" "}
                    <span className="font-mono font-semibold text-white">
                      {myTeam}
                    </span>{" "}
                    is not in this event&apos;s match schedule.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
                      <p className="text-sm font-semibold text-white">
                        Team{" "}
                        <Link
                          href={`/report/${myTeam}`}
                          className="font-mono text-[var(--accent)] hover:underline"
                        >
                          {myTeam}
                        </Link>
                        {myTeamSummary.teamName && (
                          <span className="text-zinc-400 font-normal ml-1.5">
                            — {myTeamSummary.teamName}
                          </span>
                        )}
                      </p>
                      {isPrescout && allMatches.length > 0 && (
                        <span className="text-[10px] uppercase tracking-wider font-medium text-amber-400/80">
                          Prescout — all scores are predictions based on season OPR
                        </span>
                      )}
                    </div>

                    {allMatchesComplete ? (
                      <p className="text-sm text-zinc-300">
                        All matches complete. Final record:{" "}
                        <span className="font-mono font-semibold text-white">
                          {myTeamSummary.w}-{myTeamSummary.l}-{myTeamSummary.t}
                        </span>
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                            Record
                          </p>
                          <p className="font-mono text-base font-semibold text-white">
                            {myTeamSummary.w}-{myTeamSummary.l}-{myTeamSummary.t}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {myTeamSummary.played} played · {myTeamSummary.upcoming} remaining
                          </p>
                        </div>
                        {myTeamSummary.nextInfo && (
                          <>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                                Next match
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-white">
                                  {myTeamSummary.nextInfo.label}
                                </span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                    myTeamSummary.nextInfo.alliance === "red"
                                      ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                      : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                  }`}
                                >
                                  {myTeamSummary.nextInfo.alliance}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Partner{" "}
                                <Link
                                  href={`/report/${myTeamSummary.nextInfo.partner}`}
                                  className="font-mono text-zinc-300 hover:underline"
                                >
                                  {myTeamSummary.nextInfo.partner || "?"}
                                </Link>{" "}
                                vs{" "}
                                {myTeamSummary.nextInfo.opponents
                                  .filter(Boolean)
                                  .map((n, i, arr) => (
                                    <Fragment key={n}>
                                      <Link
                                        href={`/report/${n}`}
                                        className="font-mono text-zinc-300 hover:underline"
                                      >
                                        {n}
                                      </Link>
                                      {i < arr.length - 1 && " & "}
                                    </Fragment>
                                  ))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                                Predicted
                              </p>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-mono text-base font-semibold ${
                                    myTeamSummary.nextInfo.alliance === "red"
                                      ? "text-red-300"
                                      : "text-zinc-400"
                                  }`}
                                >
                                  {myTeamSummary.nextInfo.redPred}
                                </span>
                                <span className="text-zinc-700 text-xs">–</span>
                                <span
                                  className={`font-mono text-base font-semibold ${
                                    myTeamSummary.nextInfo.alliance === "blue"
                                      ? "text-blue-300"
                                      : "text-zinc-400"
                                  }`}
                                >
                                  {myTeamSummary.nextInfo.bluePred}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                <span
                                  className={
                                    myTeamSummary.nextInfo.myWinProb >= 0.5
                                      ? "text-emerald-400"
                                      : "text-amber-400"
                                  }
                                >
                                  {(myTeamSummary.nextInfo.myWinProb * 100).toFixed(0)}%
                                </span>{" "}
                                to win
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Tournament progression timeline (only when elims exist) */}
                    {myTeamSummary.hasElims && (
                      <div className="pt-3 border-t border-zinc-800/40">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                          Tournament progression
                        </p>
                        <ProgressionTimeline
                          qualRecord={{ w: myTeamSummary.w, l: myTeamSummary.l, t: myTeamSummary.t }}
                          qualRank={myTeamSummary.qualRank}
                          allianceSeed={myTeamSummary.allianceSeed}
                          phaseEntries={myTeamSummary.phaseEntries}
                        />
                      </div>
                    )}

                    {/* Win/Loss tracker (qualification matches) */}
                    {myMatchHistory.length > 0 && (
                      <div className="pt-3 border-t border-zinc-800/40">
                        <RecordTracker history={myMatchHistory} isPrescout={isPrescout} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* No schedule yet */}
            {hasNoSchedule && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 text-center text-sm text-zinc-500 px-6">
                Match schedule will be available once the event publishes its schedule.
              </div>
            )}

            {/* Match table */}
            {!hasNoSchedule && visible.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 text-center text-sm text-zinc-500">
                No matches to display
              </div>
            )}

            {!hasNoSchedule && visible.length > 0 && (
              <>
                {/* Desktop table */}
                <div data-tutorial="match-table" className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                          <th className="text-left px-4 py-3 w-24">Match</th>
                          <th className="text-center px-3 py-3 bg-red-500/10">Red Alliance</th>
                          <th className="text-center px-3 py-3 bg-blue-500/10">Blue Alliance</th>
                          <th className="text-right px-4 py-3 w-44">Score / Prediction</th>
                          <th className="text-right px-4 py-3 w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedView.flatMap((group) => {
                          // One section header per phase, then the matches.
                          const phaseHeader = groupedView.length > 1 || group.phase !== "quals" ? (
                            <tr key={`hdr-${group.phase}`} className="bg-zinc-800/80">
                              <td colSpan={5} className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                                    {PHASE_LABEL[group.phase]}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">
                                    {group.matches.length} match{group.matches.length === 1 ? "" : "es"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ) : null;
                          return [phaseHeader, ...group.matches.map((m) => {
                          const isOnDeck = m.id === onDeckId;
                          const isInTheHole = m.id === inTheHoleId;
                          const isExpanded = expandedMatch === m.id;
                          const myInMatch = !!(
                            myTeam &&
                            (m.red.includes(myTeam) || m.blue.includes(myTeam) || m.redBackup === myTeam || m.blueBackup === myTeam)
                          );
                          const dimmed = !!myTeam && !myInMatch;
                          const redBrighter = m.redOpr >= m.blueOpr;
                          const blueBrighter = m.blueOpr >= m.redOpr;
                          const predRedWin = m.redPred > m.bluePred;
                          const actualRedWin = (m.redScore ?? 0) > (m.blueScore ?? 0);
                          const predictionCorrect =
                            m.played && m.redScore !== m.blueScore && m.redPred !== m.bluePred
                              ? predRedWin === actualRedWin
                              : false;

                          let rowAccent = "";
                          if (isOnDeck) {
                            rowAccent = "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]";
                          } else if (isInTheHole) {
                            rowAccent = "bg-zinc-800/30 border-l-2 border-l-zinc-600";
                          } else if (myInMatch) {
                            rowAccent = "border-l-2 border-l-[var(--accent)]/60";
                          }

                          return (
                            <Fragment key={m.id}>
                              <tr
                                ref={m.id === scrollTargetId ? scrollTargetDesktopRef : undefined}
                                onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                                className={`border-b border-zinc-800/50 last:border-0 cursor-pointer hover:bg-zinc-800/40 transition-colors ${rowAccent} ${
                                  dimmed ? "opacity-60" : ""
                                } ${isOnDeck ? "h-16" : ""}`}
                              >
                                <td className="px-4 py-3">
                                  <span
                                    className={`font-mono text-sm font-semibold tabular-nums ${
                                      dimmed ? "text-zinc-600" : "text-zinc-200"
                                    }`}
                                  >
                                    {m.label}
                                  </span>
                                </td>
                                <td className="relative px-3 py-3 bg-red-500/10">
                                  <AllianceCell
                                    teams={m.red}
                                    backup={m.redBackup}
                                    side="red"
                                    oprSum={m.redOpr}
                                    brighter={redBrighter}
                                    myTeam={myTeam}
                                    isPrescout={isPrescout}
                                    heatmapRange={heatmapRange}
                                    played={m.played}
                                    outcome={
                                      m.played
                                        ? (m.redScore ?? 0) > (m.blueScore ?? 0)
                                          ? "win"
                                          : (m.redScore ?? 0) < (m.blueScore ?? 0)
                                            ? "loss"
                                            : "tie"
                                        : "tie"
                                    }
                                  />
                                </td>
                                <td className="relative px-3 py-3 bg-blue-500/10">
                                  <AllianceCell
                                    teams={m.blue}
                                    backup={m.blueBackup}
                                    side="blue"
                                    oprSum={m.blueOpr}
                                    brighter={blueBrighter}
                                    myTeam={myTeam}
                                    isPrescout={isPrescout}
                                    heatmapRange={heatmapRange}
                                    played={m.played}
                                    outcome={
                                      m.played
                                        ? (m.blueScore ?? 0) > (m.redScore ?? 0)
                                          ? "win"
                                          : (m.blueScore ?? 0) < (m.redScore ?? 0)
                                            ? "loss"
                                            : "tie"
                                        : "tie"
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <ScoreDisplay
                                    m={m}
                                    myTeam={myTeam}
                                    redWinProbOverride={(() => {
                                      if (m.played) return null;
                                      if (m.phase !== "semis" && m.phase !== "finals") return null;
                                      const ss = seriesScoreMap.get(`${m.phase}:${m.series}`) ?? { redWins: 0, blueWins: 0 };
                                      return seriesWinProb(ss.redWins, ss.blueWins, m.redWinProb);
                                    })()}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex flex-col items-end gap-0.5">
                                    <StatusBadge
                                      played={m.played}
                                      isOnDeck={isOnDeck}
                                      isInTheHole={isInTheHole}
                                      pulse={(isOnDeck || isInTheHole) && myInMatch}
                                    />
                                    {m.played && m.redPred !== m.bluePred && m.redScore !== m.blueScore && (
                                      <span
                                        className={`text-[10px] font-mono ${
                                          predictionCorrect ? "text-emerald-500/70" : "text-amber-500/70"
                                        }`}
                                        title={predictionCorrect ? "Prediction correct" : "Upset"}
                                      >
                                        {predictionCorrect ? "✓" : "✗"}
                                      </span>
                                    )}
                                    {ws?.workspace && (() => {
                                      const a = assignmentsByMatch.get(String(m.id));
                                      if (!a) return null;
                                      return (
                                        <span className={`text-[10px] tabular-nums mt-0.5 ${a.status === "completed" ? "text-emerald-500/80" : "text-[var(--accent)]/80"}`}>
                                          {a.status === "completed" ? "✓ Scouted" : `👁 ${a.assignedToName ?? "Assigned"}`}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (() => {
                                const ctx = getSeriesContext(m);
                                const assignment = assignmentsByMatch.get(String(m.id));
                                return (
                                  <tr className="bg-zinc-800/20 border-b border-zinc-800/50">
                                    <td colSpan={5} className="px-5 py-4">
                                      <BattleCard
                                        m={m}
                                        oprMap={oprMap}
                                        autoMap={autoMap}
                                        dcMap={dcMap}
                                        devMap={devMap}
                                        penaltyMap={penaltyMap}
                                        teamNameMap={teamNameMap}
                                        isPrescout={isPrescout}
                                        seriesScore={ctx.seriesScore}
                                        priorSeriesMatch={ctx.priorMatch}
                                      />
                                      {ws?.workspace && (
                                        <MatchScoutingSection
                                          matchId={String(m.id)}
                                          matchLabel={m.label}
                                          workspaceId={ws.workspace.id}
                                          eventCode={event!.code}
                                          assignment={assignment ?? null}
                                          members={ws.members}
                                          role={ws.role}
                                          userId={user?.id ?? null}
                                          played={m.played}
                                          onChanged={() =>
                                            loadMatchAssignments(ws.workspace!.id, event!.code).then(setAssignments)
                                          }
                                        />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })()}
                            </Fragment>
                          );
                        })];
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile card list */}
                <div data-tutorial="match-table" className="sm:hidden space-y-2">
                  {groupedView.flatMap((group) => {
                    const phaseHeader = groupedView.length > 1 || group.phase !== "quals" ? (
                      <div
                        key={`hdr-${group.phase}`}
                        className="bg-zinc-800/80 border border-zinc-800 rounded-lg px-3 py-2 mt-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {PHASE_LABEL[group.phase]}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {group.matches.length} match{group.matches.length === 1 ? "" : "es"}
                          </span>
                        </div>
                      </div>
                    ) : null;
                    return [phaseHeader, ...group.matches.map((m) => {
                    const isOnDeck = m.id === onDeckId;
                    const isInTheHole = m.id === inTheHoleId;
                    const isExpanded = expandedMatch === m.id;
                    const myInMatch = !!(
                      myTeam &&
                      (m.red.includes(myTeam) || m.blue.includes(myTeam) || m.redBackup === myTeam || m.blueBackup === myTeam)
                    );
                    const dimmed = !!myTeam && !myInMatch;
                    const redBrighter = m.redOpr >= m.blueOpr;
                    const blueBrighter = m.blueOpr >= m.redOpr;
                    const predRedWin = m.redPred > m.bluePred;
                    const actualRedWin = (m.redScore ?? 0) > (m.blueScore ?? 0);
                    const predictionCorrect =
                      m.played && m.redScore !== m.blueScore && m.redPred !== m.bluePred
                        ? predRedWin === actualRedWin
                        : false;

                    let cardClasses =
                      "bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-800/40";
                    if (isOnDeck) {
                      cardClasses =
                        "bg-zinc-900 border-2 border-[var(--accent)]/60 rounded-xl px-4 py-4 cursor-pointer";
                    } else if (isInTheHole) {
                      cardClasses =
                        "bg-zinc-900 border border-zinc-600 rounded-xl px-4 py-3 cursor-pointer";
                    } else if (myInMatch) {
                      cardClasses =
                        "bg-zinc-900 border border-zinc-800 border-l-2 border-l-[var(--accent)]/60 rounded-xl px-4 py-3 cursor-pointer hover:bg-zinc-800/40";
                    } else if (dimmed) {
                      cardClasses += " opacity-60";
                    }

                    return (
                      <Fragment key={m.id}>
                        <div
                          ref={m.id === scrollTargetId ? scrollTargetMobileRef : undefined}
                          onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                          className={cardClasses}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-zinc-200 tabular-nums">
                                {m.label}
                              </span>
                              <StatusBadge
                                played={m.played}
                                isOnDeck={isOnDeck}
                                isInTheHole={isInTheHole}
                                pulse={(isOnDeck || isInTheHole) && myInMatch}
                              />
                              {m.played && m.redPred !== m.bluePred && m.redScore !== m.blueScore && (
                                <span
                                  className={`text-[10px] font-mono ${
                                    predictionCorrect ? "text-emerald-500/70" : "text-amber-500/70"
                                  }`}
                                >
                                  {predictionCorrect ? "✓" : "✗"}
                                </span>
                              )}
                              {ws?.workspace && (() => {
                                const a = assignmentsByMatch.get(String(m.id));
                                if (!a) return null;
                                return (
                                  <span className={`text-[10px] ${a.status === "completed" ? "text-emerald-500/80" : "text-[var(--accent)]/80"}`}>
                                    {a.status === "completed" ? "✓ Scouted" : `👁 ${a.assignedToName ?? "Assigned"}`}
                                  </span>
                                );
                              })()}
                            </div>
                            <ScoreDisplay m={m} myTeam={myTeam} />
                          </div>

                          {/* Alliances */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 bg-red-500/10 rounded-lg px-2.5 py-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                              <span className="text-xs text-zinc-500 w-10 shrink-0">Red</span>
                              <div className="flex gap-3 flex-1 flex-wrap">
                                <TeamLink num={m.red[0]} highlight={myTeam === m.red[0]} />
                                <TeamLink num={m.red[1]} highlight={myTeam === m.red[1]} />
                                {m.redBackup !== null && m.redBackup > 0 && (
                                  <span
                                    className={`font-mono text-xs tabular-nums ${myTeam === m.redBackup ? "font-bold text-[var(--accent)]" : "text-zinc-500 italic"}`}
                                    title="Backup"
                                  >
                                    +{m.redBackup}
                                  </span>
                                )}
                              </div>
                              {!isPrescout && m.redOpr > 0 && (
                                <span
                                  className={`text-[10px] font-mono tabular-nums ${
                                    redBrighter ? "text-red-300" : "text-red-400/50"
                                  }`}
                                >
                                  {m.redOpr.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 bg-blue-500/10 rounded-lg px-2.5 py-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              <span className="text-xs text-zinc-500 w-10 shrink-0">Blue</span>
                              <div className="flex gap-3 flex-1 flex-wrap">
                                <TeamLink num={m.blue[0]} highlight={myTeam === m.blue[0]} />
                                <TeamLink num={m.blue[1]} highlight={myTeam === m.blue[1]} />
                                {m.blueBackup !== null && m.blueBackup > 0 && (
                                  <span
                                    className={`font-mono text-xs tabular-nums ${myTeam === m.blueBackup ? "font-bold text-[var(--accent)]" : "text-zinc-500 italic"}`}
                                    title="Backup"
                                  >
                                    +{m.blueBackup}
                                  </span>
                                )}
                              </div>
                              {!isPrescout && m.blueOpr > 0 && (
                                <span
                                  className={`text-[10px] font-mono tabular-nums ${
                                    blueBrighter ? "text-blue-300" : "text-blue-400/50"
                                  }`}
                                >
                                  {m.blueOpr.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (() => {
                          const ctx = getSeriesContext(m);
                          const assignment = assignmentsByMatch.get(String(m.id));
                          return (
                            <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl px-4 py-4">
                              <BattleCard
                                m={m}
                                oprMap={oprMap}
                                autoMap={autoMap}
                                dcMap={dcMap}
                                devMap={devMap}
                                penaltyMap={penaltyMap}
                                teamNameMap={teamNameMap}
                                isPrescout={isPrescout}
                                seriesScore={ctx.seriesScore}
                                priorSeriesMatch={ctx.priorMatch}
                              />
                              {ws?.workspace && (
                                <MatchScoutingSection
                                  matchId={String(m.id)}
                                  matchLabel={m.label}
                                  workspaceId={ws.workspace.id}
                                  eventCode={event!.code}
                                  assignment={assignment ?? null}
                                  members={ws.members}
                                  role={ws.role}
                                  userId={user?.id ?? null}
                                  played={m.played}
                                  onChanged={() =>
                                    loadMatchAssignments(ws.workspace!.id, event!.code).then(setAssignments)
                                  }
                                />
                              )}
                            </div>
                          );
                        })()}
                      </Fragment>
                    );
                  })];
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

// ── Match scouting section (shown in expanded match panel) ─────────────────

import type { WorkspaceMember, WorkspaceRole } from "@/lib/workspace";

function MatchScoutingSection({
  matchId,
  matchLabel,
  workspaceId,
  eventCode,
  assignment,
  members,
  role,
  userId,
  played,
  onChanged,
}: {
  matchId: string;
  matchLabel: string;
  workspaceId: string;
  eventCode: string;
  assignment: MatchAssignment | null;
  members: WorkspaceMember[];
  role: WorkspaceRole | null;
  userId: string | null;
  played: boolean;
  onChanged: () => void;
}) {
  const canEdit = role === "admin" || role === "editor";
  const isAssignedToMe = !!userId && assignment?.assigned_to === userId;

  const [assigning, setAssigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState(assignment?.report ?? "");
  const [confidence, setConfidence] = useState<MatchAssignmentConfidence | "">(
    assignment?.confidence ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    await upsertMatchAssignment({
      workspaceId,
      eventCode,
      matchId,
      assignedTo: selectedUserId,
      status: "assigned",
    });
    setSaving(false);
    setAssigning(false);
    setSelectedUserId("");
    onChanged();
  };

  const handleUnassign = async () => {
    if (!assignment) return;
    setSaving(true);
    await deleteMatchAssignment(assignment.id);
    setSaving(false);
    onChanged();
  };

  const handleSubmitReport = async () => {
    if (!assignment || !reportText.trim()) return;
    setSubmitting(true);
    setReportError(null);
    const { error } = await upsertMatchAssignment({
      workspaceId,
      eventCode,
      matchId,
      assignedTo: assignment.assigned_to,
      status: "completed",
      report: reportText.trim(),
      confidence: confidence || null,
    });
    setSubmitting(false);
    if (error) { setReportError(error); return; }
    setShowReport(false);
    onChanged();
  };

  return (
    <div className="mt-4 pt-4 border-t border-zinc-700/50">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
        Scout Assignment · {matchLabel}
      </p>

      {!assignment && (
        canEdit ? (
          assigning ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Select member…</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name ?? m.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedUserId || saving}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] text-white disabled:opacity-50"
              >
                {saving ? "…" : "Assign"}
              </button>
              <button
                onClick={() => setAssigning(false)}
                className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAssigning(true)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Assign scout
            </button>
          )
        ) : (
          <p className="text-xs text-zinc-600">No scout assigned.</p>
        )
      )}

      {assignment && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  assignment.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30"
                }`}
              >
                {assignment.status === "completed" ? "✓ Report submitted" : "Assigned"}
              </span>
              <span className="text-xs text-zinc-400">
                {assignment.assignedToName ?? assignment.assigned_to.slice(0, 8)}
              </span>
            </div>
            {canEdit && (
              <button
                onClick={handleUnassign}
                disabled={saving}
                className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>

          {assignment.status === "completed" && assignment.report && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 space-y-1">
              {assignment.confidence && (
                <span
                  className={`text-[10px] font-medium uppercase tracking-wider ${
                    assignment.confidence === "high"
                      ? "text-emerald-400"
                      : assignment.confidence === "medium"
                        ? "text-amber-400"
                        : "text-red-400"
                  }`}
                >
                  {assignment.confidence} confidence
                </span>
              )}
              <p className="text-xs text-zinc-300 whitespace-pre-wrap">{assignment.report}</p>
            </div>
          )}

          {assignment.status === "assigned" && played && (isAssignedToMe || canEdit) && (
            !showReport ? (
              <button
                onClick={() => setShowReport(true)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 transition-colors"
              >
                Submit report
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(["high", "medium", "low"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setConfidence(confidence === c ? "" : c)}
                      className={`px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider border transition-colors ${
                        confidence === c
                          ? c === "high"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : c === "medium"
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                              : "bg-red-500/20 text-red-400 border-red-500/40"
                          : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Observations from this match…"
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
                {reportError && <p className="text-xs text-red-400">{reportError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmitReport}
                    disabled={submitting || !reportText.trim()}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent)] text-white disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                  <button
                    onClick={() => setShowReport(false)}
                    className="px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
