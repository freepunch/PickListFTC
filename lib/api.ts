import { Event, EventSearchResult, TeamReport } from "./types";

const API_URL = "https://api.ftcscout.org/graphql";

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
  eventCode: string,
  season: number = 2025
): Promise<Event> {
  const data = await gqlFetch<{ eventByCode: Event }>(EVENT_QUERY, {
    code: eventCode,
    season,
  });

  if (!data.eventByCode) {
    throw new Error(`Event "${eventCode}" not found for season ${season}`);
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
  searchText: string,
  season: number = 2025
): Promise<EventSearchResult[]> {
  const data = await gqlFetch<{ eventsSearch: EventSearchResult[] }>(
    EVENT_SEARCH_QUERY,
    { season, searchText }
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
