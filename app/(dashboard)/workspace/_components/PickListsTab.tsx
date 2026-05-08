"use client";

import { useEffect, useState } from "react";
import { useEvent } from "@/context/EventContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  WorkspacePickList,
  formatRelative,
  loadWorkspacePickLists,
  saveWorkspacePickList,
} from "@/lib/workspace";
import { useAuth } from "@/context/AuthContext";
import { CollaborativePickListView } from "./CollaborativePickListView";

export function PickListsTab() {
  const { user } = useAuth();
  const { workspace, role, refreshSuggestions } = useWorkspace();
  const { event, eventCode } = useEvent();
  const [lists, setLists] = useState<WorkspacePickList[]>([]);
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canEdit = role === "admin" || role === "editor";

  const reload = async () => {
    if (!workspace) return;
    setLists(await loadWorkspacePickLists(workspace.id));
  };

  useEffect(() => {
    if (!workspace) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  if (!workspace) return null;
  const openList = lists.find((l) => l.id === openListId);

  const handleCreate = async () => {
    if (!user || !workspace || !eventCode) return;
    setCreating(true);
    const fresh = await saveWorkspacePickList(
      workspace.id,
      eventCode,
      { entries: [] },
      user.id
    );
    setCreating(false);
    if (fresh) {
      await reload();
      setOpenListId(fresh.id);
      refreshSuggestions();
    }
  };

  if (openList) {
    return (
      <CollaborativePickListView
        list={openList}
        onClose={() => {
          setOpenListId(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Workspace pick lists
          </h3>
          <p className="text-xs text-[var(--foreground-dim)] mt-0.5">
            One list per event — everyone in the workspace sees the same data.
          </p>
        </div>
        {canEdit &&
          eventCode &&
          !lists.some((l) => l.event_code === eventCode) && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : `Create pick list for ${eventCode}`}
            </button>
          )}
      </div>

      {!eventCode && lists.length === 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center text-sm text-[var(--foreground-dim)]">
          Load an event first to create a pick list, or open an existing one
          below.
        </div>
      )}

      {lists.length === 0 && eventCode && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center text-sm text-[var(--foreground-dim)]">
          No pick lists yet.
          {canEdit
            ? ` Create one for ${eventCode} above.`
            : " Ask an admin or editor to create one."}
        </div>
      )}

      {lists.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {lists.map((l) => (
              <li
                key={l.id}
                onClick={() => setOpenListId(l.id)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
              >
                <div className="font-mono font-bold text-[var(--foreground)] shrink-0">
                  {l.event_code}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {l.list_data.entries.length} team
                    {l.list_data.entries.length === 1 ? "" : "s"} ranked
                  </p>
                  <p className="text-[11px] text-[var(--foreground-dim)]">
                    Last edited{" "}
                    {l.lastEditorName ? `by ${l.lastEditorName} ` : ""}
                    {formatRelative(l.updated_at)}
                  </p>
                </div>
                {event?.code === l.event_code && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                )}
                <svg
                  className="w-4 h-4 text-[var(--foreground-dim)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
