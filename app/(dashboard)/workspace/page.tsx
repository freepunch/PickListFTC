"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { joinWorkspaceByInvite, lookupInvite } from "@/lib/workspace";
import { CreateWorkspaceCard, JoinWorkspaceCard } from "./_components/EmptyState";
import { OverviewTab } from "./_components/OverviewTab";
import { NotesTab } from "./_components/NotesTab";
import { PickListsTab } from "./_components/PickListsTab";
import { MembersTab } from "./_components/MembersTab";
import { AdminSettingsModal } from "./_components/AdminSettingsModal";

type TabId = "overview" | "notes" | "picklists" | "members";

export default function WorkspacePage() {
  const { user, loading: authLoading } = useAuth();
  const { loading, isInWorkspace, workspace, role, pendingSuggestions } =
    useWorkspace();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-zinc-500">Loading workspace…</p>
      </div>
    );
  }

  if (!user) return null;
  if (!isInWorkspace) return <NoWorkspaceView />;
  if (!workspace) return null;

  const isAdmin = role === "admin";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--foreground)]">
              {workspace.name}
            </h1>
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${
                role === "admin"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : role === "editor"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-700/50 text-zinc-300 border border-zinc-700"
              }`}
            >
              {role}
            </span>
          </div>
          <p className="text-xs text-[var(--foreground-dim)] mt-0.5">
            {workspace.team_number ? `Team ${workspace.team_number} · ` : ""}
            DECODE 2025-2026 ·{" "}
            <span className="font-mono">{workspace.invite_code}</span>
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.932 6.932 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </button>
        )}
      </div>

      <div className="flex border-b border-[var(--border)] px-3 shrink-0 overflow-x-auto">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "notes", label: "Team Notes" },
            {
              id: "picklists",
              label: "Pick Lists",
              badge: pendingSuggestions.length || undefined,
            },
            { id: "members", label: "Members" },
          ] as { id: TabId; label: string; badge?: number }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "text-[var(--foreground)] border-[var(--accent)]"
                : "text-[var(--foreground-dim)] hover:text-[var(--foreground-muted)] border-transparent"
            }`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewTab />}
        {tab === "notes" && <NotesTab />}
        {tab === "picklists" && <PickListsTab />}
        {tab === "members" && <MembersTab />}
      </div>

      {showSettings && (
        <AdminSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function NoWorkspaceView() {
  const { user } = useAuth();
  const { refresh } = useWorkspace();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [confirmJoin, setConfirmJoin] = useState<{
    name: string;
    code: string;
    memberCount: number;
  } | null>(null);

  const handleLookup = async () => {
    setJoinError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const invite = await lookupInvite(code);
    if (!invite) {
      setJoinError("Invalid invite code — check with your team admin.");
      return;
    }
    if (invite.invite_disabled) {
      setJoinError("This invite link has been disabled.");
      return;
    }
    setConfirmJoin({
      name: invite.name,
      code,
      memberCount: invite.member_count,
    });
  };

  const handleConfirmJoin = async () => {
    if (!user || !confirmJoin) return;
    setJoining(true);
    const res = await joinWorkspaceByInvite(user.id, confirmJoin.code);
    setJoining(false);
    if (!res.ok) {
      setJoinError(res.error);
      setConfirmJoin(null);
      return;
    }
    setConfirmJoin(null);
    await refresh();
    router.refresh();
  };

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1">
        Team Workspace
      </h1>
      <p className="text-sm text-[var(--foreground-dim)] mb-8">
        Collaborate with your team on shared notes and a single pick list.
        Real-time updates, role-based controls, and one workspace per team for
        the season.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <CreateWorkspaceCard />
        <JoinWorkspaceCard
          code={joinCode}
          setCode={setJoinCode}
          error={joinError}
          onSubmit={handleLookup}
        />
      </div>

      {confirmJoin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              Join {confirmJoin.name}?
            </h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              You&apos;ll be added as a viewer. The workspace currently has{" "}
              {confirmJoin.memberCount}{" "}
              {confirmJoin.memberCount === 1 ? "member" : "members"}.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmJoin(null)}
                className="px-3 py-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmJoin}
                disabled={joining}
                className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
