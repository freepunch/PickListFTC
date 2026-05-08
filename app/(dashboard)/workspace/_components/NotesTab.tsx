"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { tagColorClass } from "@/lib/notes";
import { deleteWorkspaceNote, formatRelative } from "@/lib/workspace";

export function NotesTab() {
  const { user } = useAuth();
  const { workspace, role, notes, refreshNotes } = useWorkspace();
  const [eventFilter, setEventFilter] = useState<string>("__all__");
  const [teamQuery, setTeamQuery] = useState("");

  const events = useMemo(() => {
    const set = new Set(notes.map((n) => n.event_code));
    return Array.from(set).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = teamQuery.trim();
    return notes.filter((n) => {
      if (eventFilter !== "__all__" && n.event_code !== eventFilter) return false;
      if (q && !String(n.team_number).includes(q)) return false;
      return true;
    });
  }, [notes, eventFilter, teamQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<number, typeof filtered>>();
    for (const n of filtered) {
      let teamMap = map.get(n.event_code);
      if (!teamMap) {
        teamMap = new Map();
        map.set(n.event_code, teamMap);
      }
      const list = teamMap.get(n.team_number) ?? [];
      list.push(n);
      teamMap.set(n.team_number, list);
    }
    return map;
  }, [filtered]);

  if (!workspace) return null;
  const isAdmin = role === "admin";

  const handleDelete = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;
    await deleteWorkspaceNote(noteId);
    await refreshNotes();
  };

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="__all__">All events ({events.length})</option>
          {events.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value.replace(/\D/g, ""))}
          placeholder="Filter by team #"
          className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)] w-32 font-mono"
        />
        <span className="text-xs text-[var(--foreground-dim)]">
          {filtered.length} note{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-10 text-center text-sm text-[var(--foreground-dim)]">
          No shared notes yet. Add one from a team row on the leaderboard or
          report page (toggle &quot;Share to workspace&quot; when saving).
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([eventCode, teamMap]) => (
            <div key={eventCode}>
              <h3 className="text-xs uppercase tracking-wider text-[var(--foreground-dim)] font-semibold mb-2">
                {eventCode}
              </h3>
              <div className="space-y-3">
                {Array.from(teamMap.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([team, teamNotes]) => (
                    <div
                      key={team}
                      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-bold text-[var(--foreground)]">
                          Team {team}
                        </span>
                        <span className="text-[11px] text-[var(--foreground-dim)]">
                          {teamNotes.length} note
                          {teamNotes.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {teamNotes.map((n) => {
                          const mine = n.author_id === user?.id;
                          return (
                            <li
                              key={n.id}
                              className="flex flex-col gap-1.5 border-l-2 border-teal-500/30 pl-3 py-1"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-[var(--foreground-muted)]">
                                  {n.authorName ?? "Member"}
                                  {mine && (
                                    <span className="text-[var(--foreground-dim)]"> (you)</span>
                                  )}
                                </span>
                                <span className="text-[11px] text-[var(--foreground-dim)]">
                                  {formatRelative(n.created_at)}
                                </span>
                              </div>
                              {n.text && (
                                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                                  {n.text}
                                </p>
                              )}
                              {n.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {n.tags.map((t) => (
                                    <span
                                      key={t}
                                      className={`px-2 py-0.5 rounded-full text-[10px] ${tagColorClass(
                                        t
                                      )}`}
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(mine || isAdmin) && (
                                <button
                                  onClick={() => handleDelete(n.id)}
                                  className="self-start text-[11px] text-[var(--foreground-dim)] hover:text-red-400 transition-colors mt-0.5"
                                >
                                  Delete
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
