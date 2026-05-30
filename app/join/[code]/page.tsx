"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceOptional } from "@/context/WorkspaceContext";
import {
  InviteLookup,
  joinWorkspaceByInvite,
  leaveWorkspace,
  lookupInvite,
} from "@/lib/workspace";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const ws = useWorkspaceOptional();

  const [invite, setInvite] = useState<InviteLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLookingUp(true);
      const result = await lookupInvite(code);
      if (cancelled) return;
      setInvite(result);
      setLookingUp(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const alreadyMember =
    !!ws?.workspace && !!invite && ws.workspace.id === invite.id;
  const inOtherWorkspace =
    !!ws?.workspace && !!invite && ws.workspace.id !== invite.id;

  const handleSignIn = async () => {
    try {
      sessionStorage.setItem("plftc:postLogin", `/join/${code}`);
    } catch {}
    await signInWithGoogle();
  };

  const handleJoin = async () => {
    if (!user || !invite) return;
    setJoining(true);
    setError(null);
    const res = await joinWorkspaceByInvite(user.id, code);
    setJoining(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (ws) await ws.refresh();
    router.replace("/workspace");
  };

  const handleSwitch = async () => {
    if (!user || !ws?.workspace || !invite) return;
    setJoining(true);
    setError(null);
    await leaveWorkspace(user.id, ws.workspace.id);
    const res = await joinWorkspaceByInvite(user.id, code);
    setJoining(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await ws.refresh();
    router.replace("/workspace");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 max-w-md w-full shadow-xl">
        <div className="text-center mb-5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--foreground-dim)] mb-1">
            PickListFTC workspace
          </p>
          <p className="text-lg font-mono font-bold tracking-[0.4em] text-[var(--foreground)]">
            {code}
          </p>
        </div>

        {lookingUp ? (
          <p className="text-center text-sm text-[var(--foreground-muted)]">
            Looking up invite…
          </p>
        ) : !invite ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              Invalid invite link
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              Check with your team admin — this code may have expired or been
              regenerated.
            </p>
            <Link
              href="/"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Back to home
            </Link>
          </div>
        ) : invite.invite_disabled ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-[var(--foreground)] mb-1">
              Invites disabled
            </h1>
            <p className="text-sm text-[var(--foreground-muted)]">
              The admin of <strong>{invite.name}</strong> has disabled new
              invites.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
              {invite.name}
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mb-4">
              {invite.team_number ? `Team ${invite.team_number} · ` : ""}
              DECODE 2025-2026 · {invite.member_count} member
              {invite.member_count === 1 ? "" : "s"}
            </p>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            {authLoading ? (
              <p className="text-sm text-[var(--foreground-dim)]">Loading…</p>
            ) : !user ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--foreground-muted)]">
                  Sign in with Google to join this workspace.
                </p>
                <button
                  onClick={handleSignIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            ) : alreadyMember ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--foreground-muted)]">
                  You&apos;re already a member of this workspace.
                </p>
                <Link
                  href="/workspace"
                  className="block w-full text-center px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Open workspace
                </Link>
              </div>
            ) : inOtherWorkspace ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--foreground-muted)]">
                  You&apos;re currently in{" "}
                  <strong>{ws?.workspace?.name}</strong>. Leave it and join{" "}
                  <strong>{invite.name}</strong>?
                </p>
                <p className="text-xs text-[var(--foreground-dim)]">
                  Your personal notes and pick lists stay with you. Only the
                  shared workspace data is left behind.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/workspace"
                    className="flex-1 text-center px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleSwitch}
                    disabled={joining}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                  >
                    {joining ? "Switching…" : "Leave & join"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join workspace"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
