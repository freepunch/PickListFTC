"use client";

import { useState, useMemo, useCallback } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useEvent } from "@/context/EventContext";
import {
  getWLT,
  getTeamClassification,
  rankPartners,
  normalizeStats,
  PartnerResult,
  PartnerMode,
} from "@/lib/calculations";
import { ProcessedTeam, PrescoutRankedTeam } from "@/lib/types";
import { useRouter } from "next/navigation";
import { PrescoutBanner } from "@/components/PrescoutBanner";

// ── Radar axes (same as compare view) ──

const RADAR_AXES = [
  { label: "Auto Avg", accessor: (s: ProcessedTeam["stats"]) => s.avg.autoPoints },
  { label: "DC Avg", accessor: (s: ProcessedTeam["stats"]) => s.avg.dcPoints },
  { label: "Auto OPR", accessor: (s: ProcessedTeam["stats"]) => s.opr.autoPoints },
  { label: "DC OPR", accessor: (s: ProcessedTeam["stats"]) => s.opr.dcPoints },
  { label: "Consistency", accessor: (s: ProcessedTeam["stats"]) => s.dev.totalPointsNp, invert: true },
] as const;

// ── Tag colors ──

function tagColor(tag: string): string {
  switch (tag) {
    case "Fills your auto gap":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "Strong DC pairing":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "High ceiling":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "Rock solid":
      return "text-green-400 bg-green-400/10 border-green-400/20";
    case "DC powerhouse":
      return "text-violet-400 bg-violet-400/10 border-violet-400/20";
    case "Auto powerhouse":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    default:
      return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
  }
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-[var(--accent)]";
  return "bg-zinc-600";
}

