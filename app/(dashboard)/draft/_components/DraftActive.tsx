"use client";

import { useEffect, useMemo, useState } from "react";
import { ProcessedTeam } from "@/lib/types";
import {
  DraftPick,
  PICKS_PER_ALLIANCE,
  WorkspaceDraft,
  WorkspacePickList,
  getDraftPickSlot,
  loadWorkspacePickList,
  upsertDraft,
} from "@/lib/workspace";

interface Props {
  draft: WorkspaceDraft;
  workspaceId: string;
  workspaceTeamNumber: number | null;
  eventCode: string;
  teams: ProcessedTeam[];
  eventTeams: { teamNumber: number; teamName: string }[];
  canEdit: boolean;
}

export function DraftActive({
  draft,
  workspaceId,
  eventCode,
  teams,
  eventTeams,
  canEdit,
}: Props) {
  const [pickList, setPickList] = useState<WorkspacePickList | null>(null);
  const [query, setQuery] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWorkspacePickList(workspaceId, eventCode).then(setPickList);
  }, [workspaceId, eventCode]);

  // Lookup maps
  const teamNameMap = useMemo(
    () => new Map(eventTeams.map((t) => [t.teamNumber, t.teamName])),
    [eventTeams]
  );
  const oprMap = useMemo(
    () => new Map(teams.map((t) => [t.teamNumber, t.stats.opr.totalPointsNp])),
    [teams]
  );

  // Pick list rank for star highlight and "best pick" suggestion
  const pickListRank = useMemo(() => {
    const m = new Map<number, number>();
    pickList?.list_data.entries.forEach((e, i) => m.set(e.teamNumber, i + 1));
    return m;
  }, [pickList]);

  // Captains and selected teams
  const captainNumbers = draft.ranking_order.slice(0, draft.num_alliances);
  const pickedNumbers = useMemo(
    () => new Set(draft.picks.map((p) => p.teamNumber)),
    [draft.picks]
  );
  const onAllianceNumbers = useMemo(() => {
    const s = new Set<number>(captainNumbers);
    draft.picks.forEach((p) => s.add(p.teamNumber));
    return s;
  }, [captainNumbers, draft.picks]);

  // Current pick slot
  const currentSlot = getDraftPickSlot(draft.num_alliances, draft.picks.length);
  const isComplete = currentSlot === null;

  const currentCaptain = currentSlot ? captainNumbers[currentSlot.alliance - 1] : null;

  // Alliance grid data
  const allianceRows = useMemo(() => {
    // rows = [[captain a1, captain a2, ...], [pick1 a1, pick1 a2, ...], [pick2 a1, ...]]
    const grid: { teamNumber: number | null; round: number }[][] = [];
    grid.push(captainNumbers.map((tn) => ({ teamNumber: tn, round: 0 })));
    for (let r = 1; r <= PICKS_PER_ALLIANCE; r++) {
      const row: { teamNumber: number | null; round: number }[] = [];
      for (let a = 1; a <= draft.num_alliances; a++) {
        const pick = draft.picks.find((p) => p.alliance === a && p.round === r);
        row.push({ teamNumber: pick?.teamNumber ?? null, round: r });
      }
      grid.push(row);
    }
    return grid;
  }, [captainNumbers, draft.picks, draft.num_alliances]);

  // Available teams: in event but not yet on an alliance
  const availableTeams = useMemo(() => {
    return eventTeams
      .filter((t) => !onAllianceNumbers.has(t.teamNumber))
      .map((t) => ({
        teamNumber: t.teamNumber,
        teamName: t.teamName,
        opr: oprMap.get(t.teamNumber) ?? 0,
        pickListRank: pickListRank.get(t.teamNumber) ?? null,
      }))
      .sort((a, b) => b.opr - a.opr);
  }, [eventTeams, onAllianceNumbers, oprMap, pickListRank]);

  // Your next best pick: highest-ranked available team on the pick list
  const bestPick = useMemo(() => {
    const onListAndAvailable = availableTeams
      .filter((t) => t.pickListRank !== null)
      .sort((a, b) => (a.pickListRank ?? 999) - (b.pickListRank ?? 999));
    return onListAndAvailable[0] ?? null;
  }, [availableTeams]);

  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableTeams;
    return availableTeams.filter(
      (t) =>
        String(t.teamNumber).includes(q) ||
        t.teamName.toLowerCase().includes(q)
    );
  }, [availableTeams, query]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const recordPick = async (teamNumber: number) => {
    if (!canEdit || !currentSlot || submitting) return;
    if (onAllianceNumbers.has(teamNumber)) return;
    setSubmitting(true);
    const newPick: DraftPick = {
      alliance: currentSlot.alliance,
      round: currentSlot.round,
      teamNumber,
    };
    const newPicks = [...draft.picks, newPick];
    const newStatus = newPicks.length >= currentSlot.total ? "complete" : "active";
    await upsertDraft({
      workspaceId,
      eventCode,
      picks: newPicks,
      status: newStatus,
    });
    setSubmitting(false);
    setQuery("");
    setShowPicker(false);
  };

  const undoLast = async () => {
    if (!canEdit || draft.picks.length === 0 || submitting) return;
    setSubmitting(true);
    const newPicks = draft.picks.slice(0, -1);
    await upsertDraft({
      workspaceId,
      eventCode,
      picks: newPicks,
      status: "active",
    });
    setSubmitting(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-4 md:px-6 py-4 space-y-4 max-w-7xl mx-auto">
      {/* Alliance grid */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Alliances</h2>
          <span className="text-[11px] text-[var(--foreground-dim)]">
            Pick {draft.picks.length} of {draft.num_alliances * PICKS_PER_ALLIANCE}
          </span>
        </div>
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div
            className="grid gap-2 min-w-max md:min-w-0"
            style={{ gridTemplateColumns: `repeat(${draft.num_alliances}, minmax(140px, 1fr))` }}
          >
            {/* Column headers */}
            {Array.from({ length: draft.num_alliances }).map((_, i) => {
              const isCurrent = currentSlot?.alliance === i + 1;
              return (
                <div
                  key={`hdr-${i}`}
                  className={`px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wider rounded ${
                    isCurrent
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--foreground-dim)]"
                  }`}
                >
                  Alliance {i + 1}
                </div>
              );
            })}

            {/* Grid cells */}
            {allianceRows.map((row, rowIdx) =>
              row.map((cell, colIdx) => {
                const isCurrentCell =
                  !isComplete &&
                  currentSlot?.alliance === colIdx + 1 &&
                  currentSlot?.round === cell.round &&
                  cell.teamNumber === null;
                const isCaptain = rowIdx === 0;
                const filled = cell.teamNumber !== null;
                const teamName = cell.teamNumber !== null ? teamNameMap.get(cell.teamNumber) : undefined;
                return (
                  <DraftCell
                    key={`${rowIdx}-${colIdx}`}
                    rowLabel={isCaptain ? "Captain" : `Pick ${cell.round}`}
                    teamNumber={cell.teamNumber}
                    teamName={teamName}
                    isCurrent={isCurrentCell}
                    isCaptain={isCaptain}
                    filled={filled}
                  />
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Now picking banner */}
      {!isComplete && currentSlot && currentCaptain && (
        <section className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--accent)] font-semibold">
                Now picking
              </p>
              <p className="text-base text-[var(--foreground)]">
                Alliance {currentSlot.alliance}{" "}
                <span className="text-[var(--foreground-dim)] text-sm">
                  · Round {currentSlot.round}
                </span>
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                Captain:{" "}
                <span className="font-mono font-semibold text-[var(--foreground)]">
                  {currentCaptain}
                </span>{" "}
                {teamNameMap.get(currentCaptain) ?? ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && draft.picks.length > 0 && (
                <button
                  onClick={undoLast}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] border border-[var(--border)] transition-colors disabled:opacity-50"
                >
                  Undo last pick
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  {showPicker ? "Close picker" : "Select team"}
                </button>
              )}
            </div>
          </div>

          {/* Team picker */}
          {canEdit && showPicker && (
            <div className="mt-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team number or name…"
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]/40">
                {filteredAvailable.slice(0, 25).map((t) => (
                  <button
                    key={t.teamNumber}
                    onClick={() => recordPick(t.teamNumber)}
                    disabled={submitting}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
                  >
                    <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
                      {t.teamNumber}
                    </span>
                    <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                      {t.teamName}
                    </span>
                    {t.pickListRank !== null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold">
                        ★ #{t.pickListRank}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-[var(--foreground-dim)] tabular-nums w-12 text-right shrink-0">
                      {t.opr.toFixed(1)}
                    </span>
                  </button>
                ))}
                {filteredAvailable.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-[var(--foreground-dim)]">
                    No matching teams.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Best pick suggestion */}
      {bestPick && !isComplete && (
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold shrink-0">
            Your next best pick
          </span>
          <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
            {bestPick.teamNumber}
          </span>
          <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
            {bestPick.teamName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold shrink-0">
            ★ #{bestPick.pickListRank}
          </span>
        </section>
      )}

      {/* Available teams */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Available teams
            <span className="ml-1.5 text-[var(--foreground-dim)] font-normal">
              {availableTeams.length}
            </span>
          </h2>
        </div>
        <ul className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]/50 overflow-hidden">
          {availableTeams.map((t) => (
            <li
              key={t.teamNumber}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-card-hover)]/60"
            >
              <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
                {t.teamNumber}
              </span>
              <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                {t.teamName}
              </span>
              {t.pickListRank !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold shrink-0">
                  ★ #{t.pickListRank}
                </span>
              )}
              <span className="font-mono text-[11px] text-[var(--foreground-dim)] tabular-nums w-12 text-right shrink-0">
                {t.opr.toFixed(1)}
              </span>
              {canEdit && !isComplete && (
                <button
                  onClick={() => recordPick(t.teamNumber)}
                  disabled={submitting}
                  className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/15 transition-colors disabled:opacity-50 shrink-0"
                >
                  Pick
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DraftCell({
  rowLabel,
  teamNumber,
  teamName,
  isCurrent,
  isCaptain,
  filled,
}: {
  rowLabel: string;
  teamNumber: number | null;
  teamName?: string;
  isCurrent: boolean;
  isCaptain: boolean;
  filled: boolean;
}) {
  const base =
    "rounded-lg px-2.5 py-2 border transition-colors min-h-[68px] flex flex-col justify-between";
  const cls = isCurrent
    ? "border-[var(--accent)] bg-[var(--accent)]/10 animate-pulse"
    : isCaptain && filled
    ? "border-zinc-700 bg-zinc-800/60"
    : filled
    ? "border-emerald-500/40 bg-emerald-500/10"
    : "border-zinc-800 bg-zinc-900/40 border-dashed";

  return (
    <div className={`${base} ${cls}`}>
      <span
        className={`text-[10px] uppercase tracking-wider ${
          isCurrent ? "text-[var(--accent)]" : isCaptain ? "text-zinc-500" : "text-[var(--foreground-dim)]"
        }`}
      >
        {rowLabel}
      </span>
      {teamNumber !== null ? (
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-[var(--foreground)] leading-tight">
            {teamNumber}
          </p>
          {teamName && (
            <p className="text-[10px] text-[var(--foreground-dim)] truncate leading-tight">
              {teamName}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--foreground-dim)]">
          {isCurrent ? "Picking…" : "—"}
        </p>
      )}
    </div>
  );
}
