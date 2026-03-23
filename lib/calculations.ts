import {
  TeamEventStats2025,
  TeamEventStats2025Group,
  ProcessedTeam,
  TeamEventEntry,
  PrescoutTeamData,
  PrescoutRankedTeam,
  TrendDirection,
} from "./types";

/**
 * Format wins/losses/ties as a string like "5-2-0"
 */
export function getWLT(stats: TeamEventStats2025): string {
  return `${stats.wins}-${stats.losses}-${stats.ties}`;
}

/**
 * Interpret standard deviation as a consistency label.
 * Lower deviation = more consistent.
 */
export function getConsistency(
  dev: Pick<TeamEventStats2025Group, "totalPointsNp">
): { label: string; score: number } {
  const d = dev.totalPointsNp;
  if (d <= 10) return { label: "Very Consistent", score: 95 };
  if (d <= 20) return { label: "Consistent", score: 75 };
  if (d <= 35) return { label: "Moderate", score: 50 };
  if (d <= 50) return { label: "Inconsistent", score: 25 };
  return { label: "Very Inconsistent", score: 10 };
}

/**
 * Score how complementary two teams are.
 * Teams strong in different areas (auto vs DC) score higher.
 * Returns 0-100.
 */
export function complementarityScore(
  teamA: TeamEventStats2025,
  teamB: TeamEventStats2025
): number {
  const aAutoRatio = teamA.opr.autoPoints / (teamA.opr.totalPointsNp || 1);
  const aDcRatio = teamA.opr.dcPoints / (teamA.opr.totalPointsNp || 1);
  const bAutoRatio = teamB.opr.autoPoints / (teamB.opr.totalPointsNp || 1);
  const bDcRatio = teamB.opr.dcPoints / (teamB.opr.totalPointsNp || 1);

  // Measure how different their strength profiles are
  const autoDiff = Math.abs(aAutoRatio - bAutoRatio);
  const dcDiff = Math.abs(aDcRatio - bDcRatio);
  const profileDivergence = (autoDiff + dcDiff) / 2;

  // Also factor in combined strength — complementary AND strong is better
  const combinedOpr = teamA.opr.totalPointsNp + teamB.opr.totalPointsNp;
  const strengthBonus = Math.min(combinedOpr / 200, 1); // cap at 1

  const raw = profileDivergence * 0.6 + strengthBonus * 0.4;
  return Math.round(Math.min(raw * 100, 100));
}

/**
 * Normalize a stat to 0–100 across all teams at an event.
 * Useful for radar charts and comparative visualizations.
 */
export function normalizeStats(
  teams: ProcessedTeam[],
  statAccessor: (stats: TeamEventStats2025) => number
): Map<number, number> {
  const values = teams.map((t) => statAccessor(t.stats));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const result = new Map<number, number>();
  teams.forEach((t) => {
    const raw = statAccessor(t.stats);
    result.set(t.teamNumber, Math.round(((raw - min) / range) * 100));
  });

  return result;
}

// ── Partner Finder ──

export type PartnerMode = "balanced" | "opr" | "auto" | "dc" | "consistency";

export interface PartnerResult {
  teamNumber: number;
  teamName: string;
  score: number;
  projectedCombinedOpr: number;
  complementarityTag: string;
}

function getClassification(stats: TeamEventStats2025): "auto-heavy" | "dc-heavy" | "balanced" {
  const autoRatio = stats.opr.autoPoints / (stats.opr.totalPointsNp || 1);
  if (autoRatio > 0.55) return "auto-heavy";
  if (autoRatio < 0.35) return "dc-heavy";
  return "balanced";
}

export function getTeamClassification(stats: TeamEventStats2025): string {
  const c = getClassification(stats);
  if (c === "auto-heavy") return "Auto-heavy";
  if (c === "dc-heavy") return "DC-heavy";
  return "Balanced";
}

/**
 * Normalize a single value into 0–100 given a min/max range.
 */
function normalizeValue(value: number, min: number, max: number): number {
  const range = max - min || 1;
  return Math.round(Math.min(Math.max(((value - min) / range) * 100, 0), 100));
}

/**
 * Score how good a partner teamB would be for teamA, given the full event field.
 * Mode controls the ranking strategy:
 *   "balanced" — complementarity 40%, combined OPR 40%, consistency 20%
 *   "opr"     — partner's total OPR normalized to 0–100
 *   "auto"    — partner's auto OPR normalized to 0–100
 *   "dc"      — partner's DC OPR normalized to 0–100
 *   "consistency" — inverse of partner's deviation normalized to 0–100
 * Returns 0–100.
 */
