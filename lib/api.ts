import { Event, EventSearchResult, TeamReport, PrescoutTeamData } from "./types";

const API_URL = "https://api.ftcscout.org/graphql";
export const CURRENT_SEASON = 2025;

async function gqlFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    throw new Error(`FTC Scout API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`);
  }

  return json.data;
}

// ── Queries ──

const EVENT_QUERY = `
  query GetEvent($code: String!, $season: Int!) {
    eventByCode(code: $code, season: $season) {
      name
      start
      end
      teams {
        teamNumber
        team {
          name
          schoolName
        }
        stats {
          ... on TeamEventStats2025 {
            rank
            rp
            tb1
            tb2
            wins
            losses
            ties
            dqs
            qualMatchesPlayed
            opr {
              totalPointsNp
              autoPoints
              dcPoints
              autoArtifactPoints
              autoPatternPoints
              dcArtifactPoints
              dcBasePoints
              dcPatternPoints
            }
            avg {
              totalPointsNp
              autoPoints
              dcPoints
              autoArtifactPoints
              autoPatternPoints
              dcArtifactPoints
              dcBasePoints
              dcPatternPoints
              movementRp
              goalRp
              patternRp
            }
            max {
              totalPointsNp
              autoPoints
              dcPoints
            }
            dev {
              totalPointsNp
              autoPoints
              dcPoints
            }
          }
        }
      }
      matches {
        id
        hasBeenPlayed
        scores {
          ... on MatchScores2025 {
            red {
              totalPointsNp
              autoPoints
              dcPoints
              alliance
            }
            blue {
              totalPointsNp
              autoPoints
              dcPoints
              alliance
            }
          }
        }
        teams {
          teamNumber
          alliance
          station
        }
      }
    }
  }
`;

// ── Fetch functions ──

export async function getEventData(
  eventCode: string
): Promise<Event> {
  const data = await gqlFetch<{ eventByCode: Event }>(EVENT_QUERY, {
    code: eventCode,
    season: CURRENT_SEASON,
  });

  if (!data.eventByCode) {
    throw new Error(`Event "${eventCode}" not found for season ${CURRENT_SEASON}`);
  }

  return data.eventByCode;
}

// ── Team Report Query ──

const TEAM_REPORT_QUERY = `
  query GetTeamReport($number: Int!) {
    teamByNumber(number: $number) {
      number
      name
      schoolName
      rookieYear
      quickStats(season: 2025) {
        season
        tot { value rank }
        auto { value rank }
        dc { value rank }
        eg { value rank }
        count
      }
      events(season: 2025) {
        eventCode
        event { name start }
        stats {
          ... on TeamEventStats2025 {
            rank
            rp
            wins
            losses
            ties
            qualMatchesPlayed
            opr {
              totalPointsNp
              autoPoints
              dcPoints
              autoArtifactPoints
              dcArtifactPoints
              dcBasePoints
            }
            avg {
              totalPointsNp
              autoPoints
              dcPoints
              movementRp
              goalRp
              patternRp
            }
            max {
              totalPointsNp
              autoPoints
              dcPoints
            }
            dev {
              totalPointsNp
              autoPoints
              dcPoints
            }
          }
        }
      }
    }
  }
`;

// ── Event Search Query ──

const EVENT_SEARCH_QUERY = `
  query SearchEvents($season: Int!, $searchText: String!) {
    eventsSearch(season: $season, searchText: $searchText) {
      code
      name
      start
      type
      location {
        venue
        city
        state
        country
      }
    }
  }
`;

export async function searchEvents(
  searchText: string
): Promise<EventSearchResult[]> {
  const data = await gqlFetch<{ eventsSearch: EventSearchResult[] }>(
    EVENT_SEARCH_QUERY,
    { season: CURRENT_SEASON, searchText }
  );
  return data.eventsSearch ?? [];
}

export async function getTeamReport(teamNumber: number): Promise<TeamReport> {
  const data = await gqlFetch<{ teamByNumber: TeamReport }>(
    TEAM_REPORT_QUERY,
    { number: teamNumber }
  );

  if (!data.teamByNumber) {
    throw new Error(`Team ${teamNumber} not found`);
  }

  return data.teamByNumber;
}

// ── Prescout: batch-fetch season data for multiple teams ──

const PRESCOUT_TEAM_QUERY = `
  query GetPrescoutTeam($number: Int!) {
    teamByNumber(number: $number) {
      number
      name
      schoolName
      quickStats(season: 2025) {
        season
        tot { value rank }
        auto { value rank }
        dc { value rank }
        eg { value rank }
        count
      }
      events(season: 2025) {
        eventCode
        event { name start }
        stats {
          ... on TeamEventStats2025 {
            rank
            rp
            wins
            losses
            ties
            qualMatchesPlayed
            opr {
              totalPointsNp
              autoPoints
              dcPoints
            }
            avg {
              totalPointsNp
              autoPoints
              dcPoints
              movementRp
              goalRp
              patternRp
            }
            max {
              totalPointsNp
              autoPoints
              dcPoints
            }
            dev {
              totalPointsNp
              autoPoints
              dcPoints
            }
          }
        }
      }
    }
  }
`;

async function fetchTeamPrescout(teamNumber: number): Promise<PrescoutTeamData | null> {
  try {
    const data = await gqlFetch<{ teamByNumber: PrescoutTeamData | null }>(
      PRESCOUT_TEAM_QUERY,
      { number: teamNumber }
    );
    return data.teamByNumber ?? null;
  } catch {
    return null;
  }
}

export async function getPrescoutData(
  teamNumbers: number[],
  _season: number = CURRENT_SEASON
): Promise<PrescoutTeamData[]> {
  const BATCH_SIZE = 8;
  const results: PrescoutTeamData[] = [];

  for (let i = 0; i < teamNumbers.length; i += BATCH_SIZE) {
    const batch = teamNumbers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchTeamPrescout));
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}
