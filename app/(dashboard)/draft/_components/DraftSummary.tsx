"use client";

import { useEffect, useMemo, useState } from "react";
import { ProcessedTeam } from "@/lib/types";
import {
  WorkspaceDraft,
  WorkspacePickList,
  loadWorkspacePickList,
  upsertDraft,
} from "@/lib/workspace";

interface Props {
  draft: WorkspaceDraft;
  workspaceTeamNumber: number | null;
  teams: ProcessedTeam[];
  eventTeams: { teamNumber: number; teamName: string }[];
  canEdit: boolean;
  workspaceId: string;
  eventCode: string;
}

export function DraftSummary({
  draft,
  workspaceTeamNumber,
  teams,
  eventTeams,
  canEdit,
  workspaceId,
  eventCode,
}: Props) {
  const [pickList, setPickList] = useState<WorkspacePickList | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadWorkspacePickList(workspaceId, eventCode).then(setPickList);
  }, [workspaceId, eventCode]);

  const teamNameMap = useMemo(
    () => new Map(eventTeams.map((t) => [t.teamNumber, t.teamName])),
    [eventTeams]
  );
  const oprMap = useMemo(
    () => new Map(teams.map((t) => [t.teamNumber, t.stats.opr.totalPointsNp])),
    [teams]
  );

  // Build alliance roster: [captain, pick1, pick2]
  const alliances = useMemo(() => {
    const captains = draft.ranking_order.slice(0, draft.num_alliances);
    return captains.map((captain, idx) => {
      const allianceNum = idx + 1;
      const picks = draft.picks
        .filter((p) => p.alliance === allianceNum)
        .sort((a, b) => a.round - b.round)
        .map((p) => p.teamNumber);
      const members = [captain, ...picks];
      const totalOpr = members.reduce(
        (sum, tn) => sum + (oprMap.get(tn) ?? 0),
        0
      );
      const containsMyTeam =
        workspaceTeamNumber !== null && members.includes(workspaceTeamNumber);
      return { allianceNum, captain, picks, members, totalOpr, containsMyTeam };
    });
  }, [draft, workspaceTeamNumber, oprMap]);

  // Pick list analysis
  const pickListAnalysis = useMemo(() => {
    if (!pickList) return null;
    const myAllianceTeams = new Set<number>();
    const myAlliance = alliances.find((a) => a.containsMyTeam);
    if (myAlliance) myAlliance.members.forEach((tn) => myAllianceTeams.add(tn));
    const allOnAlliances = new Set<number>(
      alliances.flatMap((a) => a.members)
    );

    const got: { teamNumber: number; rank: number }[] = [];
    const lost: { teamNumber: number; rank: number; toAlliance: number }[] = [];
    pickList.list_data.entries.forEach((entry, i) => {
      const rank = i + 1;
      if (myAllianceTeams.has(entry.teamNumber)) {
        got.push({ teamNumber: entry.teamNumber, rank });
      } else if (allOnAlliances.has(entry.teamNumber)) {
        const a = alliances.find((al) => al.members.includes(entry.teamNumber));
        lost.push({
          teamNumber: entry.teamNumber,
          rank,
          toAlliance: a?.allianceNum ?? 0,
        });
      }
    });
    return { got, lost };
  }, [pickList, alliances]);

  const resetDraft = async () => {
    if (!canEdit) return;
    if (!confirm("Reset the draft? This wipes all picks and returns to setup.")) return;
    setResetting(true);
    await upsertDraft({
      workspaceId,
      eventCode,
      picks: [],
      status: "setup",
    });
    setResetting(false);
  };

  return (
    <div className="px-4 md:px-6 py-4 space-y-4 max-w-5xl mx-auto">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
          Draft complete
        </p>
        <p className="text-base text-[var(--foreground)] mt-0.5">
          All {draft.num_alliances} alliances formed.
        </p>
      </div>

      {/* Alliance cards */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">
          Alliances
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {alliances.map((a) => (
            <div
              key={a.allianceNum}
              className={`rounded-xl border p-3 ${
                a.containsMyTeam
                  ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                  : "border-[var(--border)] bg-[var(--bg-card)]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[var(--foreground)]">
                  Alliance {a.allianceNum}
                  {a.containsMyTeam && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] uppercase tracking-wider">
                      Your alliance
                    </span>
                  )}
                </p>
                <span className="font-mono text-[11px] text-[var(--foreground-dim)] tabular-nums">
                  Σ OPR {a.totalOpr.toFixed(1)}
                </span>
              </div>
              <ul className="space-y-1">
                {a.members.map((tn, i) => (
                  <li key={tn} className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] w-12 shrink-0">
                      {i === 0 ? "Captain" : `Pick ${i}`}
                    </span>
                    <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
                      {tn}
                    </span>
                    <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                      {teamNameMap.get(tn) ?? "—"}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--foreground-dim)] tabular-nums shrink-0">
                      {(oprMap.get(tn) ?? 0).toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Pick list analysis */}
      {pickListAnalysis && (pickListAnalysis.got.length > 0 || pickListAnalysis.lost.length > 0) && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">
            Pick list outcome
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1.5">
                You got ({pickListAnalysis.got.length})
              </p>
              {pickListAnalysis.got.length === 0 ? (
                <p className="text-xs text-[var(--foreground-dim)]">
                  None of your pick list teams ended up on your alliance.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {pickListAnalysis.got.map((t) => (
                    <li key={t.teamNumber} className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--foreground-dim)] font-mono w-7 shrink-0">
                        #{t.rank}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[var(--foreground)] w-14 shrink-0">
                        {t.teamNumber}
                      </span>
                      <span className="text-[11px] text-[var(--foreground-muted)] truncate">
                        {teamNameMap.get(t.teamNumber) ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold mb-1.5">
                Went elsewhere ({pickListAnalysis.lost.length})
              </p>
              {pickListAnalysis.lost.length === 0 ? (
                <p className="text-xs text-[var(--foreground-dim)]">
                  No pick list teams went to other alliances.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {pickListAnalysis.lost.map((t) => (
                    <li key={t.teamNumber} className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--foreground-dim)] font-mono w-7 shrink-0">
                        #{t.rank}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[var(--foreground)] w-14 shrink-0">
                        {t.teamNumber}
                      </span>
                      <span className="text-[11px] text-[var(--foreground-muted)] truncate flex-1">
                        {teamNameMap.get(t.teamNumber) ?? "—"}
                      </span>
                      <span className="text-[10px] text-red-400 shrink-0">
                        → A{t.toAlliance}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {canEdit && (
        <section className="border-t border-[var(--border)] pt-4">
          <button
            onClick={resetDraft}
            disabled={resetting}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] border border-[var(--border)] transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset draft"}
          </button>
        </section>
      )}
    </div>
  );
}