export function partnerScore(
  teamA: TeamEventStats2025,
  teamB: TeamEventStats2025,
  allTeams: ProcessedTeam[],
  mode: PartnerMode = "balanced"
): number {
  if (mode === "opr") {
    const vals = allTeams.map((t) => t.stats.opr.totalPointsNp);
    return normalizeValue(teamB.opr.totalPointsNp, Math.min(...vals), Math.max(...vals));
  }
  if (mode === "auto") {
    const vals = allTeams.map((t) => t.stats.opr.autoPoints);
    return normalizeValue(teamB.opr.autoPoints, Math.min(...vals), Math.max(...vals));
  }
  if (mode === "dc") {
    const vals = allTeams.map((t) => t.stats.opr.dcPoints);
    return normalizeValue(teamB.opr.dcPoints, Math.min(...vals), Math.max(...vals));
  }
  if (mode === "consistency") {
    const vals = allTeams.map((t) => t.stats.dev.totalPointsNp);
    // Invert: lowest dev = 100
    return normalizeValue(teamB.dev.totalPointsNp, Math.max(...vals), Math.min(...vals));
  }

  // "balanced" mode — existing weighted heuristic
  const ratioA = teamA.opr.autoPoints / (teamA.opr.dcPoints || 1);
  const ratioB = teamB.opr.autoPoints / (teamB.opr.dcPoints || 1);
  const allRatios = allTeams.map(
    (t) => t.stats.opr.autoPoints / (t.stats.opr.dcPoints || 1)
  );
  const maxRatioDiff = Math.max(...allRatios) - Math.min(...allRatios) || 1;
  const complementarity = Math.abs(ratioA - ratioB) / maxRatioDiff;

  const sortedOpr = allTeams
    .map((t) => t.stats.opr.totalPointsNp)
    .sort((a, b) => b - a);
  const theoreticalMax = (sortedOpr[0] ?? 0) + (sortedOpr[1] ?? 0) || 1;
  const combinedOpr = teamA.opr.totalPointsNp + teamB.opr.totalPointsNp;
  const strength = Math.min(combinedOpr / theoreticalMax, 1);

  const devs = allTeams.map((t) => t.stats.dev.totalPointsNp);
  const maxDev = Math.max(...devs) || 1;
  const consistencyA = 1 - teamA.dev.totalPointsNp / maxDev;
  const consistencyB = 1 - teamB.dev.totalPointsNp / maxDev;
  const consistency = (consistencyA + consistencyB) / 2;

  const raw = complementarity * 0.4 + strength * 0.4 + consistency * 0.2;
  return Math.round(Math.min(raw * 100, 100));
}

function getComplementarityTag(
  selected: TeamEventStats2025,
  partner: TeamEventStats2025,
  score: number,
  allScores: number[],
  allDevs: number[]
): string {
  const selClass = getClassification(selected);
  const partClass = getClassification(partner);

  // Top 10% ceiling check
  const sorted = [...allScores].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 100;
  const combinedOpr = selected.opr.totalPointsNp + partner.opr.totalPointsNp;
  if (combinedOpr >= p90) return "High ceiling";

  // Bottom 20% deviation = "Rock solid"
  const sortedDevs = [...allDevs].sort((a, b) => a - b);
  const p20 = sortedDevs[Math.floor(sortedDevs.length * 0.2)] ?? 0;
  if (partner.dev.totalPointsNp <= p20) return "Rock solid";

  if (selClass === "dc-heavy" && partClass === "auto-heavy") return "Fills your auto gap";
  if (selClass === "auto-heavy" && partClass === "dc-heavy") return "Strong DC pairing";
  if (selClass === "dc-heavy" && partClass === "dc-heavy") return "DC powerhouse";
  if (selClass === "auto-heavy" && partClass === "auto-heavy") return "Auto powerhouse";
  return "Balanced match";
}

/**
 * Rank all other teams at the event as potential partners for the selected team.
 */
