"use client";

import { ProcessedTeam } from "@/lib/types";
import { getWLT } from "@/lib/calculations";
import { useEvent } from "@/context/EventContext";

interface TeamTableProps {
  teams: ProcessedTeam[];
}

export function TeamTable({ teams }: TeamTableProps) {
  const { selectedTeams, toggleTeamSelection } = useEvent();

  if (teams.length === 0) {
    return (
      <p className="text-[var(--muted)] text-sm">
        No team data available. Load an event to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--muted)] uppercase tracking-wider border-b border-[var(--card-border)]">
            <th className="pb-3 pr-3 w-8"></th>
            <th className="pb-3 pr-3">Rank</th>
            <th className="pb-3 pr-3">Team</th>
            <th className="pb-3 pr-3">W-L-T</th>
            <th className="pb-3 pr-3 text-right">OPR</th>
            <th className="pb-3 pr-3 text-right">Auto</th>
            <th className="pb-3 pr-3 text-right">DC</th>
            <th className="pb-3 text-right">RP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--card-border)]">
          {teams.map((team) => {
            const isSelected = selectedTeams.includes(team.teamNumber);
            return (
              <tr
                key={team.teamNumber}
                className={`transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)]/10"
                    : "hover:bg-white/5"
                }`}
              >
                <td className="py-3 pr-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTeamSelection(team.teamNumber)}
                    className="rounded border-[var(--card-border)] accent-[var(--accent)]"
                  />
                </td>
                <td className="py-3 pr-3 font-medium">{team.stats.rank}</td>
                <td className="py-3 pr-3">
                  <div>
                    <span className="font-medium text-white">
                      {team.teamNumber}
                    </span>
                    <span className="text-[var(--muted)] ml-2">
                      {team.teamName}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-3">{getWLT(team.stats)}</td>
                <td className="py-3 pr-3 text-right font-mono">
                  {team.stats.opr.totalPointsNp.toFixed(1)}
                </td>
                <td className="py-3 pr-3 text-right font-mono">
                  {team.stats.opr.autoPoints.toFixed(1)}
                </td>
                <td className="py-3 pr-3 text-right font-mono">
                  {team.stats.opr.dcPoints.toFixed(1)}
                </td>
                <td className="py-3 text-right font-mono">
                  {team.stats.rp.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
