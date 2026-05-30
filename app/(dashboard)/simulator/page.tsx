"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEvent } from "@/context/EventContext";
import { useWorkspaceOptional } from "@/context/WorkspaceContext";
import { TeamSearch, TeamSearchOption } from "@/components/TeamSearch";
import { loadWorkspacePickList } from "@/lib/workspace";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import type { ProcessedTeam } from "@/lib/types";

// ── Win probability ──────────────────────────────────────────────────────────
const WIN_K = 20 / Math.log(0.85 / 0.15);
function winProb(diff: number) { return 1 / (1 + Math.exp(-diff / WIN_K)); }

// ── Alliance palette ─────────────────────────────────────────────────────────
const PALETTE = [
  { color: "#60a5fa", fill: "rgba(96,165,250,0.15)", border: "border-blue-500/30",  bg: "bg-blue-500/5",  text: "text-blue-400",  label: "Alliance A" },
  { color: "#f87171", fill: "rgba(248,113,113,0.15)",border: "border-red-500/30",   bg: "bg-red-500/5",   text: "text-red-400",   label: "Alliance B" },
  { color: "#4ade80", fill: "rgba(74,222,128,0.15)", border: "border-green-500/30", bg: "bg-green-500/5", text: "text-green-400", label: "Alliance C" },
  { color: "#fbbf24", fill: "rgba(251,191,36,0.15)", border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-400", label: "Alliance D" },
];

// ── Types ────────────────────────────────────────────────────────────────────
interface SlotPick { teamNumber: number | null; input: string; }
interface SimAlliance {
  id: number;
  captain: SlotPick; pick1: SlotPick; pick2: SlotPick;
  showPick2: boolean;
}
type WhatIfMap = Record<number, number>;

interface ComputedStats {
  members: number[];
  baseTotal: number; baseAuto: number; baseDc: number; baseConsistency: number;
  adjTotal: number;  adjAuto: number;  adjDc: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function blank(): SlotPick { return { teamNumber: null, input: "" }; }
function blankAlliance(id: number): SimAlliance {
  return { id, captain: blank(), pick1: blank(), pick2: blank(), showPick2: false };
}

function computeStats(
  a: SimAlliance,
  teamMap: Map<number, ProcessedTeam>,
  whatIf: WhatIfMap
): ComputedStats {
  const slots: (number | null)[] = [a.captain.teamNumber, a.pick1.teamNumber, a.showPick2 ? a.pick2.teamNumber : null];
  const members = slots.filter((t): t is number => t !== null);
  let baseTotal = 0, baseAuto = 0, baseDc = 0, totalDev = 0;
  let adjTotal = 0, adjAuto = 0, adjDc = 0;
  for (const tn of members) {
    const t = teamMap.get(tn); if (!t) continue;
    const m = 1 + (whatIf[tn] ?? 0) / 100;
    baseTotal += t.stats.opr.totalPointsNp;
    baseAuto  += t.stats.opr.autoPoints;
    baseDc    += t.stats.opr.dcPoints;
    totalDev  += t.stats.dev.totalPointsNp;
    adjTotal  += t.stats.opr.totalPointsNp * m;
    adjAuto   += t.stats.opr.autoPoints * m;
    adjDc     += t.stats.opr.dcPoints * m;
  }
  const n = members.length;
  return { members, baseTotal, baseAuto, baseDc, baseConsistency: n > 0 ? totalDev / n : 0, adjTotal, adjAuto, adjDc };
}

function fmtDelta(base: number, adj: number): { text: string; positive: boolean } | null {
  const d = adj - base;
  if (Math.abs(d) < 0.05) return null;
  return { text: `${d >= 0 ? "+" : ""}${d.toFixed(1)}`, positive: d > 0 };
}

// ── localStorage ─────────────────────────────────────────────────────────────
function storageKey(code: string) { return `plftc:sim:${code}`; }
function saveState(code: string, alliances: SimAlliance[], whatIf: WhatIfMap) {
  try { localStorage.setItem(storageKey(code), JSON.stringify({ alliances, whatIf })); } catch {}
}
function loadState(code: string): { alliances: SimAlliance[]; whatIf: WhatIfMap } | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// ── Mini radar chart ─────────────────────────────────────────────────────────
function MiniRadar({
  stats, color, fill,
  maxStats,
}: {
  stats: ComputedStats; color: string; fill: string;
  maxStats: { total: number; auto: number; dc: number; consistency: number };
}) {
  const cx = 75, cy = 75, r = 50;
  type Axis = { angle: number; v: number; lx: number; ly: number; label: string };
  const axes: Axis[] = [
    { angle: -Math.PI / 2, v: maxStats.total > 0 ? stats.adjTotal / maxStats.total : 0, lx: cx, ly: cy - r - 13, label: "OPR" },
    { angle: 0,            v: maxStats.auto  > 0 ? stats.adjAuto  / maxStats.auto  : 0, lx: cx + r + 16, ly: cy, label: "Auto" },
    { angle: Math.PI / 2,  v: maxStats.dc    > 0 ? stats.adjDc    / maxStats.dc    : 0, lx: cx, ly: cy + r + 13, label: "DC" },
    { angle: Math.PI,      v: maxStats.consistency > 0 ? stats.baseConsistency / maxStats.consistency : 0, lx: cx - r - 16, ly: cy, label: "Dev" },
  ];

  const polyPoints = axes
    .map(ax => {
      const v = Math.max(0.05, ax.v);
      return `${cx + r * v * Math.cos(ax.angle)},${cy + r * v * Math.sin(ax.angle)}`;
    })
    .join(" ");

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={150} height={150} viewBox="0 0 150 150" aria-hidden>
      {gridLevels.map((t) => (
        <polygon
          key={t}
          points={axes.map(ax => `${cx + r * t * Math.cos(ax.angle)},${cy + r * t * Math.sin(ax.angle)}`).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1}
        />
      ))}
      {axes.map((ax, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={cx + r * Math.cos(ax.angle)} y2={cy + r * Math.sin(ax.angle)}
          stroke="rgba(255,255,255,0.07)" strokeWidth={1}
        />
      ))}
      <polygon points={polyPoints} fill={fill} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {axes.map((ax, i) => (
        <text key={i} x={ax.lx} y={ax.ly} textAnchor="middle" dominantBaseline="middle"
          fontSize={9} fill="rgba(255,255,255,0.45)">
          {ax.label}
        </text>
      ))}
    </svg>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SimulatorPage() {
  const { event, teams } = useEvent();
  const ws = useWorkspaceOptional();

  const [alliances, setAlliances] = useState<SimAlliance[]>(() => [blankAlliance(1), blankAlliance(2)]);
  const [whatIf, setWhatIf] = useState<WhatIfMap>({});
  const [loaded, setLoaded] = useState(false);

  const [showDraft, setShowDraft] = useState(false);
  const [draftNumAlliances, setDraftNumAlliances] = useState(4);
  const [draftResult, setDraftResult] = useState<SimAlliance[] | null>(null);

  const [fillingPickList, setFillingPickList] = useState(false);

  // Load from localStorage on event change
  useEffect(() => {
    const code = event?.code ?? "no-event";
    const saved = loadState(code);
    if (saved) {
      setAlliances(saved.alliances ?? [blankAlliance(1), blankAlliance(2)]);
      setWhatIf(saved.whatIf ?? {});
    } else {
      setAlliances([blankAlliance(1), blankAlliance(2)]);
      setWhatIf({});
    }
    setLoaded(true);
  }, [event?.code]);

  // Save on every change
  useEffect(() => {
    if (!loaded) return;
    saveState(event?.code ?? "no-event", alliances, whatIf);
  }, [alliances, whatIf, loaded, event?.code]);

  // Derived team data
  const teamMap = useMemo(() => new Map(teams.map(t => [t.teamNumber, t])), [teams]);

  const searchableTeams = useMemo<TeamSearchOption[]>(() =>
    teams.map(t => ({ teamNumber: t.teamNumber, teamName: t.teamName, rank: t.stats.rank }))
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
    [teams]
  );

  const selectedTeams = useMemo(() => {
    const s = new Set<number>();
    for (const a of alliances) {
      if (a.captain.teamNumber) s.add(a.captain.teamNumber);
      if (a.pick1.teamNumber)   s.add(a.pick1.teamNumber);
      if (a.pick2.teamNumber)   s.add(a.pick2.teamNumber);
    }
    return s;
  }, [alliances]);

  function availableFor(allianceId: number, slot: "captain" | "pick1" | "pick2") {
    const current = alliances.find(a => a.id === allianceId)?.[slot].teamNumber;
    return searchableTeams.filter(t => !selectedTeams.has(t.teamNumber) || t.teamNumber === current);
  }

  // Stats for each alliance
  const allStats = useMemo(
    () => alliances.map(a => computeStats(a, teamMap, whatIf)),
    [alliances, teamMap, whatIf]
  );

  // Max stats across all alliances (for normalization)
  const maxStats = useMemo(() => ({
    total:       Math.max(...allStats.map(s => s.adjTotal), 1),
    auto:        Math.max(...allStats.map(s => s.adjAuto),  1),
    dc:          Math.max(...allStats.map(s => s.adjDc),    1),
    consistency: Math.max(...allStats.map(s => s.baseConsistency), 1),
  }), [allStats]);

  // ── Alliance mutations ───────────────────────────────────────────────────────

  function updatePick(allianceId: number, slot: "captain" | "pick1" | "pick2", pick: SlotPick) {
    setAlliances(prev => prev.map(a => a.id === allianceId ? { ...a, [slot]: pick } : a));
  }

  function togglePick2(allianceId: number) {
    setAlliances(prev => prev.map(a => a.id === allianceId
      ? { ...a, showPick2: !a.showPick2, pick2: blank() }
      : a
    ));
  }

  function clearAlliance(allianceId: number) {
    setAlliances(prev => prev.map(a => a.id === allianceId ? blankAlliance(a.id) : a));
  }

  function addAlliance() {
    if (alliances.length >= 4) return;
    const maxId = Math.max(...alliances.map(a => a.id), 0);
    setAlliances(prev => [...prev, blankAlliance(maxId + 1)]);
  }

  function removeAlliance(id: number) {
    if (alliances.length <= 2) return;
    setAlliances(prev => prev.filter(a => a.id !== id));
  }

  function setWhatIfAdj(teamNumber: number, pct: number) {
    setWhatIf(prev => {
      if (pct === 0) { const next = { ...prev }; delete next[teamNumber]; return next; }
      return { ...prev, [teamNumber]: pct };
    });
  }

  // ── Auto-fill from pick list ─────────────────────────────────────────────────

  const handleAutoFill = useCallback(async () => {
    if (!ws?.workspace || !event) return;
    setFillingPickList(true);
    const pl = await loadWorkspacePickList(ws.workspace.id, event.code);
    setFillingPickList(false);
    if (!pl || pl.list_data.entries.length === 0) return;

    const available = pl.list_data.entries.filter(e => !e.picked);
    const toFill = available.slice(0, 3).map(e => e.teamNumber);
    if (toFill.length === 0) return;

    setAlliances(prev => {
      const updated = [...prev];
      const first = { ...updated[0] };
      first.captain = toFill[0] !== undefined ? { teamNumber: toFill[0], input: String(toFill[0]) } : blank();
      first.pick1   = toFill[1] !== undefined ? { teamNumber: toFill[1], input: String(toFill[1]) } : blank();
      if (toFill[2] !== undefined) {
        first.pick2    = { teamNumber: toFill[2], input: String(toFill[2]) };
        first.showPick2 = true;
      }
      updated[0] = first;
      return updated;
    });
  }, [ws, event]);

  // ── Draft simulation ─────────────────────────────────────────────────────────

  function runDraftSim() {
    const sorted = [...teams].sort((a, b) => (a.stats.rank ?? 999) - (b.stats.rank ?? 999));
    const n = Math.min(draftNumAlliances, sorted.length);
    const captains = sorted.slice(0, n).map(t => t.teamNumber);
    const pool = sorted.slice(n).map(t => t.teamNumber);

    const result: { captain: number; picks: number[] }[] = captains.map(c => ({ captain: c, picks: [] }));

    for (let round = 0; round < 2; round++) {
      const order = round % 2 === 0
        ? result.map((_, i) => i)
        : result.map((_, i) => result.length - 1 - i);
      for (const idx of order) {
        if (pool.length === 0) break;
        let bestJ = 0, bestOpr = -Infinity;
        for (let j = 0; j < pool.length; j++) {
          const t = teamMap.get(pool[j]);
          if (!t) continue;
          const m = 1 + (whatIf[pool[j]] ?? 0) / 100;
          const opr = t.stats.opr.totalPointsNp * m;
          if (opr > bestOpr) { bestOpr = opr; bestJ = j; }
        }
        result[idx].picks.push(pool[bestJ]);
        pool.splice(bestJ, 1);
      }
    }

    const newAlliances: SimAlliance[] = result.map((r, i) => ({
      id: i + 1,
      captain: { teamNumber: r.captain, input: String(r.captain) },
      pick1: r.picks[0] !== undefined ? { teamNumber: r.picks[0], input: String(r.picks[0]) } : blank(),
      pick2: r.picks[1] !== undefined ? { teamNumber: r.picks[1], input: String(r.picks[1]) } : blank(),
      showPick2: r.picks[1] !== undefined,
    }));
    setDraftResult(newAlliances);
  }

  function applyDraftResult() {
    if (!draftResult) return;
    setAlliances(draftResult.slice(0, 4));
    setDraftResult(null);
    setShowDraft(false);
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const hasComparison = allStats.filter(s => s.members.length >= 2).length >= 2;
  const anyWhatIf = Object.keys(whatIf).length > 0;

  // Win probability matrix: all pairs where both alliances have ≥ 1 member
  const winProbPairs = useMemo(() => {
    const pairs: { i: number; j: number; prob: number }[] = [];
    for (let i = 0; i < alliances.length; i++) {
      for (let j = i + 1; j < alliances.length; j++) {
        if (allStats[i].members.length === 0 || allStats[j].members.length === 0) continue;
        const diff = allStats[i].adjTotal - allStats[j].adjTotal;
        pairs.push({ i, j, prob: winProb(diff) });
      }
    }
    return pairs;
  }, [alliances, allStats]);

  return (
    <WorkspaceGate feature="Alliance Simulator" description="Create or join a workspace to access the Alliance Simulator, Draft Board, Scoring Heatmap, Penalty Analytics, and more.">
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Alliance Simulator</h1>
          {event ? (
            <p className="text-xs text-[var(--foreground-dim)] mt-0.5 font-mono">{event.code} · {teams.length} teams</p>
          ) : (
            <p className="text-xs text-[var(--foreground-dim)] mt-0.5">Load an event for team data</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {alliances.length < 4 && (
            <button
              onClick={addAlliance}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Alliance
            </button>
          )}
          {ws?.workspace && event && (
            <button
              onClick={handleAutoFill}
              disabled={fillingPickList}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
            >
              {fillingPickList ? "Loading…" : "Auto-fill from pick list"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-4 pb-16 space-y-6 overflow-y-auto">

        {/* Alliance grid */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${alliances.length}, minmax(0, 1fr))` }}
        >
          {alliances.map((a, idx) => {
            const p = PALETTE[idx % PALETTE.length];
            const stats = allStats[idx];
            const members = a.captain.teamNumber !== null || a.pick1.teamNumber !== null;
            return (
              <div key={a.id} className={`rounded-xl border ${p.border} ${p.bg} p-3 min-w-[220px]`}>
                {/* Card header */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wider ${p.text}`}>{p.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => clearAlliance(a.id)}
                      disabled={!members}
                      title="Clear alliance"
                      className="p-1 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                    {alliances.length > 2 && (
                      <button
                        onClick={() => removeAlliance(a.id)}
                        title="Remove alliance"
                        className="p-1 rounded text-[var(--foreground-dim)] hover:text-red-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Slots */}
                <div className="space-y-2">
                  {(["captain", "pick1"] as const).map((slot) => {
                    const pick = a[slot];
                    const label = slot === "captain" ? "C" : "1";
                    const labelClass = slot === "captain" ? "text-[var(--accent)]" : "text-[var(--foreground-dim)]";
                    return (
                      <div key={slot}>
                        <TeamSearch
                          teams={availableFor(a.id, slot)}
                          inputValue={pick.input}
                          onInputChange={(v) => updatePick(a.id, slot, { teamNumber: null, input: v })}
                          onSelect={(t) => updatePick(a.id, slot, { teamNumber: t.teamNumber, input: String(t.teamNumber) })}
                          onClear={() => updatePick(a.id, slot, blank())}
                          placeholder={slot === "captain" ? "Captain…" : "Pick 1…"}
                          showRank
                          showSearchIcon={false}
                          prefix={
                            <span className={`text-[10px] font-bold w-4 shrink-0 ${labelClass}`}>{label}</span>
                          }
                        />
                        {pick.teamNumber !== null && (
                          <WhatIfRow
                            teamNumber={pick.teamNumber}
                            adj={whatIf[pick.teamNumber] ?? 0}
                            opr={teamMap.get(pick.teamNumber)?.stats.opr.totalPointsNp ?? 0}
                            onChange={(v) => setWhatIfAdj(pick.teamNumber!, v)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Pick 2 toggle/slot */}
                  {!a.showPick2 ? (
                    <button
                      onClick={() => togglePick2(a.id)}
                      className="text-[10px] text-[var(--foreground-dim)] hover:text-[var(--foreground-muted)] flex items-center gap-1 pl-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add Pick 2
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1">
                          <TeamSearch
                            teams={availableFor(a.id, "pick2")}
                            inputValue={a.pick2.input}
                            onInputChange={(v) => updatePick(a.id, "pick2", { teamNumber: null, input: v })}
                            onSelect={(t) => updatePick(a.id, "pick2", { teamNumber: t.teamNumber, input: String(t.teamNumber) })}
                            onClear={() => updatePick(a.id, "pick2", blank())}
                            placeholder="Pick 2…"
                            showRank
                            showSearchIcon={false}
                            prefix={<span className="text-[10px] font-bold w-4 shrink-0 text-[var(--foreground-dim)]">2</span>}
                          />
                        </div>
                        <button
                          onClick={() => togglePick2(a.id)}
                          className="p-1.5 rounded text-[var(--foreground-dim)] hover:text-red-400 transition-colors shrink-0"
                          title="Remove Pick 2"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {a.pick2.teamNumber !== null && (
                        <WhatIfRow
                          teamNumber={a.pick2.teamNumber}
                          adj={whatIf[a.pick2.teamNumber] ?? 0}
                          opr={teamMap.get(a.pick2.teamNumber)?.stats.opr.totalPointsNp ?? 0}
                          onChange={(v) => setWhatIfAdj(a.pick2.teamNumber!, v)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Stats */}
                {stats.members.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]/50 space-y-1">
                    <StatRow
                      label="OPR" base={stats.baseTotal} adj={stats.adjTotal}
                      isAdjusted={anyWhatIf}
                      highlight={stats.adjTotal === maxStats.total && alliances.length > 1}
                      color={p.text}
                    />
                    <StatRow label="Auto" base={stats.baseAuto} adj={stats.adjAuto} isAdjusted={anyWhatIf} />
                    <StatRow label="DC"   base={stats.baseDc}   adj={stats.adjDc}   isAdjusted={anyWhatIf} />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--foreground-dim)]">Dev (avg)</span>
                      <span className="font-mono text-[11px] text-[var(--foreground-muted)]">
                        {stats.baseConsistency.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Radar */}
                {stats.members.length > 0 && (
                  <div className="mt-2 flex justify-center">
                    <MiniRadar stats={stats} color={p.color} fill={p.fill} maxStats={maxStats} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison section */}
        {hasComparison && (
          <section>
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Comparison</h2>

            {/* OPR bar chart */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 mb-4 space-y-2.5">
              {alliances.map((a, idx) => {
                const s = allStats[idx];
                if (s.members.length === 0) return null;
                const p = PALETTE[idx % PALETTE.length];
                const pct = maxStats.total > 0 ? (s.adjTotal / maxStats.total) * 100 : 0;
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase w-20 shrink-0 ${p.text}`}>{p.label}</span>
                    <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                    <span className="font-mono text-xs text-[var(--foreground-muted)] w-14 text-right shrink-0">
                      {s.adjTotal.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Highlights table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
                    <th className="text-left px-4 py-2">Alliance</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Auto</th>
                    <th className="text-right px-3 py-2">DC</th>
                    <th className="text-right px-4 py-2">Consistency</th>
                  </tr>
                </thead>
                <tbody>
                  {alliances.map((a, idx) => {
                    const s = allStats[idx];
                    if (s.members.length === 0) return null;
                    const p = PALETTE[idx % PALETTE.length];
                    const bestTotal = s.adjTotal === maxStats.total;
                    const bestAuto  = s.adjAuto  === maxStats.auto;
                    const bestDc    = s.adjDc    === maxStats.dc;
                    const bestCons  = s.baseConsistency === maxStats.consistency;
                    return (
                      <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                        <td className={`px-4 py-2 font-bold text-[10px] uppercase tracking-wider ${p.text}`}>{p.label}</td>
                        <td className={`px-3 py-2 text-right font-mono ${bestTotal && alliances.length > 1 ? "text-emerald-400 font-semibold" : "text-[var(--foreground-muted)]"}`}>
                          {s.adjTotal.toFixed(1)}{bestTotal && alliances.length > 1 ? " ★" : ""}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${bestAuto && alliances.length > 1 ? "text-emerald-400 font-semibold" : "text-[var(--foreground-muted)]"}`}>
                          {s.adjAuto.toFixed(1)}{bestAuto && alliances.length > 1 ? " ★" : ""}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${bestDc && alliances.length > 1 ? "text-emerald-400 font-semibold" : "text-[var(--foreground-muted)]"}`}>
                          {s.adjDc.toFixed(1)}{bestDc && alliances.length > 1 ? " ★" : ""}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${bestCons && alliances.length > 1 ? "text-emerald-400 font-semibold" : "text-[var(--foreground-muted)]"}`}>
                          {s.baseConsistency.toFixed(1)}{bestCons && alliances.length > 1 ? " ★" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Win probability */}
            {winProbPairs.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] font-semibold mb-3">
                  Head-to-head win probability
                </p>
                <div className="space-y-2">
                  {winProbPairs.map(({ i, j, prob }) => {
                    const pa = PALETTE[i % PALETTE.length];
                    const pb = PALETTE[j % PALETTE.length];
                    const aPct = Math.round(prob * 100);
                    const bPct = 100 - aPct;
                    return (
                      <div key={`${i}-${j}`} className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold w-20 shrink-0 ${pa.text}`}>{pa.label}</span>
                        <div className="flex-1 flex h-4 rounded-full overflow-hidden">
                          <div
                            className="h-full flex items-center justify-end pr-1.5 transition-all duration-300"
                            style={{ width: `${aPct}%`, backgroundColor: pa.color, opacity: 0.7 }}
                          >
                            {aPct >= 20 && <span className="text-[9px] font-bold text-white">{aPct}%</span>}
                          </div>
                          <div
                            className="h-full flex items-center justify-start pl-1.5 transition-all duration-300"
                            style={{ width: `${bPct}%`, backgroundColor: pb.color, opacity: 0.7 }}
                          >
                            {bPct >= 20 && <span className="text-[9px] font-bold text-white">{bPct}%</span>}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold w-20 text-right shrink-0 ${pb.text}`}>{pb.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Draft simulation */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Draft Simulation</h2>
            {teams.length === 0 && (
              <span className="text-xs text-[var(--foreground-dim)]">Requires event data</span>
            )}
          </div>

          {teams.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-xs text-[var(--foreground-muted)] mb-3">
                Simulates a serpentine draft using event rankings as captain seeds and greedy OPR-based picks.
                {anyWhatIf && " What-if adjustments are applied to picks."}
              </p>
              <div className="flex items-center gap-3 mb-4">
                <label className="text-xs text-[var(--foreground-muted)] shrink-0">Alliances:</label>
                <div className="flex gap-1">
                  {[2, 3, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setDraftNumAlliances(n)}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        draftNumAlliances === n
                          ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40"
                          : "bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] border-[var(--border)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runDraftSim}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Run simulation
                </button>
              </div>

              {draftResult && (
                <div>
                  <div className="overflow-x-auto">
                    <div className="flex gap-3 min-w-max pb-2">
                      {draftResult.map((a, idx) => {
                        const p = PALETTE[idx % PALETTE.length];
                        const s = computeStats(a, teamMap, whatIf);
                        return (
                          <div key={a.id} className={`rounded-lg border ${p.border} p-2.5 min-w-[160px]`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${p.text}`}>
                              {p.label}
                            </p>
                            {[a.captain, a.pick1, ...(a.showPick2 ? [a.pick2] : [])].map((pick, si) => {
                              if (!pick.teamNumber) return null;
                              const t = teamMap.get(pick.teamNumber);
                              return (
                                <div key={si} className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] text-[var(--foreground-dim)] w-12 shrink-0">
                                    {si === 0 ? "Captain" : `Pick ${si}`}
                                  </span>
                                  <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                                    {pick.teamNumber}
                                  </span>
                                </div>
                              );
                            })}
                            <p className="font-mono text-[11px] text-[var(--foreground-dim)] mt-1.5">
                              Σ {s.adjTotal.toFixed(1)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {draftResult.length <= 4 && (
                    <button
                      onClick={applyDraftResult}
                      className="mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Apply to simulator
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
    </WorkspaceGate>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function WhatIfRow({
  teamNumber, adj, opr, onChange,
}: {
  teamNumber: number; adj: number; opr: number; onChange: (v: number) => void;
}) {
  const adjOpr = opr * (1 + adj / 100);
  const hasAdj = adj !== 0;
  return (
    <div className="flex items-center gap-2 mt-1 pl-5">
      <span className="text-[10px] text-[var(--foreground-dim)]">
        {opr.toFixed(1)}
        {hasAdj && (
          <span className={`ml-1 ${adj > 0 ? "text-emerald-400" : "text-red-400"}`}>
            → {adjOpr.toFixed(1)}
          </span>
        )}
      </span>
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onChange(Math.max(-50, adj - 10))}
          className="w-5 h-5 rounded flex items-center justify-center text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)] text-xs transition-colors"
        >−</button>
        <span className={`font-mono text-[10px] w-10 text-center ${hasAdj ? (adj > 0 ? "text-emerald-400" : "text-red-400") : "text-[var(--foreground-dim)]"}`}>
          {adj > 0 ? "+" : ""}{adj}%
        </span>
        <button
          onClick={() => onChange(Math.min(50, adj + 10))}
          className="w-5 h-5 rounded flex items-center justify-center text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)] text-xs transition-colors"
        >+</button>
        {hasAdj && (
          <button
            onClick={() => onChange(0)}
            className="text-[9px] text-[var(--foreground-dim)] hover:text-red-400 transition-colors ml-0.5"
          >✕</button>
        )}
      </div>
    </div>
  );
}

function StatRow({
  label, base, adj, isAdjusted, highlight, color,
}: {
  label: string; base: number; adj: number; isAdjusted: boolean;
  highlight?: boolean; color?: string;
}) {
  const delta = fmtDelta(base, adj);
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[var(--foreground-dim)]">{label}</span>
      <div className="flex items-center gap-1.5">
        {isAdjusted && delta && (
          <span className={`text-[10px] font-mono ${delta.positive ? "text-emerald-400" : "text-red-400"}`}>
            {delta.text}
          </span>
        )}
        <span
          className={`font-mono text-[11px] font-semibold ${highlight ? "text-emerald-400" : color ?? "text-[var(--foreground-muted)]"}`}
        >
          {isAdjusted && delta ? adj.toFixed(1) : base.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