export function rankPartners(
  selectedTeam: ProcessedTeam,
  allTeams: ProcessedTeam[],
  mode: PartnerMode = "balanced"
): PartnerResult[] {
  const others = allTeams.filter((t) => t.teamNumber !== selectedTeam.teamNumber);

  // Pre-compute all possible combined OPRs for the "High ceiling" tag
  const allCombinedOprs = others.map(
    (t) => selectedTeam.stats.opr.totalPointsNp + t.stats.opr.totalPointsNp
  );
  const allDevs = allTeams.map((t) => t.stats.dev.totalPointsNp);

  const results: PartnerResult[] = others.map((partner) => {
    const score = partnerScore(selectedTeam.stats, partner.stats, allTeams, mode);
    const projectedCombinedOpr =
      selectedTeam.stats.opr.totalPointsNp + partner.stats.opr.totalPointsNp;
    const complementarityTag = getComplementarityTag(
      selectedTeam.stats,
      partner.stats,
      score,
      allCombinedOprs,
      allDevs
    );
    return {
      teamNumber: partner.teamNumber,
      teamName: partner.teamName,
      score,
      projectedCombinedOpr,
      complementarityTag,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ── Prescout Calculations ──

function eventsWithStats(events: TeamEventEntry[]): (TeamEventEntry & { stats: TeamEventStats2025 })[] {
  return events.filter((e): e is TeamEventEntry & { stats: TeamEventStats2025 } => e.stats !== null);
}

function eventsSortedChronologically(events: TeamEventEntry[]): (TeamEventEntry & { stats: TeamEventStats2025 })[] {
  return eventsWithStats(events).sort(
    (a, b) => new Date(a.event.start).getTime() - new Date(b.event.start).getTime()
  );
}

export function getSeasonBestOpr(
  events: TeamEventEntry[],
  field: "totalPointsNp" | "autoPoints" | "dcPoints" = "totalPointsNp"
): number {
  const valid = eventsWithStats(events);
  if (valid.length === 0) return 0;
  return Math.max(...valid.map((e) => e.stats.opr[field]));
}

export function getSeasonAvg(
  events: TeamEventEntry[],
  accessor: (stats: TeamEventStats2025) => number
): number {
  const valid = eventsWithStats(events);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, e) => acc + accessor(e.stats), 0);
  return sum / valid.length;
}

export function getSeasonRecord(
  events: TeamEventEntry[]
): { wins: number; losses: number; ties: number } {
  const valid = eventsWithStats(events);
  return valid.reduce(
    (acc, e) => ({
      wins: acc.wins + e.stats.wins,
      losses: acc.losses + e.stats.losses,
      ties: acc.ties + e.stats.ties,
    }),
    { wins: 0, losses: 0, ties: 0 }
  );
}

export function getTrend(
  events: TeamEventEntry[],
  field: "totalPointsNp" | "autoPoints" | "dcPoints" = "totalPointsNp"
): TrendDirection {
  const sorted = eventsSortedChronologically(events);
  if (sorted.length < 2) return "stable";
  const recent = sorted.slice(-3);
  if (recent.length < 2) return "stable";

  let ups = 0;
  let downs = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i].stats.opr[field] - recent[i - 1].stats.opr[field];
    if (diff > 3) ups++;
    else if (diff < -3) downs++;
  }

  if (ups > downs) return "improving";
  if (downs > ups) return "declining";
  return "stable";
}

export function getPrescoutRanking(
  allTeamsPrescoutData: PrescoutTeamData[]
): PrescoutRankedTeam[] {
  const ranked: PrescoutRankedTeam[] = allTeamsPrescoutData.map((team) => {
    const valid = eventsWithStats(team.events);
    const record = getSeasonRecord(team.events);
    const eventCount = valid.length;

    return {
      rank: 0,
      teamNumber: team.number,
      teamName: team.name,
      schoolName: team.schoolName,
      bestOpr: getSeasonBestOpr(team.events, "totalPointsNp"),
      bestAutoOpr: getSeasonBestOpr(team.events, "autoPoints"),
      bestDcOpr: getSeasonBestOpr(team.events, "dcPoints"),
      seasonAvg: getSeasonAvg(team.events, (s) => s.avg.totalPointsNp),
      seasonAutoAvg: getSeasonAvg(team.events, (s) => s.avg.autoPoints),
      seasonDcAvg: getSeasonAvg(team.events, (s) => s.avg.dcPoints),
      record,
      eventCount,
      trend: getTrend(team.events),
      avgRp: getSeasonAvg(team.events, (s) => s.rp),
      avgMovementRp: getSeasonAvg(team.events, (s) => s.avg.movementRp ?? 0),
      avgGoalRp: getSeasonAvg(team.events, (s) => s.avg.goalRp ?? 0),
      avgPatternRp: getSeasonAvg(team.events, (s) => s.avg.patternRp ?? 0),
      events: team.events,
      quickStats: team.quickStats,
    };
  });

  ranked.sort((a, b) => b.bestOpr - a.bestOpr);
  ranked.forEach((t, i) => { t.rank = i + 1; });

  return ranked;
}
