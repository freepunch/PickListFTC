"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  describeActivity,
  formatRelative,
  loadActivity,
  loadWorkspacePickLists,
  WorkspaceActivity,
} from "@/lib/workspace";

export function OverviewTab() {
  const { workspace, members, notes } = useWorkspace();
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [pickListEvents, setPickListEvents] = useState<number>(0);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    loadActivity(workspace.id, 20).then(setActivity);
    loadWorkspacePickLists(workspace.id).then((lists) =>
      setPickListEvents(lists.length)
    );
  }, [workspace]);

  if (!workspace) return null;

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${workspace.invite_code}`
      : `/join/${workspace.invite_code}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Members" value={members.length} />
        <Stat label="Shared notes" value={notes.length} />
        <Stat label="Pick lists" value={pickListEvents} />
        <Stat
          label="Season"
          value={`${workspace.season}-${(workspace.season + 1).toString().slice(-2)}`}
        />
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Invite teammates
          </h3>
          {workspace.invite_disabled && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
              Disabled
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--foreground-dim)] mb-3">
          Share this link or the 6-character code. They&apos;ll join as a viewer
          and you can promote them later.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-mono text-[var(--foreground-muted)] truncate">
            {inviteUrl}
          </code>
          <button
            onClick={copyInvite}
            className="px-3 py-2 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
          >
            {copyToast ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
            Code
          </span>
          <span className="text-lg font-mono font-bold tracking-[0.3em] text-[var(--foreground)]">
            {workspace.invite_code}
          </span>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Recent activity
          </h3>
        </div>
        {activity.length === 0 ? (
          <div className="px-5 py-6 text-xs text-[var(--foreground-dim)] text-center">
            No activity yet — invite a teammate or add a shared note.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {activity.map((a) => (
              <li
                key={a.id}
                className="px-5 py-2.5 flex items-center justify-between gap-3"
              >
                <span className="text-sm text-[var(--foreground-muted)] truncate">
                  {describeActivity(a)}
                </span>
                <span className="text-[11px] text-[var(--foreground-dim)] shrink-0">
                  {formatRelative(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">
        {value}
      </p>
    </div>
  );
}
