"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/context/EventContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { supabase } from "@/lib/supabase";
import {
  ScoutingAssignment,
  ScoutingStatus,
  WorkspaceMember,
  initializeAssignments,
  loadAssignments,
  upsertAssignment,
} from "@/lib/workspace";

// ── Constants ──────────────────────────────────────────────────────────────

const COLUMNS: {
  id: ScoutingStatus;
  label: string;
  accent: string;
  faint: string;
}[] = [
  {
    id: "unscouted",
    label: "Unscouted",
    accent: "text-[var(--foreground-dim)]",
    faint: "",
  },
  {
    id: "assigned",
    label: "Assigned",
    accent: "text-blue-400",
    faint: "bg-blue-500/5",
  },
  {
    id: "in_progress",
    label: "In Progress",
    accent: "text-amber-400",
    faint: "bg-amber-500/5",
  },
  {
    id: "scouted",
    label: "Scouted",
    accent: "text-emerald-400",
    faint: "bg-emerald-500/5",
  },
];

const MOVE_TARGETS: Record<ScoutingStatus, ScoutingStatus[]> = {
  unscouted: ["assigned"],
  assigned: ["unscouted", "in_progress", "scouted"],
  in_progress: ["assigned", "scouted"],
  scouted: ["in_progress"],
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function avatarColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function MemberAvatar({ name, userId }: { name: string; userId: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${avatarColor(userId)} text-white text-[9px] font-bold shrink-0 leading-none`}
    >
      {(name[0] ?? "?").toUpperCase()}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ScoutingBoard() {
  const { user } = useAuth();
  const { event, teams } = useEvent();
  const { workspace, role, members, notes } = useWorkspace();
  const canEdit = role === "admin" || role === "editor";

  const [assignments, setAssignments] = useState<ScoutingAssignment[]>([]);
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "syncing">("idle");
  const [myOnly, setMyOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"default" | "opr">("default");
  const [mobileTab, setMobileTab] = useState<ScoutingStatus>("unscouted");
  const [activeCard, setActiveCard] = useState<number | null>(null);

  const assignmentsRef = useRef(assignments);
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  // OPR map
  const oprMap = useMemo(
    () => new Map(teams.map((t) => [t.teamNumber, t.stats.opr.totalPointsNp])),
    [teams]
  );

  // Flat team list from event
  const eventTeams = useMemo(() => {
    if (!event) return [];
    return event.teams.map((tep) => ({
      teamNumber: tep.teamNumber,
      teamName: tep.team.name,
      opr: oprMap.get(tep.teamNumber) ?? 0,
    }));
  }, [event, oprMap]);

  const load = useCallback(
    async (quiet = false) => {
      if (!workspace || !event) return;
      setLoadingState(quiet ? "syncing" : "loading");

      const data = await loadAssignments(workspace.id, event.code);

      // Initialize any teams not yet in the board
      const assignedNums = new Set(data.map((a) => a.team_number));
      const missing = eventTeams
        .filter((t) => !assignedNums.has(t.teamNumber))
        .map((t) => t.teamNumber);
      if (missing.length) {
        await initializeAssignments(workspace.id, event.code, missing);
        const fresh = await loadAssignments(workspace.id, event.code);
        setAssignments(fresh);
      } else {
        setAssignments(data);
      }

      setLoadingState("idle");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace?.id, event?.code, eventTeams]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Auto-advance assigned → in_progress when workspace notes appear
  useEffect(() => {
    if (!workspace || !event) return;
    const current = assignmentsRef.current;
    const noteAuthorsByTeam = new Map<number, Set<string>>();
    for (const n of notes) {
      if (n.event_code !== event.code) continue;
      const s = noteAuthorsByTeam.get(n.team_number) ?? new Set<string>();
      s.add(n.author_id);
      noteAuthorsByTeam.set(n.team_number, s);
    }
    const toPromote = current.filter(
      (a) =>
        a.status === "assigned" &&
        a.assigned_to &&
        noteAuthorsByTeam.get(a.team_number)?.has(a.assigned_to)
    );
    if (!toPromote.length) return;
    Promise.all(
      toPromote.map((a) =>
        upsertAssignment(workspace.id, event.code, a.team_number, "in_progress", a.assigned_to)
      )
    ).then(() => load(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, workspace?.id, event?.code]);

  // Realtime
  useEffect(() => {
    if (!workspace) return;
    const ch = supabase
      .channel(`ws-scouting:${workspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_scouting_assignments",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => load(true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  // Assignment lookup map
  const assignmentMap = useMemo(
    () => new Map(assignments.map((a) => [a.team_number, a])),
    [assignments]
  );

  // Member name map
  const memberNameMap = useMemo(
    () =>
      new Map(
        members.map((m) => [
          m.user_id,
          m.display_name ?? `Member ${m.user_id.slice(0, 4)}`,
        ])
      ),
    [members]
  );

  // Note counts per team for this event
  const noteCountMap = useMemo(() => {
    if (!event) return new Map<number, number>();
    const m = new Map<number, number>();
    for (const n of notes) {
      if (n.event_code === event.code) m.set(n.team_number, (m.get(n.team_number) ?? 0) + 1);
    }
    return m;
  }, [notes, event]);

  // Build typed items
  type BoardItem = {
    teamNumber: number;
    teamName: string;
    opr: number;
    status: ScoutingStatus;
    assigned_to: string | null;
    assignedToName: string | null;
    noteCount: number;
  };

  const allItems: BoardItem[] = useMemo(
    () =>
      eventTeams.map((t) => {
        const a = assignmentMap.get(t.teamNumber);
        return {
          ...t,
          status: (a?.status ?? "unscouted") as ScoutingStatus,
          assigned_to: a?.assigned_to ?? null,
          assignedToName: a?.assignedToName ?? null,
          noteCount: noteCountMap.get(t.teamNumber) ?? 0,
        };
      }),
    [eventTeams, assignmentMap, noteCountMap]
  );

  const columns = useMemo(() => {
    let items = allItems;
    if (myOnly && user) items = items.filter((t) => t.assigned_to === user.id);
    if (sortMode === "opr") items = [...items].sort((a, b) => b.opr - a.opr);

    const grouped: Record<ScoutingStatus, BoardItem[]> = {
      unscouted: [],
      assigned: [],
      in_progress: [],
      scouted: [],
    };
    for (const item of items) grouped[item.status].push(item);
    return grouped;
  }, [allItems, myOnly, sortMode, user]);

  // Progress stats
  const progress = useMemo(() => {
    const total = eventTeams.length;
    const scouted = allItems.filter((t) => t.status === "scouted").length;
    const perMember = new Map<string, number>();
    for (const a of assignments) {
      if (a.status === "scouted" && a.assigned_to) {
        perMember.set(a.assigned_to, (perMember.get(a.assigned_to) ?? 0) + 1);
      }
    }
    return { total, scouted, perMember };
  }, [eventTeams, allItems, assignments]);

  const handleMove = useCallback(
    async (teamNumber: number, newStatus: ScoutingStatus, assignTo: string | null) => {
      if (!workspace || !event) return;
      setActiveCard(null);
      await upsertAssignment(workspace.id, event.code, teamNumber, newStatus, assignTo);
      await load(true);
    },
    [workspace, event, load]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (!event) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[var(--foreground-dim)]">
        Load an event from the sidebar to use the scouting board.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Progress header */}
      <div className="px-4 pt-3 pb-2.5 border-b border-[var(--border)] shrink-0 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="text-xs font-semibold text-[var(--foreground-muted)]">
            {progress.scouted} / {progress.total} teams scouted
          </span>
          <span className="text-[11px] text-[var(--foreground-dim)]">
            {COLUMNS.map((c) => `${c.label}: ${columns[c.id].length}`).join(" · ")}
          </span>
        </div>
        <div className="h-1.5 bg-[var(--bg-card-hover)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
            style={{
              width: `${progress.total ? (progress.scouted / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
        {progress.perMember.size > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--foreground-dim)]">
            {Array.from(progress.perMember.entries()).map(([uid, count]) => (
              <span key={uid}>
                <span className="text-[var(--foreground-muted)]">
                  {memberNameMap.get(uid) ?? "Member"}
                </span>
                : {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] shrink-0">
        <FilterChip active={myOnly} onClick={() => setMyOnly((v) => !v)}>
          My assignments
        </FilterChip>
        <FilterChip active={sortMode === "opr"} onClick={() => setSortMode((v) => (v === "opr" ? "default" : "opr"))}>
          Sort by OPR
        </FilterChip>
        {loadingState === "syncing" && (
          <span className="ml-auto text-[10px] text-[var(--foreground-dim)]">Syncing…</span>
        )}
        {loadingState === "loading" && (
          <span className="ml-auto text-[10px] text-[var(--foreground-dim)]">Loading…</span>
        )}
      </div>

      {/* Mobile column tabs */}
      <div className="md:hidden flex border-b border-[var(--border)] shrink-0">
        {COLUMNS.map((col) => (
          <button
            key={col.id}
            onClick={() => setMobileTab(col.id)}
            className={`flex-1 px-1 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              mobileTab === col.id
                ? `${col.accent} border-current`
                : "text-[var(--foreground-dim)] border-transparent"
            }`}
          >
            {col.label}
            <span className="ml-1 text-[10px] opacity-60">{columns[col.id].length}</span>
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Desktop: 4 columns */}
        <div className="hidden md:grid md:grid-cols-4 h-full divide-x divide-[var(--border)]">
          {COLUMNS.map((col) => (
            <BoardColumn
              key={col.id}
              col={col}
              items={columns[col.id]}
              user={user}
              members={members}
              memberNameMap={memberNameMap}
              canEdit={canEdit}
              activeCard={activeCard}
              onCardClick={(tn) =>
                setActiveCard((prev) => (prev === tn ? null : tn))
              }
              onMove={handleMove}
            />
          ))}
        </div>

        {/* Mobile: single column */}
        <div className="md:hidden h-full overflow-y-auto">
          <BoardColumn
            col={COLUMNS.find((c) => c.id === mobileTab)!}
            items={columns[mobileTab]}
            user={user}
            members={members}
            memberNameMap={memberNameMap}
            canEdit={canEdit}
            activeCard={activeCard}
            onCardClick={(tn) =>
              setActiveCard((prev) => (prev === tn ? null : tn))
            }
            onMove={handleMove}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
        active
          ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30"
          : "bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] border-[var(--border)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

type BoardItem = {
  teamNumber: number;
  teamName: string;
  opr: number;
  status: ScoutingStatus;
  assigned_to: string | null;
  assignedToName: string | null;
  noteCount: number;
};

function BoardColumn({
  col,
  items,
  user,
  members,
  memberNameMap,
  canEdit,
  activeCard,
  onCardClick,
  onMove,
}: {
  col: (typeof COLUMNS)[number];
  items: BoardItem[];
  user: { id: string } | null;
  members: WorkspaceMember[];
  memberNameMap: Map<string, string>;
  canEdit: boolean;
  activeCard: number | null;
  onCardClick: (teamNumber: number) => void;
  onMove: (teamNumber: number, status: ScoutingStatus, assignTo: string | null) => void;
}) {
  return (
    <div className={`flex flex-col h-full ${col.faint}`}>
      <div className="px-3 py-2.5 border-b border-[var(--border)] shrink-0">
        <p className={`text-xs font-semibold ${col.accent}`}>
          {col.label}
          <span className="ml-1.5 text-[var(--foreground-dim)] font-normal">{items.length}</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {items.length === 0 ? (
          <p className="text-center text-[11px] text-[var(--foreground-dim)] py-6">—</p>
        ) : (
          items.map((item) => (
            <TeamCard
              key={item.teamNumber}
              item={item}
              user={user}
              members={members}
              memberNameMap={memberNameMap}
              canEdit={canEdit}
              isActive={activeCard === item.teamNumber}
              onToggle={() => onCardClick(item.teamNumber)}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TeamCard({
  item,
  user,
  members,
  memberNameMap,
  canEdit,
  isActive,
  onToggle,
  onMove,
}: {
  item: BoardItem;
  user: { id: string } | null;
  members: WorkspaceMember[];
  memberNameMap: Map<string, string>;
  canEdit: boolean;
  isActive: boolean;
  onToggle: () => void;
  onMove: (teamNumber: number, status: ScoutingStatus, assignTo: string | null) => void;
}) {
  const [reassignTarget, setReassignTarget] = useState("");

  const isSelf = user && item.assigned_to === user.id;
  const canSelfAssign =
    user && !item.assigned_to && item.status === "unscouted";
  const canSelfAdvance =
    isSelf && (item.status === "assigned" || item.status === "in_progress");

  const nextTargets = MOVE_TARGETS[item.status];
  const colConfig = COLUMNS.find((c) => c.id === item.status)!;

  return (
    <div
      className={`rounded-lg border bg-zinc-900 transition-colors cursor-pointer select-none ${
        isActive ? "border-zinc-600" : "border-zinc-800 hover:border-zinc-700"
      }`}
      onClick={onToggle}
    >
      {/* Card body */}
      <div className="flex items-start gap-2 px-2.5 pt-2.5 pb-2">
        <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0 leading-tight">
          {item.teamNumber}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--foreground-muted)] truncate leading-tight">
            {item.teamName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.opr > 0 && (
              <span className="font-mono text-[10px] text-[var(--foreground-dim)]">
                {item.opr.toFixed(1)}
              </span>
            )}
            {item.assigned_to && (
              <>
                <span className="text-zinc-700">·</span>
                <MemberAvatar
                  name={memberNameMap.get(item.assigned_to) ?? "?"}
                  userId={item.assigned_to}
                />
                <span className="text-[10px] text-[var(--foreground-dim)] truncate">
                  {memberNameMap.get(item.assigned_to) ?? "Member"}
                </span>
              </>
            )}
          </div>
        </div>
        {item.noteCount > 0 && (
          <span className="text-[10px] bg-[var(--accent)]/15 text-[var(--accent)] px-1.5 py-0.5 rounded-full font-medium shrink-0 leading-none">
            {item.noteCount}
          </span>
        )}
      </div>

      {/* Action panel */}
      {isActive && (
        <div
          className="border-t border-zinc-800 px-2.5 py-2 flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Self-assign */}
          {canSelfAssign && (
            <ActionBtn
              color="blue"
              onClick={() => onMove(item.teamNumber, "assigned", user!.id)}
            >
              Assign to me
            </ActionBtn>
          )}

          {/* Self-advance (viewer only — editors have full controls below) */}
          {canSelfAdvance && !canEdit && item.status === "assigned" && (
            <ActionBtn
              color="amber"
              onClick={() => onMove(item.teamNumber, "in_progress", item.assigned_to)}
            >
              Start scouting
            </ActionBtn>
          )}
          {canSelfAdvance && !canEdit && item.status === "in_progress" && (
            <ActionBtn
              color="emerald"
              onClick={() => onMove(item.teamNumber, "scouted", item.assigned_to)}
            >
              Mark done
            </ActionBtn>
          )}

          {/* Editor/admin: move buttons */}
          {canEdit &&
            nextTargets.map((next) => {
              const cfg = COLUMNS.find((c) => c.id === next)!;
              return (
                <button
                  key={next}
                  onClick={() =>
                    onMove(item.teamNumber, next, item.assigned_to)
                  }
                  className={`px-2 py-0.5 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 transition-colors ${cfg.accent}`}
                >
                  → {cfg.label}
                </button>
              );
            })}

          {/* Editor/admin: assign/reassign */}
          {canEdit && (
            <div
              className="flex items-center gap-1 ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                value={reassignTarget}
                onChange={(e) => setReassignTarget(e.target.value)}
                className="text-[11px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 focus:border-[var(--accent)] transition-all"
              >
                <option value="">
                  {item.assigned_to ? "Reassign…" : "Assign to…"}
                </option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name ?? `Member ${m.user_id.slice(0, 4)}`}
                  </option>
                ))}
              </select>
              {reassignTarget && (
                <ActionBtn
                  color="blue"
                  onClick={() => {
                    const newStatus =
                      item.status === "unscouted" ? "assigned" : item.status;
                    onMove(item.teamNumber, newStatus, reassignTarget);
                    setReassignTarget("");
                  }}
                >
                  {item.assigned_to ? "Reassign" : "Assign"}
                </ActionBtn>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  color,
  onClick,
  children,
}: {
  color: "blue" | "amber" | "emerald";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = {
    blue: "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25",
    amber: "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25",
    emerald: "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
  }[color];
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[11px] transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}
