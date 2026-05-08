"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  deleteWorkspace,
  regenerateInviteCode,
  updateWorkspace,
} from "@/lib/workspace";

export function AdminSettingsModal({ onClose }: { onClose: () => void }) {
  const { workspace, refresh } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState(workspace?.name ?? "");
  const [team, setTeam] = useState(
    workspace?.team_number ? String(workspace.team_number) : ""
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  if (!workspace) return null;

  const dirty =
    name.trim() !== workspace.name ||
    (team.trim() ? parseInt(team, 10) : null) !== workspace.team_number;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    if (!dirty) return;
    setBusy(true);
    await updateWorkspace(workspace.id, {
      name: name.trim().slice(0, 80),
      team_number: team.trim() ? parseInt(team.trim(), 10) : null,
    });
    await refresh();
    setBusy(false);
    flash("Saved");
  };

  const handleRegen = async () => {
    setBusy(true);
    try {
      await regenerateInviteCode(workspace.id);
      await refresh();
      flash("New invite code generated");
    } catch {
      flash("Could not regenerate code");
    }
    setBusy(false);
    setConfirmRegen(false);
  };

  const handleToggleInvite = async () => {
    setBusy(true);
    await updateWorkspace(workspace.id, {
      invite_disabled: !workspace.invite_disabled,
    });
    await refresh();
    setBusy(false);
    flash(workspace.invite_disabled ? "Invite re-enabled" : "Invite disabled");
  };

  const handleDelete = async () => {
    if (deleteText.trim() !== workspace.name) {
      flash("Workspace name doesn't match");
      return;
    }
    setBusy(true);
    await deleteWorkspace(workspace.id);
    setBusy(false);
    setConfirmDelete(false);
    onClose();
    await refresh();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            Workspace settings
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)]"
          >
            <svg
              className="w-5 h-5"
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

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <h4 className="text-xs uppercase tracking-wider text-[var(--foreground-dim)] mb-2">
              Details
            </h4>
            <div className="space-y-2">
              <label className="block">
                <span className="text-[11px] text-[var(--foreground-dim)]">
                  Workspace name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 80))}
                  className="mt-1 w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-[var(--foreground-dim)]">
                  Team number
                </span>
                <input
                  type="text"
                  value={team}
                  onChange={(e) =>
                    setTeam(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  className="mt-1 w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </label>
              <button
                onClick={handleSave}
                disabled={!dirty || busy}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </section>

          <section>
            <h4 className="text-xs uppercase tracking-wider text-[var(--foreground-dim)] mb-2">
              Invite
            </h4>
            <div className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-lg p-3 mb-2">
              <p className="text-[11px] text-[var(--foreground-dim)]">
                Current code
              </p>
              <p className="text-base font-mono font-bold tracking-[0.3em] text-[var(--foreground)]">
                {workspace.invite_code}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmRegen(true)}
                disabled={busy}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
              >
                Regenerate code
              </button>
              <button
                onClick={handleToggleInvite}
                disabled={busy}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                  workspace.invite_disabled
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25"
                    : "bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {workspace.invite_disabled
                  ? "Re-enable invites"
                  : "Disable invites"}
              </button>
            </div>
          </section>

          <section>
            <h4 className="text-xs uppercase tracking-wider text-red-400 mb-2">
              Danger zone
            </h4>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              Delete workspace
            </button>
          </section>
        </div>

        {toast && (
          <div className="px-5 py-2 border-t border-[var(--border)] text-xs text-emerald-400">
            {toast}
          </div>
        )}
      </div>

      {confirmRegen && (
        <NestedConfirm
          title="Regenerate invite code?"
          body="The old link and code will stop working. Existing members stay in the workspace."
          confirmLabel="Regenerate"
          onCancel={() => setConfirmRegen(false)}
          onConfirm={handleRegen}
          busy={busy}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-red-500/30 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              Delete this workspace?
            </h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-3">
              This will permanently delete all shared notes, pick lists, and
              remove all members. This cannot be undone.
            </p>
            <p className="text-xs text-[var(--foreground-dim)] mb-2">
              Type{" "}
              <span className="font-mono text-[var(--foreground)]">
                {workspace.name}
              </span>{" "}
              to confirm:
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-red-500 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteText("");
                }}
                className="px-3 py-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy || deleteText.trim() !== workspace.name}
                className="px-4 py-1.5 text-sm bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NestedConfirm({
  title,
  body,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
          {title}
        </h3>
        <p className="text-sm text-[var(--foreground-muted)] mb-4">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
