"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  WorkspaceRole,
  formatExpiry,
  formatRelative,
  leaveWorkspace,
  removeMember,
  updateMemberRole,
} from "@/lib/workspace";

const ROLE_OPTIONS: WorkspaceRole[] = ["admin", "editor", "viewer"];

export function MembersTab() {
  const { user } = useAuth();
  const {
    workspace,
    role,
    members,
    refresh,
    refreshMembers,
    isExpired,
    daysUntilExpiry,
  } = useWorkspace();
  const router = useRouter();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renewing, setRenewing] = useState(false);

  if (!workspace) return null;
  const isAdmin = role === "admin";

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const res = await fetch("/api/workspace-renew", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setRenewing(false);
    } catch {
      setRenewing(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: WorkspaceRole) => {
    if (userId === workspace.owner_id && newRole !== "admin") {
      alert("Owner must remain an admin.");
      return;
    }
    setBusy(true);
    await updateMemberRole(workspace.id, userId, newRole);
    await refreshMembers();
    setBusy(false);
  };

  const handleRemove = async (userId: string) => {
    setBusy(true);
    await removeMember(workspace.id, userId);
    await refreshMembers();
    setConfirmRemove(null);
    setBusy(false);
  };

  const handleLeave = async () => {
    if (!user) return;
    setBusy(true);
    await leaveWorkspace(user.id, workspace.id);
    setBusy(false);
    setConfirmLeave(false);
    await refresh();
    router.refresh();
  };

  return (
    <div className="px-6 py-6 max-w-3xl">
      {isAdmin && workspace.expires_at && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border p-4 mb-6 ${
            isExpired
              ? "bg-red-500/10 border-red-500/20"
              : daysUntilExpiry !== null && daysUntilExpiry <= 7
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-[var(--bg-card)] border-[var(--border)]"
          }`}
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
              Subscription
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">
              {isExpired
                ? "Expired"
                : `Active until ${formatExpiry(workspace.expires_at)}`}
            </p>
            {!isExpired &&
              daysUntilExpiry !== null &&
              daysUntilExpiry <= 30 && (
                <p
                  className={`text-xs mt-0.5 ${
                    daysUntilExpiry <= 7 ? "text-red-400" : "text-amber-400"
                  }`}
                >
                  {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}{" "}
                  remaining
                </p>
              )}
          </div>
          <button
            onClick={handleRenew}
            disabled={renewing}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            {renewing ? "Redirecting…" : "Renew · $20"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {members.length} member{members.length === 1 ? "" : "s"}
        </h3>
        {!isAdmin && (
          <button
            onClick={() => setConfirmLeave(true)}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--foreground-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Leave Workspace
          </button>
        )}
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">
          {members
            .slice()
            .sort((a, b) => {
              const order = (r: string) =>
                r === "admin" ? 0 : r === "editor" ? 1 : 2;
              return order(a.role) - order(b.role);
            })
            .map((m) => {
              const isMe = m.user_id === user?.id;
              const isOwner = m.user_id === workspace.owner_id;
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--foreground)] shrink-0">
                    {(m.display_name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)] truncate">
                        {m.display_name ?? "Unnamed member"}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-[var(--foreground-dim)]">
                          (you)
                        </span>
                      )}
                      {isOwner && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--foreground-dim)]">
                      Joined {formatRelative(m.joined_at)}
                    </p>
                  </div>

                  {isAdmin && !isOwner ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        handleRoleChange(m.user_id, e.target.value as WorkspaceRole)
                      }
                      disabled={busy}
                      className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0 focus:border-[var(--accent)] transition-all disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                        m.role === "admin"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                          : m.role === "editor"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-700/50 text-zinc-300 border border-zinc-700"
                      }`}
                    >
                      {m.role}
                    </span>
                  )}

                  {isAdmin && !isOwner && !isMe && (
                    <button
                      onClick={() => setConfirmRemove(m.user_id)}
                      className="text-[var(--foreground-dim)] hover:text-red-400 transition-colors p-1"
                      title="Remove member"
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
                  )}
                </li>
              );
            })}
        </ul>
      </div>

      {confirmRemove && (
        <ConfirmModal
          title="Remove this member?"
          body="They will lose access to the workspace, but their existing notes stay."
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => handleRemove(confirmRemove)}
          busy={busy}
        />
      )}

      {confirmLeave && (
        <ConfirmModal
          title="Leave this workspace?"
          body="You'll lose access to shared notes and pick lists. You can rejoin if an admin sends you a fresh invite."
          confirmLabel="Leave"
          danger
          onCancel={() => setConfirmLeave(false)}
          onConfirm={handleLeave}
          busy={busy}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
          {title}
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 text-white ${
              danger
                ? "bg-red-500/80 hover:bg-red-500"
                : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
