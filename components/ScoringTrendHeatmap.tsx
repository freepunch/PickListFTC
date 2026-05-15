"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { picklistKey } from "@/lib/storage";
import type { Match, ProcessedTeam } from "@/lib/types";

// ── Color scale: zinc-800 → blue-600 → green-400 → yellow-400 ──

type RGB = [number, number, number];
const STOPS: [RGB, number][] = [
  [[39, 39, 42], 0],
  [[37, 99, 235], 0.33],
  [[74, 222, 128], 0.66],
  [[250, 204, 21], 1.0],
];

function scoreToColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  let lo: RGB = STOPS[0][0];
  let hi: RGB = STOPS[STOPS.length - 1][0];
  let local = 1;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [ca, ta] = STOPS[i];
    const [cb, tb] = STOPS[i + 1];
    if (t >= ta && t <= tb) {
      lo = ca;
      hi = cb;
      local = tb === ta ? 0 : (t - ta) / (tb - ta);
      break;
    }
  }
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * local);
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * local);
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * local);
  return `rgb(${r},${g},${b})`;
}

function shortLabel(m: Match): string {
  const d = m.description?.trim();
  if (d && d !== "?" && d.length <= 7) return d;
  const n = m.matchNum ?? m.id;
  if (!m.tournamentLevel || m.tournamentLevel === "Quals") return `Q${n}`;
  if (m.tournamentLevel === "Semis") return `S${m.series ?? ""}${n}`;
  if (m.tournamentLevel === "Finals") return `F${n}`;
  return `#${n}`;
}

// ── Layout constants ──

const LABEL_W = 78;
const HEADER_H = 42;
const CELL_W = 18;
const CELL_H = 14;
const GAP = 1;
const COL_W = CELL_W + GAP;
const ROW_H = CELL_H + GAP;

// ── Component ──

interface Props {
  matches: Match[];
  teams: ProcessedTeam[];
  eventCode: string;
  myTeam?: number | null;
}

interface TooltipState {
  x: number;
  y: number;
  teamNumber: number;
  teamName: string;
  label: string;
  score: number;
}

