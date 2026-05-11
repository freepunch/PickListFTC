"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/context/EventContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import {
  SuggestionType,
  WorkspacePickList,
  WorkspacePickListEntry,
  WorkspaceSuggestion,
  createSuggestion,
  formatRelative,
  loadSuggestions,
  loadWorkspacePickList,
  saveWorkspacePickList,
  updateSuggestionStatus,
} from "@/lib/workspace";
import { ConsensusView } from "./ConsensusView";

interface Props {
  list: WorkspacePickList;
  onClose: () => void;
}

export function CollaborativePickListView({ list: initial, onClose }: Props) {
  const { user } = useAuth();
  const { workspace, role, refreshSuggestions } = useWorkspace();
  const { event, teams, loadEvent, setEventCode } = useEvent();
  const [list, setList] = useState<WorkspacePickList>(initial);
  const [activeTab, setActiveTab] = useState<"list" | "consensus">("list");
  const [suggestions, setSuggestions] = useState<WorkspaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    type: SuggestionType;
    teamNumber: number;
    teamName: string;
    targetPosition?: number | null;
  } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [savingReason, setSavingReason] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(initial.list_data));

  const canEdit = role === "admin" || role === "editor";

  useEffect(() => {
    if (!event || event.code !== list.event_code) {
      setEventCode(list.event_code);
      loadEvent(list.event_code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.event_code]);

  const reloadSuggestions = useCallback(async () => {
    if (!workspace) return;
    setSuggestions(await loadSuggestions(workspace.id, list.id));
  }, [workspace, list.id]);

  useEffect(() => {
    reloadSuggestions();
  }, [reloadSuggestions]);

  useEffect(() => {
    if (!workspace) return;
    const ch = supabase
      .channel(`ws-list:${list.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_pick_lists",
          filter: `id=eq.${list.id}`,
        },
        async () => {
          const fresh = await loadWorkspacePickList(workspace.id, list.event_code);
          if (fresh) {
            const remote = JSON.stringify(fresh.list_data);
            if (remote !== lastSavedRef.current) {
              lastSavedRef.current = remote;
              setList(fresh);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_suggestions",
          filter: `pick_list_id=eq.${list.id}`,
        },
        () => {
          reloadSuggestions();
          refreshSuggestions();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspace, list.id, list.event_code, reloadSuggestions, refreshSuggestions]);

  const persist = useCallback(
    (next: WorkspacePickListEntry[]) => {
      if (!user || !workspace || !canEdit) return;
      const data = { entries: next };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const fresh = await saveWorkspacePickList(
          workspace.id,
          list.event_code,
          data,
          user.id
        );
        if (fresh) {
          lastSavedRef.current = JSON.stringify(fresh.list_data);
          setList(fresh);
        }
      }, 700);
    },
    [user, workspace, canEdit, list.event_code]
  );

  const allTeams = useMemo(() => {
    if (!event) return [];
    const oprMap = new Map(
      teams.map((t) => [t.teamNumber, t.stats.opr.totalPointsNp])
    );
    return event.teams
      .map((tep) => ({
        teamNumber: tep.teamNumber,
        teamName: tep.team.name,
        opr: oprMap.get(tep.teamNumber) ?? 0,
      }))
      .sort((a, b) => b.opr - a.opr);
  }, [event, teams]);

  const entryNumbers = useMemo(
    () => new Set(list.list_data.entries.map((e) => e.teamNumber)),
    [list.list_data.entries]
  );
  const availableTeams = allTeams.filter((t) => !entryNumbers.has(t.teamNumber));

  const updateEntries = (next: WorkspacePickListEntry[]) => {
    if (!canEdit) return;
    setList((prev) => ({ ...prev, list_data: { entries: next } }));
    persist(next);
  };

  const addEntry = (team: { teamNumber: number; teamName: string; opr: number }) => {
    updateEntries([
      ...list.list_data.entries,
      { ...team, notes: "", picked: false },
    ]);
  };

  const removeEntry = (teamNumber: number) => {
    updateEntries(list.list_data.entries.filter((e) => e.teamNumber !== teamNumber));
  };

  const moveEntry = (from: number, to: number) => {
    if (from === to) return;
    const next = [...list.list_data.entries];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateEntries(next);
  };

  const submitSuggestion = async () => {
    if (!pendingSuggestion || !user || !workspace) return;
    setSavingReason(true);
    await createSuggestion({
      workspaceId: workspace.id,
      pickListId: list.id,
      authorId: user.id,
      suggestionType: pendingSuggestion.type,
      teamNumber: pendingSuggestion.teamNumber,
      targetPosition: pendingSuggestion.targetPosition ?? null,
      reason: reasonText.trim() || undefined,
    });
    setSavingReason(false);
    setPendingSuggestion(null);
    setReasonText("");
    reloadSuggestions();
  };

  const acceptSuggestion = async (s: WorkspaceSuggestion) => {
    if (!canEdit) return;
    let next = [...list.list_data.entries];
    if (s.suggestion_type === "remove") {
      next = next.filter((e) => e.teamNumber !== s.team_number);
    } else if (s.suggestion_type === "add") {
      const team = allTeams.find((t) => t.teamNumber === s.team_number);
      const newEntry: WorkspacePickListEntry = {
        teamNumber: s.team_number,
        teamName: team?.teamName ?? `Team ${s.team_number}`,
        opr: team?.opr ?? 0,
        notes: "",
        picked: false,
      };
      const pos = s.target_position ?? next.length;
      next = [...next.slice(0, pos), newEntry, ...next.slice(pos)];
    } else if (s.suggestion_type === "move") {
      const from = next.findIndex((e) => e.teamNumber === s.team_number);
      if (from >= 0) {
        const to = Math.max(0, Math.min(next.length - 1, s.target_position ?? from));
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
      }
    }
    updateEntries(next);
    await updateSuggestionStatus(s.id, "accepted");
    reloadSuggestions();
    refreshSuggestions();
  };

  const rejectSuggestion = async (s: WorkspaceSuggestion) => {
    if (!canEdit) return;
    await updateSuggestionStatus(s.id, "rejected");
    reloadSuggestions();
    refreshSuggestions();
  };

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const eventReady = event?.code === list.event_code;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              {list.event_code} pick list
            </p>
            <p className="text-[11px] text-[var(--foreground-dim)]">
              Last edited {list.lastEditorName ? `by ${list.lastEditorName} ` : ""}
              {formatRelative(list.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md p-0.5 mr-1">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === "list"
                  ? "bg-[var(--bg-card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setActiveTab("consensus")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === "consensus"
                  ? "bg-[var(--bg-card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Consensus
            </button>
          </div>
          <button
            onClick={() => setShowSuggestions((s) => !s)}
            className="relative px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Suggestions
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {!eventReady && (
        <div className="px-6 py-3 text-xs text-[var(--foreground-dim)] bg-[var(--bg-card-hover)]/40 border-b border-[var(--border)]">
          Loading event data for {list.event_code}…
        </div>
      )}

      {activeTab === "consensus" && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ConsensusView
            list={list}
            onApplied={(updated) => {
              setList(updated);
              setActiveTab("list");
            }}
          />
        </div>
      )}

      {activeTab === "list" && <div className="flex flex-1 min-h-0 overflow-hidden">
        {canEdit && (
          <div className="w-72 shrink-0 border-r border-[var(--border)] flex flex-col">
            <div className="px-4 py-2.5 border-b border-[var(--border)]">
              <p className="text-sm font-medium text-[var(--foreground-muted)]">
                Available
              </p>
              <p className="text-[11px] text-[var(--foreground-dim)]">
                {availableTeams.length} team
                {availableTeams.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {availableTeams.map((t) => (
                <button
                  key={t.teamNumber}
                  onClick={() => addEntry(t)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-card-hover)] border-b border-[var(--border)]/50 last:border-b-0"
                >
                  <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-12 shrink-0">
                    {t.teamNumber}
                  </span>
                  <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                    {t.teamName}
                  </span>
                  <span className="font-mono text-xs text-[var(--foreground-dim)] shrink-0 tabular-nums">
                    {t.opr.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--foreground-muted)]">
                Workspace list
              </p>
              <p className="text-[11px] text-[var(--foreground-dim)]">
                {list.list_data.entries.length} ranked
              </p>
            </div>
            {!canEdit && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-300 border border-zinc-700">
                View only — submit suggestions below
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {list.list_data.entries.length === 0 ? (
              <div className="m-4 p-6 text-center rounded-xl border-2 border-dashed border-[var(--border)] text-xs text-[var(--foreground-dim)]">
                {canEdit
                  ? "Click teams from the left to add them."
                  : "The list is empty. Use the suggest button below to propose teams."}
              </div>
            ) : (
              <ul>
                {list.list_data.entries.map((entry, i) => (
                  <PickListRow
                    key={entry.teamNumber}
                    entry={entry}
                    rank={i + 1}
                    canEdit={canEdit}
                    onMoveUp={i > 0 ? () => moveEntry(i, i - 1) : undefined}
                    onMoveDown={
                      i < list.list_data.entries.length - 1
                        ? () => moveEntry(i, i + 1)
                        : undefined
                    }
                    onRemove={() => removeEntry(entry.teamNumber)}
                    onSuggestRemove={() =>
                      setPendingSuggestion({
                        type: "remove",
                        teamNumber: entry.teamNumber,
                        teamName: entry.teamName,
                      })
                    }
                    onSuggestMoveUp={
                      i > 0
                        ? () =>
                            setPendingSuggestion({
                              type: "move",
                              teamNumber: entry.teamNumber,
                              teamName: entry.teamName,
                              targetPosition: i - 1,
                            })
                        : undefined
                    }
                    onSuggestMoveDown={
                      i < list.list_data.entries.length - 1
                        ? () =>
                            setPendingSuggestion({
                              type: "move",
                              teamNumber: entry.teamNumber,
                              teamName: entry.teamName,
                              targetPosition: i + 1,
                            })
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </div>

          {!canEdit && availableTeams.length > 0 && (
            <SuggestAddBar
              available={availableTeams}
              onSuggest={(team) =>
                setPendingSuggestion({
                  type: "add",
                  teamNumber: team.teamNumber,
                  teamName: team.teamName,
                  targetPosition: list.list_data.entries.length,
                })
              }
            />
          )}
        </div>

        {showSuggestions && (
          <div className="w-80 shrink-0 border-l border-[var(--border)] flex flex-col">
            <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground-muted)]">
                  Suggestions
                </p>
                <p className="text-[11px] text-[var(--foreground-dim)]">
                  {pendingCount} pending · {suggestions.length} total
                </p>
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-[var(--foreground-dim)] hover:text-[var(--foreground)]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {suggestions.length === 0 ? (
                <p className="px-4 py-6 text-xs text-[var(--foreground-dim)] text-center">
                  No suggestions yet.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {suggestions.map((s) => (
                    <SuggestionItem
                      key={s.id}
                      suggestion={s}
                      canDecide={canEdit && s.status === "pending"}
                      onAccept={() => acceptSuggestion(s)}
                      onReject={() => rejectSuggestion(s)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>}

      {pendingSuggestion && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              Suggest{" "}
              {pendingSuggestion.type === "add"
                ? "adding"
                : pendingSuggestion.type === "remove"
                ? "removing"
                : "moving"}{" "}
              Team {pendingSuggestion.teamNumber}
            </h3>
            <p className="text-xs text-[var(--foreground-dim)] mb-3">
              An admin or editor will review your suggestion. Add a reason if
              you&apos;d like.
            </p>
            <textarea
              autoFocus
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value.slice(0, 280))}
              maxLength={280}
              rows={3}
              placeholder="Optional reason (e.g. Strong endgame in the last two matches)"
              className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)] resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setPendingSuggestion(null);
                  setReasonText("");
                }}
                className="px-3 py-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitSuggestion}
                disabled={savingReason}
                className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {savingReason ? "Submitting…" : "Submit suggestion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PickListRow({
  entry,
  rank,
  canEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSuggestRemove,
  onSuggestMoveUp,
  onSuggestMoveDown,
}: {
  entry: WorkspacePickListEntry;
  rank: number;
  canEdit: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
  onSuggestRemove: () => void;
  onSuggestMoveUp?: () => void;
  onSuggestMoveDown?: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]/40 last:border-b-0 hover:bg-[var(--bg-card-hover)]/60 group">
      <span className="text-xs text-[var(--foreground-dim)] font-mono w-7 text-right tabular-nums shrink-0">
        #{rank}
      </span>
      <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
        {entry.teamNumber}
      </span>
      <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
        {entry.teamName}
      </span>
      <span className="font-mono text-xs text-[var(--foreground-dim)] w-12 text-right shrink-0 tabular-nums">
        {entry.opr.toFixed(1)}
      </span>
      {canEdit ? (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn onClick={onMoveUp} disabled={!onMoveUp} title="Move up">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
          </IconBtn>
          <IconBtn onClick={onMoveDown} disabled={!onMoveDown} title="Move down">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </IconBtn>
          <IconBtn onClick={onRemove} title="Remove" danger>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </IconBtn>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {onSuggestMoveUp && (
            <button
              onClick={onSuggestMoveUp}
              title="Suggest move up"
              className="text-[10px] px-1.5 py-0.5 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)]"
            >
              ↑
            </button>
          )}
          {onSuggestMoveDown && (
            <button
              onClick={onSuggestMoveDown}
              title="Suggest move down"
              className="text-[10px] px-1.5 py-0.5 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)]"
            >
              ↓
            </button>
          )}
          <button
            onClick={onSuggestRemove}
            title="Suggest remove"
            className="text-[10px] px-1.5 py-0.5 rounded text-[var(--foreground-dim)] hover:text-red-400 hover:bg-red-500/10"
          >
            Suggest
          </button>
        </div>
      )}
    </li>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded transition-colors ${
        disabled
          ? "text-[var(--foreground-dim)] opacity-30"
          : danger
          ? "text-[var(--foreground-dim)] hover:text-red-400 hover:bg-red-500/10"
          : "text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)]"
      }`}
    >
      {children}
    </button>
  );
}

function SuggestAddBar({
  available,
  onSuggest,
}: {
  available: { teamNumber: number; teamName: string; opr: number }[];
  onSuggest: (team: { teamNumber: number; teamName: string; opr: number }) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available.slice(0, 8);
    return available
      .filter(
        (t) =>
          String(t.teamNumber).includes(q) ||
          t.teamName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [available, query]);

  return (
    <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-card-hover)]/40">
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suggest a team to add…"
          className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)]"
        />
        {open && matches.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl max-h-48 overflow-y-auto z-10">
            {matches.map((t) => (
              <button
                key={t.teamNumber}
                onMouseDown={() => {
                  onSuggest(t);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-card-hover)] text-left"
              >
                <span className="font-mono text-xs font-semibold text-[var(--foreground)] w-12">
                  {t.teamNumber}
                </span>
                <span className="text-xs text-[var(--foreground-muted)] truncate">
                  {t.teamName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionItem({
  suggestion,
  canDecide,
  onAccept,
  onReject,
}: {
  suggestion: WorkspaceSuggestion;
  canDecide: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const verb =
    suggestion.suggestion_type === "add"
      ? "Add"
      : suggestion.suggestion_type === "remove"
      ? "Remove"
      : "Move";
  const statusClass =
    suggestion.status === "pending"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
      : suggestion.status === "accepted"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : "text-[var(--foreground-dim)] bg-[var(--bg-card-hover)] border-[var(--border)]";
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-[var(--foreground)]">
          {verb} Team {suggestion.team_number}
          {suggestion.suggestion_type === "move" &&
            suggestion.target_position !== null && (
              <span className="text-[var(--foreground-dim)]">
                {" "}→ #{(suggestion.target_position ?? 0) + 1}
              </span>
            )}
        </p>
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusClass}`}
        >
          {suggestion.status}
        </span>
      </div>
      <p className="text-[11px] text-[var(--foreground-dim)]">
        {suggestion.authorName ?? "Member"} · {formatRelative(suggestion.created_at)}
      </p>
      {suggestion.reason && (
        <p className="text-xs text-[var(--foreground-muted)] mt-1.5 italic">
          “{suggestion.reason}”
        </p>
      )}
      {canDecide && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={onAccept}
            className="flex-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-2 py-1 rounded text-xs font-medium bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}