function classificationColor(label: string): string {
  if (label === "Auto-heavy") return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
  if (label === "DC-heavy") return "text-violet-400 bg-violet-400/10 border-violet-400/20";
  return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

// ── Team Selector ──

function TeamSelector({
  teams,
  onSelect,
}: {
  teams: ProcessedTeam[];
  onSelect: (team: ProcessedTeam) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams.slice(0, 15);
    return teams.filter(
      (t) =>
        String(t.teamNumber).includes(q) ||
        t.teamName.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [query, teams]);

  return (
    <div className="relative w-72">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search team # or name..."
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
          placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]
          focus:ring-1 focus:ring-[var(--accent)]/30 font-mono transition-colors"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.teamNumber}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(t);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-700/50 transition-colors"
            >
              <span className="font-mono text-sm text-[var(--accent)]">{t.teamNumber}</span>
              <span className="text-sm text-zinc-300 ml-2">{t.teamName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Selected Team Card ──

function SelectedTeamCard({ team, isPrescout, prescoutTeam }: { team: ProcessedTeam; isPrescout?: boolean; prescoutTeam?: PrescoutRankedTeam | null }) {
  const classification = getTeamClassification(team.stats);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-mono text-2xl font-bold text-white">{team.teamNumber}</span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${classificationColor(classification)}`}
          >
            {classification}
          </span>
          {isPrescout && (
            <span className="text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
              Season Data
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-400 truncate">{team.teamName}</p>
      </div>
      <div className="flex gap-6 text-center shrink-0">
        {isPrescout && prescoutTeam ? (
          <>
            <div>
              <p className="font-mono text-lg font-semibold text-white">
                {prescoutTeam.bestOpr.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">Best OPR</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-cyan-400">
                {prescoutTeam.bestAutoOpr.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">Best Auto</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-violet-400">
                {prescoutTeam.bestDcOpr.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">Best DC</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-zinc-300">
                {prescoutTeam.record.wins}-{prescoutTeam.record.losses}-{prescoutTeam.record.ties}
              </p>
              <p className="text-xs text-zinc-500">Season W-L-T</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="font-mono text-lg font-semibold text-white">
                {team.stats.opr.totalPointsNp.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">OPR</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-cyan-400">
                {team.stats.opr.autoPoints.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">Auto</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-violet-400">
                {team.stats.opr.dcPoints.toFixed(1)}
              </p>
              <p className="text-xs text-zinc-500">DC</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-zinc-300">
                {getWLT(team.stats)}
              </p>
              <p className="text-xs text-zinc-500">W-L-T</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Mini Radar for expanded row ──

function MiniRadar({
  selected,
  partner,
  allTeams,
}: {
  selected: ProcessedTeam;
  partner: ProcessedTeam;
  allTeams: ProcessedTeam[];
}) {
  const data = useMemo(() => {
    return RADAR_AXES.map((axis) => {
      const normalized = normalizeStats(allTeams, axis.accessor);
      let valA = normalized.get(selected.teamNumber) ?? 0;
      let valB = normalized.get(partner.teamNumber) ?? 0;
      if ("invert" in axis && axis.invert) {
        valA = 100 - valA;
        valB = 100 - valB;
      }
      return { stat: axis.label, selected: valA, partner: valB };
    });
  }, [selected, partner, allTeams]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis
          dataKey="stat"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name={String(selected.teamNumber)}
          dataKey="selected"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Radar
          name={String(partner.teamNumber)}
          dataKey="partner"
          stroke="#14b8a6"
          fill="#14b8a6"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Expanded Row Panel ──

function ExpandedPanel({
  selected,
  partner,
  allTeams,
}: {
  selected: ProcessedTeam;
  partner: ProcessedTeam;
  allTeams: ProcessedTeam[];
}) {
  const diffs = useMemo(() => {
    const s = selected.stats;
    const p = partner.stats;
    return [
      { label: "Auto OPR", a: s.opr.autoPoints, b: p.opr.autoPoints },
      { label: "DC OPR", a: s.opr.dcPoints, b: p.opr.dcPoints },
      { label: "Total Avg", a: s.avg.totalPointsNp, b: p.avg.totalPointsNp },
      { label: "Consistency", a: s.dev.totalPointsNp, b: p.dev.totalPointsNp, invert: true },
    ];
  }, [selected, partner]);

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 p-4 bg-zinc-950 border-t border-zinc-800">
      <div>
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs text-zinc-400 font-mono">{selected.teamNumber}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <span className="text-xs text-zinc-400 font-mono">{partner.teamNumber}</span>
          </div>
        </div>
        <MiniRadar selected={selected} partner={partner} allTeams={allTeams} />
      </div>
      <div className="space-y-3 flex flex-col justify-center">
        {diffs.map((d) => {
          const aVal = d.a;
          const bVal = d.b;
          const max = Math.max(aVal, bVal) || 1;
          return (
            <div key={d.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">{d.label}</span>
                {d.invert && (
                  <span className="text-[10px] text-zinc-600">(lower = better)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-400 w-12 text-right">
                  {aVal.toFixed(1)}
                </span>
                <div className="flex-1 flex h-3 gap-0.5 rounded overflow-hidden bg-zinc-900">
                  <div
                    className="bg-blue-500/60 rounded-l transition-all"
                    style={{ width: `${(aVal / max) * 50}%` }}
                  />
                  <div
                    className="bg-teal-500/60 rounded-r transition-all ml-auto"
                    style={{ width: `${(bVal / max) * 50}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-teal-400 w-12">
                  {bVal.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Prescout Expanded Panel ──

function PrescoutExpandedPanel({
  selected,
  partner,
}: {
  selected: PrescoutRankedTeam;
  partner: PrescoutRankedTeam;
}) {
  const diffs = [
    { label: "Best Auto OPR", a: selected.bestAutoOpr, b: partner.bestAutoOpr },
    { label: "Best DC OPR", a: selected.bestDcOpr, b: partner.bestDcOpr },
    { label: "Season Avg", a: selected.seasonAvg, b: partner.seasonAvg },
    { label: "Best Total OPR", a: selected.bestOpr, b: partner.bestOpr },
  ];

  return (
    <div className="p-4 bg-zinc-950 border-t border-zinc-800">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-xs text-zinc-400 font-mono">{selected.teamNumber}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
          <span className="text-xs text-zinc-400 font-mono">{partner.teamNumber}</span>
        </div>
      </div>
      <div className="space-y-3 max-w-md">
        {diffs.map((d) => {
          const max = Math.max(d.a, d.b) || 1;
          return (
            <div key={d.label}>
              <span className="text-xs text-zinc-500">{d.label}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-blue-400 w-12 text-right">{d.a.toFixed(1)}</span>
                <div className="flex-1 flex h-3 gap-0.5 rounded overflow-hidden bg-zinc-900">
                  <div className="bg-blue-500/60 rounded-l transition-all" style={{ width: `${(d.a / max) * 50}%` }} />
                  <div className="bg-teal-500/60 rounded-r transition-all ml-auto" style={{ width: `${(d.b / max) * 50}%` }} />
                </div>
                <span className="font-mono text-xs text-teal-400 w-12">{d.b.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Partner Row ──

function PartnerRow({
  rank,
  result,
  selected,
  allTeams,
  expanded,
  onToggle,
}: {
  rank: number;
  result: PartnerResult;
  selected: ProcessedTeam;
  allTeams: ProcessedTeam[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const partner = allTeams.find((t) => t.teamNumber === result.teamNumber)!;

  return (
    <div className="border-b border-zinc-800 last:border-b-0" style={{ transition: "transform 0.3s ease, opacity 0.3s ease" }}>
      <div
        onClick={onToggle}
        className={`grid grid-cols-[3rem_1fr_12rem_6rem_9rem_5rem] items-center px-4 py-3 cursor-pointer transition-colors ${
          expanded ? "bg-zinc-900" : "hover:bg-zinc-900/50"
        }`}
      >
        <span className="font-mono text-sm text-zinc-500 font-medium">#{rank}</span>
        <div className="min-w-0">
          <span className="font-mono text-sm text-white font-semibold">{result.teamNumber}</span>
          <span className="text-sm text-zinc-400 ml-2 truncate">{result.teamName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBarColor(result.score)}`} style={{ width: `${result.score}%` }} />
          </div>
          <span className="font-mono text-sm font-semibold text-white w-8 text-right">{result.score}</span>
        </div>
        <span className="font-mono text-sm text-zinc-300 text-center">{result.projectedCombinedOpr.toFixed(1)}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap w-fit ${tagColor(result.complementarityTag)}`}>
          {result.complementarityTag}
        </span>
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/compare?teams=${selected.teamNumber},${result.teamNumber}`)}
            title="Compare"
            className="p-1.5 rounded-md text-zinc-500 hover:text-[var(--accent)] hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </button>
          <button
            onClick={() => router.push(`/report/${result.teamNumber}`)}
            title="Report"
            className="p-1.5 rounded-md text-zinc-500 hover:text-[var(--accent)] hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && (
        <ExpandedPanel selected={selected} partner={partner} allTeams={allTeams} />
      )}
    </div>
  );
}

// ── Prescout Partner Row ──

interface PrescoutPartnerResult {
  teamNumber: number;
  teamName: string;
  score: number;
  projectedCombinedOpr: number;
  complementarityTag: string;
}

function PrescoutPartnerRow({
  rank,
  result,
  selected,
  allPrescout,
  expanded,
  onToggle,
}: {
  rank: number;
  result: PrescoutPartnerResult;
  selected: PrescoutRankedTeam;
  allPrescout: PrescoutRankedTeam[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const partner = allPrescout.find((t) => t.teamNumber === result.teamNumber)!;

  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <div
        onClick={onToggle}
        className={`grid grid-cols-[3rem_1fr_12rem_6rem_9rem_5rem] items-center px-4 py-3 cursor-pointer transition-colors ${
          expanded ? "bg-zinc-900" : "hover:bg-zinc-900/50"
        }`}
      >
        <span className="font-mono text-sm text-zinc-500 font-medium">#{rank}</span>
        <div className="min-w-0">
          <span className="font-mono text-sm text-white font-semibold">{result.teamNumber}</span>
          <span className="text-sm text-zinc-400 ml-2 truncate">{result.teamName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${scoreBarColor(result.score)}`} style={{ width: `${result.score}%` }} />
          </div>
          <span className="font-mono text-sm font-semibold text-white w-8 text-right">{result.score}</span>
        </div>
        <span className="font-mono text-sm text-zinc-300 text-center">{result.projectedCombinedOpr.toFixed(1)}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap w-fit ${tagColor(result.complementarityTag)}`}>
          {result.complementarityTag}
        </span>
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => router.push(`/compare?teams=${selected.teamNumber},${result.teamNumber}`)} title="Compare" className="p-1.5 rounded-md text-zinc-500 hover:text-[var(--accent)] hover:bg-zinc-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </button>
          <button onClick={() => router.push(`/report/${result.teamNumber}`)} title="Report" className="p-1.5 rounded-md text-zinc-500 hover:text-[var(--accent)] hover:bg-zinc-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && (
        <PrescoutExpandedPanel selected={selected} partner={partner} />
      )}
    </div>
  );
}

// ── Mode Config ──

const MODES: { key: PartnerMode; label: string; scoreHeader: string }[] = [
  { key: "balanced", label: "Balanced", scoreHeader: "Compatibility" },
  { key: "opr", label: "Raw OPR", scoreHeader: "OPR" },
  { key: "auto", label: "Auto Priority", scoreHeader: "Auto OPR" },
  { key: "dc", label: "DC Priority", scoreHeader: "DC OPR" },
  { key: "consistency", label: "Consistency", scoreHeader: "Consistency" },
];

const PRESCOUT_MODES: { key: string; label: string; scoreHeader: string }[] = [
  { key: "balanced", label: "Balanced", scoreHeader: "Compatibility" },
  { key: "opr", label: "Best OPR", scoreHeader: "Season Best OPR" },
  { key: "auto", label: "Auto Priority", scoreHeader: "Best Auto OPR" },
  { key: "dc", label: "DC Priority", scoreHeader: "Best DC OPR" },
];

// ── Prescout partner ranking ──

function rankPrescoutPartners(
  selected: PrescoutRankedTeam,
  all: PrescoutRankedTeam[],
  mode: string
): PrescoutPartnerResult[] {
  const others = all.filter((t) => t.teamNumber !== selected.teamNumber);

  const results: PrescoutPartnerResult[] = others.map((partner) => {
    let score: number;

    if (mode === "opr") {
      const vals = all.map((t) => t.bestOpr);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;
      score = Math.round(((partner.bestOpr - min) / range) * 100);
    } else if (mode === "auto") {
      const vals = all.map((t) => t.bestAutoOpr);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;
      score = Math.round(((partner.bestAutoOpr - min) / range) * 100);
    } else if (mode === "dc") {
      const vals = all.map((t) => t.bestDcOpr);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;
      score = Math.round(((partner.bestDcOpr - min) / range) * 100);
    } else {
      // balanced: complementarity + strength
      const sTotal = selected.bestOpr || 1;
      const pTotal = partner.bestOpr || 1;
      const sAutoR = selected.bestAutoOpr / sTotal;
      const sDcR = selected.bestDcOpr / sTotal;
      const pAutoR = partner.bestAutoOpr / pTotal;
      const pDcR = partner.bestDcOpr / pTotal;
      const profileDiv = (Math.abs(sAutoR - pAutoR) + Math.abs(sDcR - pDcR)) / 2;

      const combinedOpr = selected.bestOpr + partner.bestOpr;
      const sortedOprs = all.map((t) => t.bestOpr).sort((a, b) => b - a);
      const theoreticalMax = (sortedOprs[0] ?? 0) + (sortedOprs[1] ?? 0) || 1;
      const strength = Math.min(combinedOpr / theoreticalMax, 1);

      score = Math.round(Math.min((profileDiv * 0.5 + strength * 0.5) * 100, 100));
    }

    const projectedCombinedOpr = selected.bestOpr + partner.bestOpr;

    // Tag
    const sTotal = selected.bestOpr || 1;
    const pTotal = partner.bestOpr || 1;
    const sAutoR = selected.bestAutoOpr / sTotal;
    const pAutoR = partner.bestAutoOpr / pTotal;
    let tag = "Balanced match";
    if (sAutoR < 0.35 && pAutoR > 0.55) tag = "Fills your auto gap";
    else if (sAutoR > 0.55 && pAutoR < 0.35) tag = "Strong DC pairing";
    else if (sAutoR > 0.55 && pAutoR > 0.55) tag = "Auto powerhouse";
    else if (sAutoR < 0.35 && pAutoR < 0.35) tag = "DC powerhouse";

    // Override with ceiling/solid checks
    const allCombined = others.map((o) => selected.bestOpr + o.bestOpr);
    const sorted = [...allCombined].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 100;
    if (projectedCombinedOpr >= p90) tag = "High ceiling";

    return {
      teamNumber: partner.teamNumber,
      teamName: partner.teamName,
      score,
      projectedCombinedOpr,
      complementarityTag: tag,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ── Main Page ──

export default function PartnersPage() {
  const { event, teams, isPrescout, prescoutRanking } = useEvent();
  const [selectedTeam, setSelectedTeam] = useState<ProcessedTeam | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [mode, setMode] = useState<PartnerMode>("balanced");
  const [psMode, setPsMode] = useState("balanced");

  const selectedPrescout = useMemo(
    () => selectedTeam ? prescoutRanking.find((t) => t.teamNumber === selectedTeam.teamNumber) ?? null : null,
    [selectedTeam, prescoutRanking]
  );

  const ranked = useMemo(() => {
    if (!selectedTeam || isPrescout) return [];
    return rankPartners(selectedTeam, teams, mode);
  }, [selectedTeam, teams, mode, isPrescout]);

  const prescoutRanked = useMemo(() => {
    if (!selectedPrescout || !isPrescout) return [];
    return rankPrescoutPartners(selectedPrescout, prescoutRanking, psMode);
  }, [selectedPrescout, prescoutRanking, psMode, isPrescout]);

  const activeMode = isPrescout
    ? PRESCOUT_MODES.find((m) => m.key === psMode)!
    : MODES.find((m) => m.key === mode)!;

  const handleSelect = useCallback((team: ProcessedTeam) => {
    setSelectedTeam(team);
    setExpandedRow(null);
  }, []);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-1">No event loaded</h2>
        <p className="text-sm text-zinc-500 max-w-xs">
          Enter an FTC event code in the loader above to find the best alliance partners.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PrescoutBanner />
      <div className="p-6 max-w-6xl mx-auto space-y-6 flex-1">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Partner Finder</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isPrescout
              ? `Select your team to see ranked alliance partners based on season performance`
              : `Select your team to see ranked alliance partners at ${event.name}`
            }
          </p>
        </div>

        {/* Team selector */}
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Your Team</label>
            <TeamSelector teams={teams} onSelect={handleSelect} />
          </div>
          {selectedTeam && (
            <button
              onClick={() => {
                setSelectedTeam(null);
                setExpandedRow(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors pb-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Selected team card */}
        {selectedTeam && (
          <SelectedTeamCard team={selectedTeam} isPrescout={isPrescout} prescoutTeam={selectedPrescout} />
        )}

        {/* Mode selector */}
        {selectedTeam && (
          <div className="flex gap-1 p-1 bg-zinc-800/50 rounded-lg w-fit">
            {(isPrescout ? PRESCOUT_MODES : MODES).map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  if (isPrescout) setPsMode(m.key);
                  else setMode(m.key as PartnerMode);
                  setExpandedRow(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  (isPrescout ? psMode : mode) === m.key
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* Partner list (live) */}
        {selectedTeam && !isPrescout && ranked.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_12rem_6rem_9rem_5rem] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500">#</span>
              <span className="text-xs font-medium text-zinc-500">Team</span>
              <span className="text-xs font-medium text-zinc-500">{activeMode.scoreHeader}</span>
              <span className="text-xs font-medium text-zinc-500 text-center">Comb. OPR</span>
              <span className="text-xs font-medium text-zinc-500">Tag</span>
              <span className="text-xs font-medium text-zinc-500 text-right">Actions</span>
            </div>
            {ranked.map((result, idx) => (
              <PartnerRow
                key={result.teamNumber}
                rank={idx + 1}
                result={result}
                selected={selectedTeam}
                allTeams={teams}
                expanded={expandedRow === result.teamNumber}
                onToggle={() => setExpandedRow(expandedRow === result.teamNumber ? null : result.teamNumber)}
              />
            ))}
          </div>
        )}

        {/* Partner list (prescout) */}
        {selectedTeam && isPrescout && prescoutRanked.length > 0 && selectedPrescout && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_12rem_6rem_9rem_5rem] items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
              <span className="text-xs font-medium text-zinc-500">#</span>
              <span className="text-xs font-medium text-zinc-500">Team</span>
              <span className="text-xs font-medium text-zinc-500">{activeMode.scoreHeader}</span>
              <span className="text-xs font-medium text-zinc-500 text-center">Comb. Best OPR</span>
              <span className="text-xs font-medium text-zinc-500">Tag</span>
              <span className="text-xs font-medium text-zinc-500 text-right">Actions</span>
            </div>
            {prescoutRanked.map((result, idx) => (
              <PrescoutPartnerRow
                key={result.teamNumber}
                rank={idx + 1}
                result={result}
                selected={selectedPrescout}
                allPrescout={prescoutRanking}
                expanded={expandedRow === result.teamNumber}
                onToggle={() => setExpandedRow(expandedRow === result.teamNumber ? null : result.teamNumber)}
              />
            ))}
          </div>
        )}

        {selectedTeam && ((isPrescout && prescoutRanked.length === 0) || (!isPrescout && ranked.length === 0)) && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500">No other teams at this event to compare against.</p>
          </div>
        )}
      </div>
    </div>
  );
}
