"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import {
  WorkspacePickList,
  WorkspacePickListEntry,
  WorkspacePersonalRanking,
  loadPersonalRankings,
  savePersonalRanking,
  saveWorkspacePickList,
} from "@/lib/workspace";

interface Props {
  list: WorkspacePickList;
  onApplied: (updated: WorkspacePickList) => void;
}

function syncToEntries(ranking: number[], entryNums: number[]): number[] {
  const entrySet = new Set(entryNums);
  const keep = ranking.filter((n) => entrySet.has(n));
  const keepSet = new Set(keep);
  const add = entryNums.filter((n) => !keepSet.has(n));
  return [...keep, ...add];
}

export function ConsensusView({ list, onApplied }: Props) {
  const { user } = useAuth();
  const { workspace, role, members } = useWorkspace();
  const canEdit = role === "admin" || role === "editor";

  const [rankings, setRankings] = useState<WorkspacePersonalRanking[]>([]);
  const [myRanking, setMyRanking] = useState<number[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [activePanel, setActivePanel] = useState<"consensus" | "mine">("consensus");

  const isDirtyRef = useRef(false);

  const entries = list.list_data.entries;
  const entryNums = useMemo(() => entries.map((e) => e.teamNumber), [entries]);
  const N = entries.length;

  const loadRankings = useCallback(async () => {
    const r = await loadPersonalRankings(list.id);
    setRankings(r);
    return r;
  }, [list.id]);

  // Initial load
  useEffect(() => {
    loadRankings().then((r) => {
      if (!user) return;
      const mine = r.find((x) => x.user_id === user.id);
      const base = mine?.ranked_teams ?? entryNums;
      setMyRanking(syncToEntries(base, entryNums));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id, user?.id]);

  // Sync myRanking when entries change (teams added/removed from pick list)
  useEffect(() => {
    if (isDirtyRef.current) return;
    setMyRanking((prev) => syncToEntries(prev.length ? prev : entryNums, entryNums));
  }, [entryNums]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`ws-rankings:${list.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_personal_rankings",
          filter: `pick_list_id=eq.${list.id}`,
        },
        () => {
          loadRankings().then((r) => {
            if (!user || isDirtyRef.current) return;
            const mine = r.find((x) => x.user_id === user.id);
            if (mine) {
              setMyRanking(syncToEntries(mine.ranked_teams, entryNums));
            }
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  // Consensus calculation
  const consensusData = useMemo(() => {
    if (entries.length === 0) return [];
    if (rankings.length === 0) {
      return entries.map((e, i) => ({
        ...e,
        avgRank: i + 1,
        spread: 0,
        memberRanks: [] as { name: string; rank: number }[],
        solo: false,
      }));
    }
    const mapped = entries.map((entry) => {
      const memberRanks = rankings.map((r) => {
        const idx = r.ranked_teams.indexOf(entry.teamNumber);
        return {
          name: r.memberName ?? "Member",
          rank: idx >= 0 ? idx + 1 : N + 1,
        };
      });
      const ranks = memberRanks.map((m) => m.rank);
      const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const spread = Math.max(...ranks) - Math.min(...ranks);
      return { ...entry, avgRank: avg, spread, memberRanks, solo: rankings.length === 1 };
    });
    return mapped.sort((a, b) => a.avgRank - b.avgRank);
  }, [entries, rankings, N]);

  const moveMyRanking = (from: number, to: number) => {
    if (from === to) return;
    const next = [...myRanking];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMyRanking(next);
    isDirtyRef.current = true;
    setIsDirty(true);
  };

  const hasMySubmission = rankings.some((r) => r.user_id === user?.id);

  const handleSave = async () => {
    if (!user || !workspace) return;
    console.log("[CONSENSUS] handleSave fired:", { userId: user.id, pickListId: list.id, myRanking });
    setSaving(true);
    setSaveError(null);
    const { error } = await savePersonalRanking(workspace.id, list.id, user.id, myRanking);
    if (error) {
      console.error("[CONSENSUS] Save failed:", error);
      setSaveError(error);
      setSaving(false);
      return;
    }
    isDirtyRef.current = false;
    setIsDirty(false);
    setSaving(false);
    await loadRankings();
  };

  const handleApply = async () => {
    if (!canEdit || !user || !workspace) return;
    setApplying(true);
    const orderedEntries: WorkspacePickListEntry[] = consensusData.map((c) => ({
      teamNumber: c.teamNumber,
      teamName: c.teamName,
      opr: c.opr,
      notes: c.notes,
      picked: c.picked,
    }));
    const updated = await saveWorkspacePickList(
      workspace.id,
      list.event_code,
      { entries: orderedEntries },
      user.id
    );
    setApplying(false);
    if (updated) onApplied(updated);
  };

  const submittedCount = rankings.length;
  const totalMembers = members.length;

  return (
    <div className="flex flex-col h-full">
      {/* Panel tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)] shrink-0">
        <button
          onClick={() => setActivePanel("consensus")}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activePanel === "consensus"
              ? "bg-[var(--accent)]/15 text-[var(--accent)]"
              : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Consensus
          {submittedCount > 0 && (
            <span className="ml-1.5 text-[10px] text-[var(--foreground-dim)]">
              {submittedCount}/{totalMembers}
            </span>
          )}
        </button>
        <button
          onClick={() => setActivePanel("mine")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            activePanel === "mine"
              ? "bg-[var(--accent)]/15 text-[var(--accent)]"
              : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          }`}
        >
          My Ranking
          {isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          )}
        </button>
      </div>

      {activePanel === "consensus" ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {submittedCount === 0 ? (
              <div className="m-4 p-6 text-center rounded-xl border-2 border-dashed border-[var(--border)] text-xs text-[var(--foreground-dim)]">
                No rankings submitted yet. Switch to &ldquo;My Ranking&rdquo; to submit yours.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-[var(--foreground-dim)]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/70" /> Strong agreement
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500/70" /> Solo ranking
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500/60" /> High disagreement
                  </span>
                </div>
                <ul>
                  {consensusData.map((item, i) => {
                    const agreement = item.solo
                      ? "solo"
                      : item.spread <= 3
                      ? "agree"
                      : item.spread > 10
                      ? "disagree"
                      : "neutral";
                    const dotClass =
                      agreement === "agree"
                        ? "bg-emerald-500/70"
                        : agreement === "solo"
                        ? "bg-amber-500/70"
                        : agreement === "disagree"
                        ? "bg-red-500/60"
                        : "bg-[var(--border)]";
                    return (
                      <li
                        key={item.teamNumber}
                        className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]/40 last:border-b-0 hover:bg-[var(--bg-card-hover)]/60"
                      >
                        <span className="text-xs text-[var(--foreground-dim)] font-mono w-7 text-right tabular-nums shrink-0">
                          #{i + 1}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                        <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
                          {item.teamNumber}
                        </span>
                        <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                          {item.teamName}
                        </span>
                        <span className="font-mono text-xs text-[var(--foreground-dim)] tabular-nums shrink-0 w-14 text-right">
                          avg {item.avgRank.toFixed(1)}
                        </span>
                        {item.memberRanks.length > 0 && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {item.memberRanks.map((mr, j) => (
                              <span
                                key={j}
                                title={`${mr.name}: ${mr.rank === N + 1 ? "unranked" : `#${mr.rank}`}`}
                                className="text-[9px] font-mono tabular-nums px-1 py-0.5 rounded bg-[var(--bg-card-hover)] text-[var(--foreground-dim)]"
                              >
                                {mr.rank === N + 1 ? "—" : mr.rank}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          {canEdit && submittedCount > 0 && (
            <div className="px-4 py-3 border-t border-[var(--border)] shrink-0">
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {applying ? "Applying…" : "Apply consensus to pick list"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {myRanking.length === 0 ? (
              <div className="m-4 p-6 text-center rounded-xl border-2 border-dashed border-[var(--border)] text-xs text-[var(--foreground-dim)]">
                The pick list is empty.
              </div>
            ) : (
              <ul>
                {myRanking.map((teamNumber, i) => {
                  const entry = entries.find((e) => e.teamNumber === teamNumber);
                  if (!entry) return null;
                  return (
                    <li
                      key={teamNumber}
                      className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]/40 last:border-b-0 hover:bg-[var(--bg-card-hover)]/60"
                    >
                      <span className="text-xs text-[var(--foreground-dim)] font-mono w-7 text-right tabular-nums shrink-0">
                        #{i + 1}
                      </span>
                      <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
                        {teamNumber}
                      </span>
                      <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                        {entry.teamName}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          disabled={i === 0}
                          onClick={() => moveMyRanking(i, i - 1)}
                          title="Move up"
                          className="p-1 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)] disabled:opacity-30 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          disabled={i === myRanking.length - 1}
                          onClick={() => moveMyRanking(i, i + 1)}
                          title="Move down"
                          className="p-1 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)] disabled:opacity-30 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="px-4 py-3 border-t border-[var(--border)] shrink-0 space-y-2">
            {saveError && (
              <p className="text-[11px] text-red-400 text-right">{saveError}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--foreground-dim)]">
                {submittedCount} of {totalMembers} member{totalMembers !== 1 ? "s" : ""} submitted
              </p>
              <button
                onClick={handleSave}
                disabled={saving || (hasMySubmission && !isDirty)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : hasMySubmission ? "Update my ranking" : "Submit my ranking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
