// ── Event & Team ──

export interface Location {
  city: string;
  state: string;
  country: string;
}

export interface Team {
  number: number;
  name: string;
  schoolName: string;
  location?: Location;
  rookieYear?: number;
}

export interface Event {
  season: number;
  code: string;
  name: string;
  start: string;
  end: string;
  type?: string;
  location?: Location;
  teams: TeamEventParticipation[];
  matches: Match[];
}

// ── Team Event Participation ──

export interface TeamEventParticipation {
  teamNumber: number;
  team: Pick<Team, "name" | "schoolName">;
  stats: TeamEventStats2025 | null;
}

// ── Stats (2025 season – "Into the Deep") ──

export interface TeamEventStats2025Group {
  totalPointsNp: number;
  autoPoints: number;
  dcPoints: number;
  autoArtifactPoints: number;
  autoPatternPoints: number;
  dcArtifactPoints: number;
  dcBasePoints: number;
  dcPatternPoints: number;
  // Penalty fields (present on opr and avg groups when available)
  penaltyPointsCommitted?: number;
  majorsCommittedPoints?: number;
  minorsCommittedPoints?: number;
  // Only present on avg group
  movementRp?: number;
  goalRp?: number;
  patternRp?: number;
}

export interface TeamEventStats2025 {
  rank: number;
  rp: number;
  tb1: number;
  tb2: number;
  wins: number;
  losses: number;
  ties: number;
  dqs: number;
  qualMatchesPlayed: number;
  opr: TeamEventStats2025Group;
  avg: TeamEventStats2025Group;
  max: Pick<TeamEventStats2025Group, "totalPointsNp" | "autoPoints" | "dcPoints">;
  dev: Pick<TeamEventStats2025Group, "totalPointsNp" | "autoPoints" | "dcPoints">;
}

// ── Matches ──

export type Alliance = "Red" | "Blue";

export interface MatchTeam {
  teamNumber: number;
  alliance: Alliance;
  station: number;
}

export interface MatchScores2025Alliance {
  totalPointsNp: number;
  autoPoints: number;
  dcPoints: number;
  alliance: Alliance;
}

export interface MatchScores2025 {
  red: MatchScores2025Alliance;
  blue: MatchScores2025Alliance;
}

export interface Match {
  id: number;
  hasBeenPlayed: boolean;
  scores: MatchScores2025 | null;
  teams: MatchTeam[];
}

// ── QuickStats (team-level season stats) ──

export interface QuickStatValue {
  value: number;
  rank: number;
}

export interface QuickStats {
  season: number;
  tot: QuickStatValue;
  auto: QuickStatValue;
  dc: QuickStatValue;
  eg: QuickStatValue;
  count: number;
}

// ── Team Report (full season profile) ──

export interface TeamEventEntry {
  eventCode: string;
  event: { name: string; start: string };
  stats: TeamEventStats2025 | null;
}

export interface TeamReport {
  number: number;
  name: string;
  schoolName: string;
  rookieYear: number;
  quickStats: QuickStats | null;
  events: TeamEventEntry[];
}

// ── Event Search ──

export interface EventSearchLocation {
  venue: string;
  city: string;
  state: string;
  country: string;
}

export interface EventSearchResult {
  code: string;
  name: string;
  start: string;
  type: string;
  location: EventSearchLocation;
}

// ── Processed types used by UI ──

export interface ProcessedTeam {
  teamNumber: number;
  teamName: string;
  schoolName: string;
  stats: TeamEventStats2025;
}

// ── Prescout types ──

export type TrendDirection = "improving" | "declining" | "stable";

export interface PrescoutTeamData {
  number: number;
  name: string;
  schoolName: string;
  quickStats: QuickStats | null;
  events: TeamEventEntry[];
}

export interface PrescoutRankedTeam {
  rank: number;
  teamNumber: number;
  teamName: string;
  schoolName: string;
  bestOpr: number;
  bestAutoOpr: number;
  bestDcOpr: number;
  seasonAvg: number;
  seasonAutoAvg: number;
  seasonDcAvg: number;
  record: { wins: number; losses: number; ties: number };
  eventCount: number;
  trend: TrendDirection;
  avgRp: number;
  avgMovementRp: number;
  avgGoalRp: number;
  avgPatternRp: number;
  events: TeamEventEntry[];
  quickStats: QuickStats | null;
}
