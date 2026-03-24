"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useEvent } from "@/context/EventContext";
import { NoteForm } from "@/components/NoteForm";
import { NotesBadge } from "@/components/NotesBadge";
import { EventLoader } from "@/components/EventLoader";
import { PrescoutBanner } from "@/components/PrescoutBanner";
import {
  normalizeStats,
  complementarityScore,
  getConsistency,
  getWLT,
} from "@/lib/calculations";
import { ProcessedTeam, Match, TeamEventStats2025, PrescoutRankedTeam } from "@/lib/types";

const TEAM_COLORS = [
  { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.2)", label: "text-blue-400", bg: "bg-blue-500/15", dot: "bg-blue-500" },
  { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.2)", label: "text-teal-400", bg: "bg-teal-500/15", dot: "bg-teal-500" },
  { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.2)", label: "text-amber-400", bg: "bg-amber-500/15", dot: "bg-amber-500" },
];

const MAX_SLOTS = 3;

// ── Team Slot Search ──

function TeamSlot({
  index,
  team,
  allTeams,
  onSelect,
  onRemove,
  isPrescout,
  prescoutTeam,
}: {
  index: number;
  team: ProcessedTeam | null;
  allTeams: ProcessedTeam[];
  onSelect: (teamNumber: number) => void;
  onRemove: () => void;
  isPrescout?: boolean;
  prescoutTeam?: PrescoutRankedTeam | null;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = TEAM_COLORS[index];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTeams
      .filter(
        (t) =>
          t.teamNumber.toString().includes(q) ||
          t.teamName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, allTeams]);

  const [noteFormOpen, setNoteFormOpen] = useState(false);

  if (team) {
    return (
      <div className="space-y-2">
        <div
          className={`flex items-center gap-3 ${color.bg} border border-zinc-800 rounded-xl px-4 py-3 transition-all duration-200`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-white font-medium text-sm">
                {team.teamNumber}
              </p>
              <NotesBadge teamNumber={team.teamNumber} />
            </div>
            <p className="text-xs text-zinc-400 truncate">{team.teamName}</p>
            <p className="text-xs text-zinc-600">
              {isPrescout && prescoutTeam
                ? `Season Best OPR ${prescoutTeam.bestOpr.toFixed(1)} \u00b7 ${prescoutTeam.record.wins}-${prescoutTeam.record.losses}-${prescoutTeam.record.ties}`
                : `Rank #${team.stats.rank} \u00b7 ${getWLT(team.stats)}`
              }
            </p>
          </div>
          <button
            onClick={() => setNoteFormOpen((o) => !o)}
            title="Add scout note"
            className={`p-1 transition-colors shrink-0 ${noteFormOpen ? "text-[var(--accent)]" : "text-zinc-600 hover:text-zinc-300"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
          <Link
            href={`/report/${team.teamNumber}`}
            title="Team Report"
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </Link>
          <button
            onClick={onRemove}
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {noteFormOpen && (
          <NoteForm
            teamNumber={team.teamNumber}
            onClose={() => setNoteFormOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
        <div className={`w-2.5 h-2.5 rounded-full bg-zinc-700 shrink-0`} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search team # or name..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600
            focus:outline-none"
        />
      </div>
      {focused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map((t) => (
            <button
              key={t.teamNumber}
              onClick={() => {
                onSelect(t.teamNumber);
                setQuery("");
                setFocused(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-700/50 transition-colors flex items-center gap-3"
            >
              <span className="font-mono text-sm text-white">
                {t.teamNumber}
              </span>
              <span className="text-sm text-zinc-400 truncate">
                {t.teamName}
              </span>
              <span className="text-xs text-zinc-600 ml-auto shrink-0">
                #{t.stats.rank}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Radar chart data (live mode) ──

function useRadarData(
  selectedData: ProcessedTeam[],
  allTeams: ProcessedTeam[]
) {
  return useMemo(() => {
    if (selectedData.length === 0 || allTeams.length === 0) return [];

    const axes: {
      label: string;
      accessor: (s: TeamEventStats2025) => number;
      invert?: boolean;
    }[] = [
      { label: "Auto Avg", accessor: (s) => s.avg.autoPoints },
      { label: "DC Avg", accessor: (s) => s.avg.dcPoints },
      { label: "Auto OPR", accessor: (s) => s.opr.autoPoints },
      { label: "DC OPR", accessor: (s) => s.opr.dcPoints },
      {
        label: "Consistency",
        accessor: (s) => s.dev.totalPointsNp,
        invert: true,
      },
    ];

    return axes.map((axis) => {
      const normalized = normalizeStats(allTeams, axis.accessor);
      const entry: Record<string, string | number> = {
        stat: axis.label,
      };
      selectedData.forEach((team, i) => {
        let val = normalized.get(team.teamNumber) ?? 0;
        if (axis.invert) val = 100 - val;
        entry[`team${i}`] = val;
      });
      return entry;
    });
  }, [selectedData, allTeams]);
}

// ── Radar chart data (prescout mode) ──

function usePrescoutRadarData(
  selectedTeams: PrescoutRankedTeam[],
  allTeams: PrescoutRankedTeam[]
) {
  return useMemo(() => {
    if (selectedTeams.length === 0 || allTeams.length === 0) return [];

    const axes: {
      label: string;
      accessor: (t: PrescoutRankedTeam) => number;
    }[] = [
      { label: "Best Auto OPR", accessor: (t) => t.bestAutoOpr },
      { label: "Best DC OPR", accessor: (t) => t.bestDcOpr },
      { label: "Season Avg", accessor: (t) => t.seasonAvg },
      { label: "Best Total OPR", accessor: (t) => t.bestOpr },
      { label: "Events", accessor: (t) => t.eventCount },
    ];

    return axes.map((axis) => {
      const values = allTeams.map(axis.accessor);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;

      const entry: Record<string, string | number> = { stat: axis.label };
      selectedTeams.forEach((team, i) => {
        entry[`team${i}`] = Math.round(((axis.accessor(team) - min) / range) * 100);
      });
      return entry;
    });
  }, [selectedTeams, allTeams]);
}

// ── Complementarity grade ──

function getComplementarityGrade(score: number): {
  grade: string;
  color: string;
  explanation: string;
} {
  if (score >= 70) {
    return {
      grade: "A",
      color: "text-emerald-400",
      explanation: "Excellent auto + DC coverage. Highly complementary.",
    };
  }
  if (score >= 50) {
    return {
      grade: "B",
      color: "text-blue-400",
      explanation: "Good complementary strengths across game phases.",
    };
  }
  if (score >= 30) {
    return {
      grade: "C",
      color: "text-amber-400",
      explanation: "Moderate overlap. Some complementary coverage.",
    };
  }
  return {
    grade: "D",
    color: "text-red-400",
    explanation: "Similar strength profiles. Limited complementary value.",
  };
}

// ── Stat comparison bar ──

interface StatBarDef {
  label: string;
  accessor: (s: TeamEventStats2025) => number;
  format?: (v: number) => string;
}

interface PrescoutStatBarDef {
  label: string;
  accessor: (t: PrescoutRankedTeam) => number;
  format?: (v: number) => string;
}

const STAT_GROUPS: { title: string; stats: StatBarDef[] }[] = [
  {
    title: "Auto",
    stats: [
      { label: "Auto Avg", accessor: (s) => s.avg.autoPoints },
      { label: "Artifact Avg", accessor: (s) => s.avg.autoArtifactPoints },
      { label: "Pattern Avg", accessor: (s) => s.avg.autoPatternPoints },
      { label: "Auto OPR", accessor: (s) => s.opr.autoPoints },
    ],
  },
  {
    title: "Driver-Controlled",
    stats: [
      { label: "DC Avg", accessor: (s) => s.avg.dcPoints },
      { label: "Artifact Avg", accessor: (s) => s.avg.dcArtifactPoints },
      { label: "Base Avg", accessor: (s) => s.avg.dcBasePoints },
      { label: "Pattern Avg", accessor: (s) => s.avg.dcPatternPoints },
      { label: "DC OPR", accessor: (s) => s.opr.dcPoints },
    ],
  },
  {
    title: "Overall",
    stats: [
      { label: "Total Avg", accessor: (s) => s.avg.totalPointsNp },
      { label: "Total OPR", accessor: (s) => s.opr.totalPointsNp },
      { label: "RP", accessor: (s) => s.rp },
      { label: "Wins", accessor: (s) => s.wins },
      {
        label: "Consistency",
        accessor: (s) => s.dev.totalPointsNp,
        format: (v) => `${v.toFixed(1)} dev`,
      },
    ],
  },
];

const PRESCOUT_STAT_GROUPS: { title: string; stats: PrescoutStatBarDef[] }[] = [
  {
    title: "Auto",
    stats: [
      { label: "Best Auto OPR", accessor: (t) => t.bestAutoOpr },
      { label: "Season Auto Avg", accessor: (t) => t.seasonAutoAvg },
    ],
  },
  {
    title: "Driver-Controlled",
    stats: [
      { label: "Best DC OPR", accessor: (t) => t.bestDcOpr },
      { label: "Season DC Avg", accessor: (t) => t.seasonDcAvg },
    ],
  },
  {
    title: "Overall",
    stats: [
      { label: "Best Total OPR", accessor: (t) => t.bestOpr },
      { label: "Season Avg", accessor: (t) => t.seasonAvg },
      { label: "Avg RP", accessor: (t) => t.avgRp },
      { label: "Wins", accessor: (t) => t.record.wins },
      { label: "Events", accessor: (t) => t.eventCount },
    ],
  },
];

function StatComparisonBar({
  stat,
  teams,
}: {
  stat: StatBarDef;
  teams: ProcessedTeam[];
}) {
  const values = teams.map((t) => stat.accessor(t.stats));
  const maxVal = Math.max(...values, 0.01);
  const isConsistency = stat.label === "Consistency";

  return (
    <div className="py-2">
      <p className="text-xs text-zinc-500 mb-1.5">{stat.label}</p>
      <div className="space-y-1">
        {teams.map((team, i) => {
          const val = values[i];
          const pct = (val / maxVal) * 100;
          const isBest = isConsistency
            ? val === Math.min(...values)
            : val === Math.max(...values);
          const color = TEAM_COLORS[i];

          return (
            <div key={team.teamNumber} className="flex items-center gap-2">
              <div className="w-32 flex-1 h-5 bg-zinc-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: color.stroke,
                    opacity: isBest ? 1 : 0.5,
                  }}
                />
              </div>
              <span
                className={`font-mono text-xs w-16 text-right shrink-0 ${
                  isBest ? "text-white font-medium" : "text-zinc-500"
                }`}
              >
                {stat.format ? stat.format(val) : val.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrescoutStatComparisonBar({
  stat,
  teams,
}: {
  stat: PrescoutStatBarDef;
  teams: PrescoutRankedTeam[];
}) {
  const values = teams.map((t) => stat.accessor(t));
  const maxVal = Math.max(...values, 0.01);

  return (
    <div className="py-2">
      <p className="text-xs text-zinc-500 mb-1.5">{stat.label}</p>
      <div className="space-y-1">
        {teams.map((team, i) => {
          const val = values[i];
          const pct = (val / maxVal) * 100;
          const isBest = val === Math.max(...values);
          const color = TEAM_COLORS[i];

          return (
            <div key={team.teamNumber} className="flex items-center gap-2">
              <div className="w-32 flex-1 h-5 bg-zinc-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: color.stroke,
                    opacity: isBest ? 1 : 0.5,
                  }}
                />
              </div>
              <span
                className={`font-mono text-xs w-16 text-right shrink-0 ${
                  isBest ? "text-white font-medium" : "text-zinc-500"
                }`}
              >
                {stat.format ? stat.format(val) : val.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared match history ──

interface SharedMatch {
  matchId: number;
  sameAlliance: boolean;
  teams: {
    teamNumber: number;
    alliance: string;
    totalPointsNp: number;
    autoPoints: number;
    dcPoints: number;
    won: boolean;
  }[];
}

function getSharedMatches(
  teamNumbers: number[],
  matches: Match[]
): SharedMatch[] {
  const shared: SharedMatch[] = [];

  for (const m of matches) {
    if (!m.hasBeenPlayed || !m.scores?.red || !m.scores?.blue) continue;

    const participations = teamNumbers
      .map((num) => m.teams.find((t) => t.teamNumber === num))
      .filter((p) => p !== undefined);

    if (participations.length < 2) continue;

    const scores = m.scores;
    const teamResults = participations.map((p) => {
      const allianceLower = p.alliance.toLowerCase() as "red" | "blue";
      const oppositeLower = allianceLower === "red" ? "blue" : "red";
      const myScores = scores[allianceLower];
      const oppScores = scores[oppositeLower];
      return {
        teamNumber: p.teamNumber,
        alliance: p.alliance,
        totalPointsNp: myScores.totalPointsNp,
        autoPoints: myScores.autoPoints,
        dcPoints: myScores.dcPoints,
        won: myScores.totalPointsNp > oppScores.totalPointsNp,
      };
    });

    const sameAlliance =
      new Set(participations.map((p) => p.alliance)).size === 1;

    shared.push({ matchId: m.id, sameAlliance, teams: teamResults });
  }

  return shared;
}

// ── Prescout complementarity (using season best OPR) ──

function prescoutComplementarityScore(a: PrescoutRankedTeam, b: PrescoutRankedTeam): number {
  const aTotal = a.bestOpr || 1;
  const bTotal = b.bestOpr || 1;
  const aAutoRatio = a.bestAutoOpr / aTotal;
  const aDcRatio = a.bestDcOpr / aTotal;
  const bAutoRatio = b.bestAutoOpr / bTotal;
  const bDcRatio = b.bestDcOpr / bTotal;

  const autoDiff = Math.abs(aAutoRatio - bAutoRatio);
  const dcDiff = Math.abs(aDcRatio - bDcRatio);
  const profileDivergence = (autoDiff + dcDiff) / 2;

  const combinedOpr = a.bestOpr + b.bestOpr;
  const strengthBonus = Math.min(combinedOpr / 200, 1);

  const raw = profileDivergence * 0.6 + strengthBonus * 0.4;
  return Math.round(Math.min(raw * 100, 100));
}

// ── Main page ──

export default function ComparePage() {
  const { teams, event, loading, selectedTeams, toggleTeamSelection, clearSelection, isPrescout, prescoutRanking } =
    useEvent();

  // Local slot state: initialized from context selectedTeams
  const [slots, setSlots] = useState<(number | null)[]>([null, null]);

  // Escape key clears selections
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        clearSelection();
        setSlots([null, null]);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [clearSelection]);

  // Sync context selectedTeams into slots on mount / when they change
  useEffect(() => {
    const filled = selectedTeams.slice(0, MAX_SLOTS);
    const newSlots: (number | null)[] = [...filled];
    while (newSlots.length < 2) newSlots.push(null);
    setSlots(newSlots);
  }, [selectedTeams]);

  const filledSlots = slots.filter((s): s is number => s !== null);
  const selectedData = filledSlots
    .map((num) => teams.find((t) => t.teamNumber === num))
    .filter((t): t is ProcessedTeam => t !== undefined);

  const selectedPrescoutData = filledSlots
    .map((num) => prescoutRanking.find((t) => t.teamNumber === num))
    .filter((t): t is PrescoutRankedTeam => t !== undefined);

  const radarData = useRadarData(selectedData, teams);
  const prescoutRadarData = usePrescoutRadarData(selectedPrescoutData, prescoutRanking);

  const activeRadarData = isPrescout ? prescoutRadarData : radarData;
  const activeSelectedForRadar = isPrescout ? selectedPrescoutData : selectedData;

  const handleSlotSelect = (index: number, teamNumber: number) => {
    if (!selectedTeams.includes(teamNumber)) {
      toggleTeamSelection(teamNumber);
    }
    setSlots((prev) => {
      const next = [...prev];
      next[index] = teamNumber;
      return next;
    });
  };

  const handleSlotRemove = (index: number) => {
    const teamNumber = slots[index];
    if (teamNumber !== null && selectedTeams.includes(teamNumber)) {
      toggleTeamSelection(teamNumber);
    }
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      while (next.length > 2 && next[next.length - 1] === null) {
        next.pop();
      }
      return next;
    });
  };

  const addSlot = () => {
    if (slots.length < MAX_SLOTS) {
      setSlots((prev) => [...prev, null]);
    }
  };

  const sharedMatches = useMemo(
    () =>
      event && filledSlots.length >= 2 && !isPrescout
        ? getSharedMatches(filledSlots, event.matches)
        : [],
    [event, filledSlots, isPrescout]
  );

  const compScore =
    selectedData.length === 2 && !isPrescout
      ? complementarityScore(selectedData[0].stats, selectedData[1].stats)
      : selectedPrescoutData.length === 2 && isPrescout
        ? prescoutComplementarityScore(selectedPrescoutData[0], selectedPrescoutData[1])
        : null;
  const compGrade = compScore !== null ? getComplementarityGrade(compScore) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <EventLoader />
      <PrescoutBanner />

      <div className="flex-1 p-6">
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 space-y-2">
                  <div className="skeleton h-4 w-16" />
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton h-3 w-24" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="skeleton h-64 rounded-xl" />
              <div className="skeleton h-64 rounded-xl lg:col-span-2" />
            </div>
          </div>
        )}

        {!event && !loading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">Compare Teams</h2>
            <p className="text-sm text-zinc-500">Load an event, then select teams to compare</p>
            <p className="text-xs text-zinc-600 mt-3">
              Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">Esc</kbd> to clear selections
            </p>
          </div>
        )}

        {event && !loading && (
          <div className="space-y-6">
            {/* Team slots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-zinc-200">
                  Compare Teams
                  {isPrescout && <span className="text-xs text-blue-400 ml-2 font-normal">Season Data</span>}
                </h2>
                {slots.length < MAX_SLOTS && (
                  <button
                    onClick={addSlot}
                    className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add team
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {slots.map((slot, i) => (
                  <TeamSlot
                    key={i}
                    index={i}
                    team={
                      slot !== null
                        ? teams.find((t) => t.teamNumber === slot) ?? null
                        : null
                    }
                    allTeams={teams.filter(
                      (t) => !filledSlots.includes(t.teamNumber)
                    )}
                    onSelect={(num) => handleSlotSelect(i, num)}
                    onRemove={() => handleSlotRemove(i)}
                    isPrescout={isPrescout}
                    prescoutTeam={
                      slot !== null
                        ? prescoutRanking.find((t) => t.teamNumber === slot) ?? null
                        : null
                    }
                  />
                ))}
              </div>
            </div>

            {((isPrescout ? selectedPrescoutData.length : selectedData.length) < 2) && (
              <div className="text-center py-16 text-zinc-500">
                <p className="text-sm">
                  Select at least 2 teams above to see the comparison.
                  <br />
                  <span className="text-zinc-600">
                    You can also add teams from the Leaderboard using the +
                    buttons.
                  </span>
                </p>
              </div>
            )}

            {(isPrescout ? selectedPrescoutData.length : selectedData.length) >= 2 && (
              <>
                {/* Complementarity card + radar in a row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Complementarity */}
                  {compGrade && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                        Complementarity
                      </p>
                      <p className={`text-5xl font-bold ${compGrade.color} mb-1`}>
                        {compGrade.grade}
                      </p>
                      <p className="font-mono text-sm text-zinc-400 mb-2">
                        {compScore}/100
                      </p>
                      <p className="text-xs text-zinc-500 leading-relaxed max-w-[200px]">
                        {compGrade.explanation}
                      </p>
                      {isPrescout && (
                        <p className="text-[10px] text-zinc-600 mt-2">Based on season best OPR</p>
                      )}
                    </div>
                  )}

                  {/* Radar chart */}
                  <div
                    className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 ${
                      compGrade ? "lg:col-span-2" : "lg:col-span-3"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-zinc-200">
                        {isPrescout ? "Season Profile" : "Stat Profile"}
                      </h3>
                      <div className="flex items-center gap-4">
                        {activeSelectedForRadar.map((team, i) => (
                          <div
                            key={team.teamNumber}
                            className="flex items-center gap-1.5"
                          >
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${TEAM_COLORS[i].dot}`}
                            />
                            <span className={`text-xs ${TEAM_COLORS[i].label}`}>
                              {team.teamNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={activeRadarData} cx="50%" cy="50%" outerRadius="75%">
                          <PolarGrid stroke="#27272a" />
                          <PolarAngleAxis
                            dataKey="stat"
                            tick={{ fill: "#71717a", fontSize: 12 }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={false}
                            axisLine={false}
                          />
                          {activeSelectedForRadar.map((_, i) => (
                            <Radar
                              key={i}
                              name={`Team ${activeSelectedForRadar[i].teamNumber}`}
                              dataKey={`team${i}`}
                              stroke={TEAM_COLORS[i].stroke}
                              fill={TEAM_COLORS[i].fill}
                              strokeWidth={2}
                              dot={{
                                r: 3,
                                fill: TEAM_COLORS[i].stroke,
                                strokeWidth: 0,
                              }}
                            />
                          ))}
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              border: "1px solid #27272a",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#fafafa",
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Stat breakdown */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-zinc-200">
                      {isPrescout ? "Season Stat Breakdown" : "Stat Breakdown"}
                    </h3>
                    <div className="flex items-center gap-4">
                      {activeSelectedForRadar.map((team, i) => (
                        <div
                          key={team.teamNumber}
                          className="flex items-center gap-1.5"
                        >
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${TEAM_COLORS[i].dot}`}
                          />
                          <span
                            className={`text-xs font-mono ${TEAM_COLORS[i].label}`}
                          >
                            {team.teamNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isPrescout ? (
                    <div className="space-y-6">
                      {PRESCOUT_STAT_GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 pb-2 border-b border-zinc-800">
                            {group.title}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {group.stats.map((stat) => (
                              <PrescoutStatComparisonBar
                                key={stat.label}
                                stat={stat}
                                teams={selectedPrescoutData}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {STAT_GROUPS.map((group) => (
                        <div key={group.title}>
                          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 pb-2 border-b border-zinc-800">
                            {group.title}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                            {group.stats.map((stat) => (
                              <StatComparisonBar
                                key={stat.label}
                                stat={stat}
                                teams={selectedData}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Shared match history (live only) */}
                {!isPrescout && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-zinc-200 mb-4">
                      Shared Match History
                    </h3>
                    {sharedMatches.length === 0 ? (
                      <div className="text-center py-8">
                        <svg
                          className="w-8 h-8 text-zinc-700 mx-auto mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-zinc-600">
                          No shared matches between these teams
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                              <th className="text-left py-2 pr-4">Match</th>
                              <th className="text-left py-2 pr-4">Type</th>
                              {selectedData.map((team, i) => (
                                <th
                                  key={team.teamNumber}
                                  className="text-right py-2 pr-4"
                                >
                                  <span className={TEAM_COLORS[i].label}>
                                    {team.teamNumber}
                                  </span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sharedMatches.map((sm) => (
                              <tr
                                key={sm.matchId}
                                className="border-b border-zinc-800/30 last:border-0"
                              >
                                <td className="py-2.5 pr-4 font-mono text-zinc-400 text-xs">
                                  Q{sm.matchId}
                                </td>
                                <td className="py-2.5 pr-4">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      sm.sameAlliance
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-amber-500/15 text-amber-400"
                                    }`}
                                  >
                                    {sm.sameAlliance ? "Allies" : "Opponents"}
                                  </span>
                                </td>
                                {selectedData.map((team, i) => {
                                  const tr = sm.teams.find(
                                    (t) => t.teamNumber === team.teamNumber
                                  );
                                  if (!tr) {
                                    return (
                                      <td
                                        key={team.teamNumber}
                                        className="py-2.5 pr-4 text-right text-zinc-600 text-xs"
                                      >
                                        —
                                      </td>
                                    );
                                  }
                                  return (
                                    <td
                                      key={team.teamNumber}
                                      className="py-2.5 pr-4 text-right"
                                    >
                                      <div className="flex items-center justify-end gap-2">
                                        <span
                                          className={`inline-block w-2 h-2 rounded-full ${
                                            tr.alliance === "Red"
                                              ? "bg-red-500"
                                              : "bg-blue-500"
                                          }`}
                                        />
                                        <span className="font-mono text-xs text-zinc-200">
                                          {tr.totalPointsNp.toFixed(0)}
                                        </span>
                                        <span
                                          className={`text-xs font-medium px-1 py-0.5 rounded ${
                                            tr.won
                                              ? "bg-emerald-500/15 text-emerald-400"
                                              : "bg-red-500/15 text-red-400"
                                          }`}
                                        >
                                          {tr.won ? "W" : "L"}
                                        </span>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Prescout note about no match history */}
                {isPrescout && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                    <p className="text-sm text-zinc-500">
                      Shared match history will be available once the event starts.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
