"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useEvent } from "@/context/EventContext";
import { EventLoader, focusEventInput } from "@/components/EventLoader";
import { PrescoutBanner } from "@/components/PrescoutBanner";
import { ComparisonTray } from "@/components/ComparisonTray";
import { getWLT } from "@/lib/calculations";
import { ProcessedTeam, Match, Alliance, PrescoutRankedTeam, TeamEventEntry, TeamEventStats2025 } from "@/lib/types";
import { penaltyP75 } from "@/lib/calculations";
import { PenaltyBadge } from "@/components/PenaltyBadge";
import { NotesBadge } from "@/components/NotesBadge";
import { NoteForm } from "@/components/NoteForm";
import { useNotes } from "@/context/NotesContext";
import { tagColorClass } from "@/lib/notes";
import { useFavorites } from "@/context/FavoritesContext";
import { AddToPickListButton } from "@/components/AddToPickListButton";

// ── Tab / Column definitions (live mode) ──

type TabId = "overview" | "auto" | "dc" | "advanced";

interface ColDef {
  key: string;
  label: string;
  align: "left" | "right";
  getValue: (t: ProcessedTeam) => string | number;
  getRaw: (t: ProcessedTeam) => number | string;
  tooltip?: string;
}

function penaltyColor(avg: number): string {
  if (avg < 5) return "text-green-400";
  if (avg <= 15) return "text-yellow-400";
  return "text-red-400";
}

const SHARED_LEFT: ColDef[] = [
  {
    key: "teamNumber",
    label: "Team #",
    align: "left",
    getValue: (t) => t.teamNumber,
    getRaw: (t) => t.teamNumber,
  },
  {
    key: "name",
    label: "Name",
    align: "left",
    getValue: (t) => t.teamName,
    getRaw: (t) => t.teamName,
  },
];