export function ScoringTrendHeatmap({ matches, teams, eventCode, myTeam }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [picklistNums, setPicklistNums] = useState<Set<number>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(picklistKey(eventCode, user?.id ?? null));
      if (!raw) return;
      const data = JSON.parse(raw);
      setPicklistNums(
        new Set((data.entries ?? []).map((e: { teamNumber: number }) => e.teamNumber))
      );
    } catch {
      // ignore
    }
  }, [eventCode, user?.id]);

  const { playedMatches, sortedTeams, matrix, scoreMin, scoreMax } = useMemo(() => {
    const played = matches
      .filter((m) => m.hasBeenPlayed && m.scores?.red && m.scores?.blue)
      .sort((a, b) => a.id - b.id);

    const sorted = [...teams].sort(
      (a, b) => b.stats.opr.totalPointsNp - a.stats.opr.totalPointsNp
    );

    const teamIdxMap = new Map(sorted.map((t, i) => [t.teamNumber, i]));
    const mat: (number | null)[][] = sorted.map(() => Array(played.length).fill(null));

    let mn = Infinity;
    let mx = -Infinity;

    for (let mi = 0; mi < played.length; mi++) {
      const m = played[mi];
      const allianceScore: Record<string, number> = {
        Red: m.scores!.red.totalPointsNp,
        Blue: m.scores!.blue.totalPointsNp,
      };
      for (const mt of m.teams) {
        const ti = teamIdxMap.get(mt.teamNumber);
        if (ti === undefined) continue;
        const s = allianceScore[mt.alliance as string];
        if (s == null) continue;
        mat[ti][mi] = s;
        if (s < mn) mn = s;
        if (s > mx) mx = s;
      }
    }

    // Only keep teams that appeared in at least one match
    const active = sorted.filter((_, ti) => mat[ti].some((s) => s !== null));
    const activeIdxMap = new Map(sorted.map((t, i) => [t.teamNumber, i]));
    const activeMat = active.map((t) => mat[activeIdxMap.get(t.teamNumber)!]);

    return {
      playedMatches: played,
      sortedTeams: active,
      matrix: activeMat,
      scoreMin: isFinite(mn) ? mn : 0,
      scoreMax: isFinite(mx) ? mx : 0,
    };
  }, [matches, teams]);

  function cellBg(score: number | null): string {
    if (score === null) return "#18181b";
    const range = scoreMax - scoreMin;
    const t = range === 0 ? 0.5 : (score - scoreMin) / range;
    return scoreToColor(t);
  }

  function handleCellEnter(
    e: React.MouseEvent,
    ti: number,
    mi: number,
    m: Match,
    team: (typeof sortedTeams)[number]
  ) {
    setHoveredRow(ti);
    setHoveredCol(mi);
    const score = matrix[ti][mi];
    if (score != null) {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top,
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        label: shortLabel(m),
        score,
      });
    } else {
      setTooltip(null);
    }
  }

  return (
    <div
      className="relative select-none"
      onMouseLeave={() => {
        setHoveredRow(null);
        setHoveredCol(null);
        setTooltip(null);
      }}
    >
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-zinc-800 border border-zinc-700
            rounded-lg px-3 py-1.5 text-xs text-white shadow-xl whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <span className="font-mono font-bold text-[var(--accent)]">
            {tooltip.teamNumber}
          </span>{" "}
          <span className="text-zinc-400 text-[10px]">{tooltip.teamName}</span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span className="text-zinc-300">{tooltip.label}</span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span className="font-mono font-semibold">{tooltip.score} pts</span>
        </div>
      )}

      <div className="flex">
        {/* Team name column — lives outside the scroll container so it's always visible */}
        <div className="shrink-0 z-10" style={{ width: LABEL_W }}>
          {/* Corner spacer aligns with the match header row */}
          <div style={{ height: HEADER_H }} />
          {sortedTeams.map((team, ti) => {
            const isMe = myTeam === team.teamNumber;
            const isHov = hoveredRow === ti;
            return (
              <div
                key={team.teamNumber}
                style={{ height: ROW_H }}
                className={`flex items-center gap-1 pr-2 cursor-pointer transition-colors duration-75
                  ${isHov ? "text-white" : isMe ? "text-[var(--accent)]" : "text-zinc-500"}`}
                onMouseEnter={() => {
                  setHoveredRow(ti);
                  setTooltip(null);
                }}
                onClick={() => router.push(`/report/${team.teamNumber}`)}
              >
                {isMe && (
                  <div className="w-0.5 h-2.5 rounded-full bg-[var(--accent)] shrink-0" />
                )}
                <span className="font-mono text-[10px] truncate leading-none">
                  {team.teamNumber}
                </span>
                {picklistNums.has(team.teamNumber) && (
                  <svg
                    className="w-2.5 h-2.5 fill-amber-400 shrink-0"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable heatmap grid */}
        <div className="overflow-x-auto flex-1 min-w-0">
          <div style={{ display: "inline-block" }}>
            {/* Match header */}
            <div className="flex" style={{ height: HEADER_H }}>
              {playedMatches.map((m, mi) => {
                const isHov = hoveredCol === mi;
                return (
                  <div
                    key={m.id}
                    style={{ width: COL_W, height: HEADER_H }}
                    className={`flex items-end justify-center pb-1 transition-colors duration-75
                      ${isHov ? "text-white" : "text-zinc-600"}`}
                    onMouseEnter={() => {
                      setHoveredCol(mi);
                      setHoveredRow(null);
                      setTooltip(null);
                    }}
                  >
                    <span
                      className="font-mono text-[9px] leading-none"
                      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                    >
                      {shortLabel(m)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Cell rows */}
            {sortedTeams.map((team, ti) => {
              const isMe = myTeam === team.teamNumber;
              const isHovRow = hoveredRow === ti;
              return (
                <div
                  key={team.teamNumber}
                  className="flex"
                  style={{ height: ROW_H, gap: GAP }}
                  onMouseEnter={() => setHoveredRow(ti)}
                >
                  {playedMatches.map((m, mi) => {
                    const score = matrix[ti][mi];
                    const isHovCol = hoveredCol === mi;
                    const isEmpty = score === null;
                    const lit = isHovRow || isHovCol;

                    let shadow = "none";
                    if (!isEmpty && isHovRow && isHovCol) {
                      shadow = "inset 0 0 0 1px rgba(255,255,255,0.5)";
                    } else if (!isEmpty && lit) {
                      shadow = "inset 0 0 0 1px rgba(255,255,255,0.2)";
                    } else if (!isEmpty && isMe) {
                      shadow = "inset 0 0 0 1px rgba(59,130,246,0.45)";
                    }

                    return (
                      <div
                        key={m.id}
                        style={{
                          width: CELL_W,
                          height: CELL_H,
                          flexShrink: 0,
                          background: cellBg(score),
                          opacity: isEmpty ? 0.06 : lit ? 1 : 0.85,
                          boxShadow: shadow,
                        }}
                        className="rounded-[1px] cursor-pointer transition-opacity duration-75"
                        onMouseEnter={(e) => handleCellEnter(e, ti, mi, m, team)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          if (!isEmpty) router.push(`/report/${team.teamNumber}`);
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className="mt-3.5 flex items-center gap-2 flex-wrap"
        style={{ paddingLeft: LABEL_W }}
      >
        <span className="text-[10px] text-zinc-600">Low</span>
        <div
          className="h-1.5 w-24 rounded-full shrink-0"
          style={{
            background:
              "linear-gradient(to right, rgb(39,39,42), rgb(37,99,235), rgb(74,222,128), rgb(250,204,21))",
          }}
        />
        <span className="text-[10px] text-zinc-600">High</span>
        <span className="text-[10px] font-mono text-zinc-600 ml-1">
          {scoreMin}–{scoreMax} pts
        </span>

        {myTeam != null && (
          <>
            <span className="text-[10px] text-zinc-700 mx-1">·</span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--accent)]">
              <div className="w-0.5 h-2.5 rounded-full bg-[var(--accent)]" />
              My team
            </span>
          </>
        )}

        {picklistNums.size > 0 && (
          <>
            <span className="text-[10px] text-zinc-700 mx-1">·</span>
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <svg className="w-2.5 h-2.5 fill-amber-400" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              Pick list
            </span>
          </>
        )}
      </div>
    </div>
  );
}