const TABS: { id: TabId; label: string; columns: ColDef[] }[] = [
  {
    id: "overview",
    label: "Overview",
    columns: [
      {
        key: "rank",
        label: "Rank",
        align: "right",
        getValue: (t) => t.stats.rank,
        getRaw: (t) => t.stats.rank,
      },
      ...SHARED_LEFT,
      {
        key: "wlt",
        label: "W-L-T",
        align: "left",
        getValue: (t) => getWLT(t.stats),
        getRaw: (t) => t.stats.wins,
      },
      {
        key: "opr",
        label: "OPR",
        align: "right",
        getValue: (t) => t.stats.opr.totalPointsNp.toFixed(1),
        getRaw: (t) => t.stats.opr.totalPointsNp,
      },
      {
        key: "avgScore",
        label: "Avg Score",
        align: "right",
        getValue: (t) => t.stats.avg.totalPointsNp.toFixed(1),
        getRaw: (t) => t.stats.avg.totalPointsNp,
      },
      {
        key: "penalties",
        label: "Penalties",
        align: "right",
        tooltip: "Avg penalty points committed per match. Hover cell for major/minor breakdown.",
        getValue: (t) => (t.stats.avg.penaltyPointsCommitted ?? 0).toFixed(1),
        getRaw: (t) => t.stats.avg.penaltyPointsCommitted ?? 0,
      },
    ],
  },
  {
    id: "auto",
    label: "Auto",
    columns: [
      ...SHARED_LEFT,
      {
        key: "autoAvg",
        label: "Auto Avg",
        align: "right",
        getValue: (t) => t.stats.avg.autoPoints.toFixed(1),
        getRaw: (t) => t.stats.avg.autoPoints,
      },
      {
        key: "autoMax",
        label: "Auto Max",
        align: "right",
        getValue: (t) => t.stats.max.autoPoints.toFixed(1),
        getRaw: (t) => t.stats.max.autoPoints,
      },
      {
        key: "autoDev",
        label: "Auto Dev",
        align: "right",
        getValue: (t) => t.stats.dev.autoPoints.toFixed(1),
        getRaw: (t) => t.stats.dev.autoPoints,
      },
      {
        key: "artifactAvg",
        label: "Artifact Avg",
        align: "right",
        getValue: (t) => t.stats.avg.autoArtifactPoints.toFixed(1),
        getRaw: (t) => t.stats.avg.autoArtifactPoints,
      },
      {
        key: "patternAvg",
        label: "Pattern Avg",
        align: "right",
        getValue: (t) => t.stats.avg.autoPatternPoints.toFixed(1),
        getRaw: (t) => t.stats.avg.autoPatternPoints,
      },
    ],
  },
  {
    id: "dc",
    label: "Driver-Controlled",
    columns: [
      ...SHARED_LEFT,
      {
        key: "dcAvg",
        label: "DC Avg",
        align: "right",
        getValue: (t) => t.stats.avg.dcPoints.toFixed(1),
        getRaw: (t) => t.stats.avg.dcPoints,
      },
      {
        key: "dcMax",
        label: "DC Max",
        align: "right",
        getValue: (t) => t.stats.max.dcPoints.toFixed(1),
        getRaw: (t) => t.stats.max.dcPoints,
      },
      {
        key: "dcDev",
        label: "DC Dev",
        align: "right",
        getValue: (t) => t.stats.dev.dcPoints.toFixed(1),
        getRaw: (t) => t.stats.dev.dcPoints,
      },
      {
        key: "dcArtifact",
        label: "Artifact Avg",
        align: "right",
        getValue: (t) => t.stats.avg.dcArtifactPoints.toFixed(1),
        getRaw: (t) => t.stats.avg.dcArtifactPoints,
      },
      {
        key: "dcBase",
        label: "Base Avg",
        align: "right",
        getValue: (t) => t.stats.avg.dcBasePoints.toFixed(1),
        getRaw: (t) => t.stats.avg.dcBasePoints,
      },
      {
        key: "dcPattern",
        label: "Pattern Avg",
        align: "right",
        getValue: (t) => t.stats.avg.dcPatternPoints.toFixed(1),
        getRaw: (t) => t.stats.avg.dcPatternPoints,
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    columns: [
      ...SHARED_LEFT,
      {
        key: "totalOpr",
        label: "Total OPR",
        align: "right",
        getValue: (t) => t.stats.opr.totalPointsNp.toFixed(1),
        getRaw: (t) => t.stats.opr.totalPointsNp,
      },
      {
        key: "autoOpr",
        label: "Auto OPR",
        align: "right",
        getValue: (t) => t.stats.opr.autoPoints.toFixed(1),
        getRaw: (t) => t.stats.opr.autoPoints,
      },
      {
        key: "dcOpr",
        label: "DC OPR",
        align: "right",
        getValue: (t) => t.stats.opr.dcPoints.toFixed(1),
        getRaw: (t) => t.stats.opr.dcPoints,
      },
      {
        key: "rp",
        label: "RP",
        align: "right",
        getValue: (t) => t.stats.rp.toFixed(1),
        getRaw: (t) => t.stats.rp,
      },
      {
        key: "movementRp",
        label: "Move RP%",
        align: "right",
        getValue: (t) =>
          `${((t.stats.avg.movementRp ?? 0) * 100).toFixed(0)}%`,
        getRaw: (t) => t.stats.avg.movementRp ?? 0,
      },
      {
        key: "goalRp",
        label: "Goal RP%",
        align: "right",
        getValue: (t) =>
          `${((t.stats.avg.goalRp ?? 0) * 100).toFixed(0)}%`,
        getRaw: (t) => t.stats.avg.goalRp ?? 0,
      },
      {
        key: "patternRp",
        label: "Pattern RP%",
        align: "right",
        getValue: (t) =>
          `${((t.stats.avg.patternRp ?? 0) * 100).toFixed(0)}%`,
        getRaw: (t) => t.stats.avg.patternRp ?? 0,
      },
      {
        key: "penalties",
        label: "Penalties",
        align: "right",
        tooltip: "Avg penalty points committed per match. Hover cell for major/minor breakdown.",
        getValue: (t) => (t.stats.avg.penaltyPointsCommitted ?? 0).toFixed(1),
        getRaw: (t) => t.stats.avg.penaltyPointsCommitted ?? 0,
      },
    ],
  },
];

const TAB_ORDER: TabId[] = ["overview", "auto", "dc", "advanced"];

// ── Prescout Tab / Column definitions ──

interface PrescoutColDef {
  key: string;
  label: string;
  align: "left" | "right";
  tooltip?: string;
  getValue: (t: PrescoutRankedTeam) => string | number;
  getRaw: (t: PrescoutRankedTeam) => number | string;
}

const PS_SHARED_LEFT: PrescoutColDef[] = [
  { key: "teamNumber", label: "Team #", align: "left", getValue: (t) => t.teamNumber, getRaw: (t) => t.teamNumber },
  { key: "name", label: "Name", align: "left", getValue: (t) => t.teamName, getRaw: (t) => t.teamName },
];

const TREND_LABEL: Record<string, string> = {
  improving: "\u2191",
  declining: "\u2193",
  stable: "\u2192",
};

const PRESCOUT_TABS: { id: TabId; label: string; columns: PrescoutColDef[] }[] = [
  {
    id: "overview",
    label: "Overview",
    columns: [
      { key: "rank", label: "Rank", align: "right", getValue: (t) => t.rank, getRaw: (t) => t.rank },
      ...PS_SHARED_LEFT,
      { key: "wlt", label: "Season W-L-T", align: "left", getValue: (t) => `${t.record.wins}-${t.record.losses}-${t.record.ties}`, getRaw: (t) => t.record.wins },
      { key: "bestOpr", label: "Best OPR", align: "right", getValue: (t) => t.bestOpr.toFixed(1), getRaw: (t) => t.bestOpr },
      { key: "seasonAvg", label: "Season Avg", align: "right", getValue: (t) => t.seasonAvg.toFixed(1), getRaw: (t) => t.seasonAvg },
      { key: "eventCount", label: "Events", align: "right", getValue: (t) => t.eventCount, getRaw: (t) => t.eventCount },
      { key: "trend", label: "Trend", align: "right", getValue: (t) => TREND_LABEL[t.trend], getRaw: (t) => t.trend === "improving" ? 2 : t.trend === "stable" ? 1 : 0 },
    ],
  },
  {
    id: "auto",
    label: "Auto",
    columns: [
      ...PS_SHARED_LEFT,
      { key: "bestAutoOpr", label: "Best Auto OPR", align: "right", getValue: (t) => t.bestAutoOpr.toFixed(1), getRaw: (t) => t.bestAutoOpr },
      { key: "seasonAutoAvg", label: "Season Auto Avg", align: "right", getValue: (t) => t.seasonAutoAvg.toFixed(1), getRaw: (t) => t.seasonAutoAvg },
      { key: "trend", label: "Trend", align: "right", getValue: (t) => TREND_LABEL[t.trend], getRaw: (t) => t.trend === "improving" ? 2 : t.trend === "stable" ? 1 : 0 },
    ],
  },
  {
    id: "dc",
    label: "Driver-Controlled",
    columns: [
      ...PS_SHARED_LEFT,
      { key: "bestDcOpr", label: "Best DC OPR", align: "right", getValue: (t) => t.bestDcOpr.toFixed(1), getRaw: (t) => t.bestDcOpr },
      { key: "seasonDcAvg", label: "Season DC Avg", align: "right", getValue: (t) => t.seasonDcAvg.toFixed(1), getRaw: (t) => t.seasonDcAvg },
      { key: "trend", label: "Trend", align: "right", getValue: (t) => TREND_LABEL[t.trend], getRaw: (t) => t.trend === "improving" ? 2 : t.trend === "stable" ? 1 : 0 },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    columns: [
      ...PS_SHARED_LEFT,
      { key: "bestOpr", label: "Best Total OPR", align: "right", getValue: (t) => t.bestOpr.toFixed(1), getRaw: (t) => t.bestOpr },
      { key: "bestAutoOpr", label: "Best Auto OPR", align: "right", getValue: (t) => t.bestAutoOpr.toFixed(1), getRaw: (t) => t.bestAutoOpr },
      { key: "bestDcOpr", label: "Best DC OPR", align: "right", getValue: (t) => t.bestDcOpr.toFixed(1), getRaw: (t) => t.bestDcOpr },
      { key: "avgRp", label: "Avg RP", align: "right", getValue: (t) => t.avgRp.toFixed(1), getRaw: (t) => t.avgRp },
      { key: "avgMovementRp", label: "Move RP%", align: "right", getValue: (t) => `${(t.avgMovementRp * 100).toFixed(0)}%`, getRaw: (t) => t.avgMovementRp },
      { key: "avgGoalRp", label: "Goal RP%", align: "right", getValue: (t) => `${(t.avgGoalRp * 100).toFixed(0)}%`, getRaw: (t) => t.avgGoalRp },
      { key: "avgPatternRp", label: "Pattern RP%", align: "right", getValue: (t) => `${(t.avgPatternRp * 100).toFixed(0)}%`, getRaw: (t) => t.avgPatternRp },
    ],
  },
];

// ── Skeleton ──

function SkeletonTable() {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="skeleton h-10 w-full rounded-xl" />
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

// ── Helper: get a team's match history ──

interface MatchResult {
  matchId: number;
  alliance: Alliance;
  totalPointsNp: number;
  autoPoints: number;
  dcPoints: number;
  won: boolean;
}

function getTeamMatches(
  teamNumber: number,
  matches: Match[]
): MatchResult[] {
  const results: MatchResult[] = [];
  for (const m of matches) {
    if (!m.hasBeenPlayed || !m.scores?.red || !m.scores?.blue) continue;
    const participation = m.teams.find((t) => t.teamNumber === teamNumber);
    if (!participation) continue;

    const alliance = participation.alliance;
    const allianceLower = alliance.toLowerCase() as "red" | "blue";
    const oppositeLower = allianceLower === "red" ? "blue" : "red";
    const myScores = m.scores[allianceLower];
    const oppScores = m.scores[oppositeLower];

    results.push({
      matchId: m.id,
      alliance,
      totalPointsNp: myScores.totalPointsNp,
      autoPoints: myScores.autoPoints,
      dcPoints: myScores.dcPoints,
      won: myScores.totalPointsNp > oppScores.totalPointsNp,
    });
  }
  return results;
}

// ── Prescout Expanded Detail (sparkline of OPR across events) ──

function PrescoutExpandedDetail({ team }: { team: PrescoutRankedTeam }) {
  const validEvents = team.events
    .filter((e): e is TeamEventEntry & { stats: TeamEventStats2025 } => e.stats !== null)
    .sort((a, b) => new Date(a.event.start).getTime() - new Date(b.event.start).getTime());

  if (validEvents.length === 0) {
    return (
      <>
        <p className="text-sm text-zinc-500">No event data available.</p>
        <InlineNotesSection teamNumber={team.teamNumber} />
      </>
    );
  }

  const sparkData = validEvents.map((e, i) => ({
    event: i + 1,
    opr: e.stats.opr.totalPointsNp,
    name: e.event.name,
  }));

  return (
    <>
    <div className="flex gap-6 flex-col lg:flex-row">
      {/* Sparkline */}
      <div className="lg:w-64 shrink-0">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          OPR Trend (Season)
        </p>
        <div className="h-24 bg-zinc-900/50 rounded-lg p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="opr"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#fafafa",
                  padding: "4px 8px",
                }}
                formatter={(value) => [`${value}`, "OPR"]}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]?.payload?.name) return payload[0].payload.name;
                  return `Event`;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Event history table */}
      <div className="flex-1 overflow-x-auto">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Event History
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-wider border-b border-zinc-800/50">
              <th className="text-left py-1.5 pr-3">Event</th>
              <th className="text-right py-1.5 pr-3">Rank</th>
              <th className="text-left py-1.5 pr-3">W-L-T</th>
              <th className="text-right py-1.5 pr-3">OPR</th>
              <th className="text-right py-1.5 pr-3">Avg</th>
            </tr>
          </thead>
          <tbody>
            {validEvents.map((e) => (
              <tr key={e.eventCode} className="border-b border-zinc-800/30 last:border-0">
                <td className="py-1.5 pr-3 text-zinc-400 truncate max-w-[200px]">
                  {e.event.name}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">
                  #{e.stats.rank}
                </td>
                <td className="py-1.5 pr-3 font-mono text-zinc-400">
                  {e.stats.wins}-{e.stats.losses}-{e.stats.ties}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-zinc-200">
                  {e.stats.opr.totalPointsNp.toFixed(1)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">
                  {e.stats.avg.totalPointsNp.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <InlineNotesSection teamNumber={team.teamNumber} />
    </>
  );
}

// ── Main page ──

export default function LeaderboardPage() {
  const { teams, event, loading, selectedTeams, toggleTeamSelection, isPrescout, prescoutRanking, prescoutLoading } =
    useEvent();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sortKey, setSortKey] = useState<string>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [hasNotesFilter, setHasNotesFilter] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { teamHasNotes, exportNotes, importNotes } = useNotes();
  const { isTeamFavorited, toggleTeamFav } = useFavorites();
  const importInputRef = useRef<HTMLInputElement>(null);

  const currentTab = TABS.find((t) => t.id === activeTab)!;
  const columns = currentTab.columns;

  const currentPsTab = PRESCOUT_TABS.find((t) => t.id === activeTab)!;
  const psColumns = currentPsTab.columns;

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 150);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key >= "1" && e.key <= "4" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < TAB_ORDER.length) handleTabChange(TAB_ORDER[idx]);
      }

      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        focusEventInput();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live mode filtering/sorting ──
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return teams.filter((t) => {
      if (q && !t.teamNumber.toString().includes(q) && !t.teamName.toLowerCase().includes(q)) return false;
      if (hasNotesFilter && !teamHasNotes(t.teamNumber)) return false;
      return true;
    });
  }, [teams, debouncedSearch, hasNotesFilter, teamHasNotes]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.getRaw(a);
      const bv = col.getRaw(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      const sa = String(av);
      const sb = String(bv);
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filtered, sortKey, sortAsc, columns]);

  // ── Prescout mode filtering/sorting ──
  const psFiltered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return prescoutRanking.filter((t) => {
      if (q && !t.teamNumber.toString().includes(q) && !t.teamName.toLowerCase().includes(q)) return false;
      if (hasNotesFilter && !teamHasNotes(t.teamNumber)) return false;
      return true;
    });
  }, [prescoutRanking, debouncedSearch, hasNotesFilter, teamHasNotes]);

  const psSorted = useMemo(() => {
    const col = psColumns.find((c) => c.key === sortKey);
    if (!col) return psFiltered;
    return [...psFiltered].sort((a, b) => {
      const av = col.getRaw(a);
      const bv = col.getRaw(b);
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      const sa = String(av);
      const sb = String(bv);
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [psFiltered, sortKey, sortAsc, psColumns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "rank");
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSortKey(tab === "overview" ? "rank" : "teamNumber");
    setSortAsc(true);
    setExpandedTeam(null);
  };

  const penaltyThreshold = useMemo(() => penaltyP75(teams), [teams]);

  const isNumericCol = (key: string) =>
    key !== "name" && key !== "wlt" && key !== "trend";

  const tabDefs = isPrescout ? PRESCOUT_TABS : TABS;
  const displayData = isPrescout ? psSorted : sorted;
  const displayColumns = isPrescout ? psColumns : columns;

  return (
    <div className="min-h-screen flex flex-col">
      <EventLoader />
      <PrescoutBanner />

      <div className="flex-1 p-4 sm:p-6 pb-24">
        {(loading || (isPrescout && prescoutLoading)) && <SkeletonTable />}

        {!event && !loading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">Leaderboard</h2>
            <p className="text-sm text-zinc-500">Load an event to see team rankings</p>
            <p className="text-xs text-zinc-600 mt-3">
              Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">1</kbd>-<kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono">4</kbd> to switch tabs
            </p>
          </div>
        )}

        {event && !loading && !(isPrescout && prescoutLoading) && (
          <div className="space-y-4">
            {/* Tab bar */}
            <div data-tutorial="stat-tabs" className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 overflow-x-auto">
              {tabDefs.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split("-")[0]}</span>
                  <span className="ml-1.5 text-xs text-zinc-600 hidden lg:inline">{i + 1}</span>
                </button>
              ))}
            </div>

            {/* Search + filter row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Filter by team # or name..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white
                    placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700
                    focus:ring-1 focus:ring-zinc-700/50 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setDebouncedSearch(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Has Notes toggle */}
              <button
                onClick={() => setHasNotesFilter((f) => !f)}
                title={hasNotesFilter ? "Show all teams" : "Show only teams with notes"}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                  hasNotesFilter
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 5.5A2.5 2.5 0 014.5 3h15A2.5 2.5 0 0122 5.5v10A2.5 2.5 0 0119.5 18H13l-4 3v-3H4.5A2.5 2.5 0 012 15.5v-10z" />
                </svg>
                <span className="hidden sm:inline">Has Notes</span>
              </button>

              {/* Export notes */}
              {event && (
                <button
                  onClick={exportNotes}
                  title="Export scout notes as JSON"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-zinc-500 border border-zinc-800 bg-zinc-900 hover:text-zinc-300 transition-colors whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}

              {/* Import notes */}
              {event && (
                <>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (typeof ev.target?.result === "string") {
                          importNotes(ev.target.result);
                        }
                      };
                      reader.readAsText(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => importInputRef.current?.click()}
                    title="Import scout notes from JSON"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm text-zinc-500 border border-zinc-800 bg-zinc-900 hover:text-zinc-300 transition-colors whitespace-nowrap"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="hidden sm:inline">Import</span>
                  </button>
                </>
              )}
            </div>

            {/* Results count */}
            <p className="text-xs text-zinc-600">
              {displayData.length} team{displayData.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
              {isPrescout && " \u00b7 Season data"}
            </p>

            {/* Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {!isPrescout && <th className="w-20 px-3 py-3 sticky left-0 bg-zinc-900 z-20" />}
                      {displayColumns.map((col) => {
                        const isSorted = sortKey === col.key;
                        const isSticky = col.key === "teamNumber" && !isPrescout;
                        return (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            title={col.tooltip}
                            className={`px-3 py-3 text-xs font-medium uppercase tracking-wider cursor-pointer select-none transition-colors whitespace-nowrap ${
                              col.align === "right" ? "text-right" : "text-left"
                            } ${
                              isSorted
                                ? "text-[var(--accent)] bg-[var(--accent)]/5"
                                : "text-zinc-500 hover:text-zinc-300"
                            } ${
                              isSticky ? "sticky left-10 bg-zinc-900 z-20" : ""
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {isSorted && (
                                <svg
                                  className={`w-3 h-3 transition-transform ${sortAsc ? "" : "rotate-180"}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                </svg>
                              )}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {isPrescout ? (
                      // Prescout rows
                      (psSorted as PrescoutRankedTeam[]).map((team, i) => {
                        const isExpanded = expandedTeam === team.teamNumber;
                        return (
                          <Fragment key={team.teamNumber}>
                            <tr
                              onClick={() => setExpandedTeam(isExpanded ? null : team.teamNumber)}
                              className={`border-b border-zinc-800/50 cursor-pointer transition-colors duration-100 ${
                                i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/60"
                              } hover:bg-zinc-800/70`}
                            >
                              {psColumns.map((col) => {
                                const isSorted = sortKey === col.key;
                                const trendColors: Record<string, string> = {
                                  "\u2191": "text-emerald-400",
                                  "\u2193": "text-red-400",
                                  "\u2192": "text-zinc-400",
                                };
                                const val = col.getValue(team);
                                const isTrend = col.key === "trend";
                                return (
                                  <td
                                    key={col.key}
                                    className={`px-3 py-2.5 whitespace-nowrap ${
                                      col.align === "right" ? "text-right" : "text-left"
                                    } ${isSorted ? "bg-[var(--accent)]/5" : ""} ${
                                      col.key === "teamNumber" ? "font-mono text-white font-medium" : ""
                                    } ${col.key === "name" ? "text-zinc-400 max-w-[200px] truncate" : "text-zinc-200"
                                    } ${isNumericCol(col.key) && col.key !== "teamNumber" ? "font-mono" : ""
                                    } ${isTrend ? (trendColors[String(val)] ?? "text-zinc-400") : ""}`}
                                  >
                                    {col.key === "teamNumber" ? (
                                      <Link href={`/report/${team.teamNumber}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                        {val}
                                      </Link>
                                    ) : col.key === "name" ? (
                                      <span className="inline-flex items-center gap-1">
                                        {val}
                                        <NotesBadge teamNumber={team.teamNumber} />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleTeamFav({ team_number: team.teamNumber, team_name: team.teamName, notes: null });
                                          }}
                                          title={isTeamFavorited(team.teamNumber) ? "Remove from watched" : "Add to watched"}
                                          className="ml-0.5"
                                        >
                                          <svg
                                            className={`w-3.5 h-3.5 ${
                                              isTeamFavorited(team.teamNumber)
                                                ? "text-amber-400 fill-amber-400"
                                                : "text-zinc-600 hover:text-amber-400"
                                            }`}
                                            fill={isTeamFavorited(team.teamNumber) ? "currentColor" : "none"}
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                          </svg>
                                        </button>
                                        <AddToPickListButton
                                          team={{ teamNumber: team.teamNumber, teamName: team.teamName, opr: team.bestOpr }}
                                          size="xs"
                                        />
                                      </span>
                                    ) : val}
                                  </td>
                                );
                              })}
                            </tr>
                            {isExpanded && (
                              <tr className="bg-zinc-800/30">
                                <td colSpan={psColumns.length} className="px-4 py-4">
                                  <PrescoutExpandedDetail team={team} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    ) : (
                      // Live rows
                      sorted.map((team, i) => {
                        const isSelected = selectedTeams.includes(team.teamNumber);
                        const isExpanded = expandedTeam === team.teamNumber;
                        return (
                          <Fragment key={team.teamNumber}>
                            <tr
                              onClick={() =>
                                setExpandedTeam(isExpanded ? null : team.teamNumber)
                              }
                              className={`border-b border-zinc-800/50 cursor-pointer transition-colors duration-100 ${
                                isSelected
                                  ? "bg-[var(--accent)]/5"
                                  : i % 2 === 0
                                    ? "bg-zinc-900"
                                    : "bg-zinc-900/60"
                              } hover:bg-zinc-800/70`}
                            >
                              <td className="px-3 py-2.5 sticky left-0 bg-zinc-900 z-10">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTeamSelection(team.teamNumber);
                                    }}
                                    title={isSelected ? "Remove from compare" : "Add to compare"}
                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150 text-xs ${
                                      isSelected
                                        ? "bg-[var(--accent)] text-white"
                                        : "bg-zinc-800 border border-zinc-700 text-zinc-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                    }`}
                                  >
                                    {isSelected ? (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                      </svg>
                                    )}
                                  </button>
                                  <Link
                                    href={`/report/${team.teamNumber}`}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Team Report"
                                    className="w-6 h-6 rounded-md flex items-center justify-center bg-zinc-800 border border-zinc-700
                                      text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-all duration-150"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                  </Link>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTeamFav({ team_number: team.teamNumber, team_name: team.teamName, notes: null });
                                    }}
                                    title={isTeamFavorited(team.teamNumber) ? "Remove from watched" : "Add to watched"}
                                    className="w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150"
                                  >
                                    <svg
                                      className={`w-3.5 h-3.5 ${
                                        isTeamFavorited(team.teamNumber)
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-zinc-500 hover:text-amber-400"
                                      }`}
                                      fill={isTeamFavorited(team.teamNumber) ? "currentColor" : "none"}
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                    </svg>
                                  </button>
                                  <AddToPickListButton
                                    team={{ teamNumber: team.teamNumber, teamName: team.teamName, opr: team.stats.opr.totalPointsNp }}
                                    size="sm"
                                  />
                                </div>
                              </td>
                              {columns.map((col) => {
                                const isSorted = sortKey === col.key;
                                const isSticky = col.key === "teamNumber";
                                return (
                                  <td
                                    key={col.key}
                                    className={`px-3 py-2.5 whitespace-nowrap ${
                                      col.align === "right"
                                        ? "text-right"
                                        : "text-left"
                                    } ${
                                      isSticky
                                        ? "sticky left-10 bg-zinc-900 z-10 font-mono text-white font-medium"
                                        : ""
                                    } ${
                                      isSorted ? "bg-[var(--accent)]/5" : ""
                                    } ${
                                      isNumericCol(col.key) && !isSticky
                                        ? "font-mono"
                                        : ""
                                    } ${
                                      col.key === "name"
                                        ? "text-zinc-400 max-w-[200px] truncate"
                                        : "text-zinc-200"
                                    }`}
                                  >
                                    {col.key === "name" ? (
                                      <span className="inline-flex items-center gap-1">
                                        {col.getValue(team)}
                                        <PenaltyBadge
                                          avg={team.stats.avg.penaltyPointsCommitted ?? 0}
                                          threshold={penaltyThreshold}
                                        />
                                        <NotesBadge teamNumber={team.teamNumber} />
                                      </span>
                                    ) : col.key === "penalties" ? (
                                      <span
                                        className={penaltyColor(team.stats.avg.penaltyPointsCommitted ?? 0)}
                                        title={`${(team.stats.avg.majorsCommittedPoints ?? 0).toFixed(1)} major avg, ${(team.stats.avg.minorsCommittedPoints ?? 0).toFixed(1)} minor avg`}
                                      >
                                        {col.getValue(team)}
                                      </span>
                                    ) : col.getValue(team)}
                                  </td>
                                );
                              })}
                            </tr>

                            {isExpanded && event && (
                              <tr className="bg-zinc-800/30">
                                <td
                                  colSpan={columns.length + 1}
                                  className="px-4 py-4"
                                >
                                  <ExpandedDetail
                                    team={team}
                                    matches={event.matches}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {displayData.length === 0 && (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  {search
                    ? `No teams matching "${search}"`
                    : "No team data available"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ComparisonTray />
    </div>
  );
}

// ── Inline notes section (used in both expanded panels) ──

function InlineNotesSection({ teamNumber }: { teamNumber: number }) {
  const { notesForTeam, deleteNote } = useNotes();
  const [formOpen, setFormOpen] = useState(false);
  const teamNotes = notesForTeam(teamNumber);

  return (
    <div className="mt-4 pt-3 border-t border-zinc-800/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Scout Notes {teamNotes.length > 0 && `(${teamNotes.length})`}
        </p>
        {!formOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); setFormOpen(true); }}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-[var(--accent)] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Note
          </button>
        )}
      </div>
      {formOpen && (
        <div className="mb-3">
          <NoteForm teamNumber={teamNumber} onClose={() => setFormOpen(false)} />
        </div>
      )}
      {teamNotes.length > 0 && (
        <div className="space-y-1.5">
          {teamNotes.map((note) => (
            <div key={note.id} className="bg-zinc-900/60 rounded-lg px-2.5 py-2 group/note">
              {note.text && (
                <p className="text-xs text-zinc-300 mb-1.5">{note.text}</p>
              )}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {note.tags.map((tag) => (
                    <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${tagColorClass(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-600">
                  {new Date(note.timestamp).toLocaleString(undefined, {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                  className="text-[10px] text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover/note:opacity-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expanded row detail (live mode) ──

function ExpandedDetail({
  team,
  matches,
}: {
  team: ProcessedTeam;
  matches: Match[];
}) {
  const results = getTeamMatches(team.teamNumber, matches);

  if (results.length === 0) {
    return (
      <>
        <p className="text-sm text-zinc-500">No match data available.</p>
        <InlineNotesSection teamNumber={team.teamNumber} />
      </>
    );
  }

  const sparkData = results.map((r, i) => ({
    match: i + 1,
    score: r.totalPointsNp,
  }));

  return (
    <>
    <div className="flex gap-6 flex-col lg:flex-row">
      {/* Sparkline */}
      <div className="lg:w-64 shrink-0">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Score Trend
        </p>
        <div className="h-24 bg-zinc-900/50 rounded-lg p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#fafafa",
                  padding: "4px 8px",
                }}
                formatter={(value) => [`${value}`, "Score"]}
                labelFormatter={(label) => `Match ${label}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Match results table */}
      <div className="flex-1 overflow-x-auto">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Match Results
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-wider border-b border-zinc-800/50">
              <th className="text-left py-1.5 pr-3">Match</th>
              <th className="text-left py-1.5 pr-3">Alliance</th>
              <th className="text-right py-1.5 pr-3">Total</th>
              <th className="text-right py-1.5 pr-3">Auto</th>
              <th className="text-right py-1.5 pr-3">DC</th>
              <th className="text-left py-1.5">Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.matchId}
                className="border-b border-zinc-800/30 last:border-0"
              >
                <td className="py-1.5 pr-3 font-mono text-zinc-400">
                  Q{r.matchId}
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                      r.alliance === "Red" ? "bg-red-500" : "bg-blue-500"
                    }`}
                  />
                  <span className="text-zinc-400">{r.alliance}</span>
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-zinc-200">
                  {r.totalPointsNp.toFixed(0)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">
                  {r.autoPoints.toFixed(0)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">
                  {r.dcPoints.toFixed(0)}
                </td>
                <td className="py-1.5">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      r.won
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {r.won ? "W" : "L"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <InlineNotesSection teamNumber={team.teamNumber} />
    </>
  );
}
