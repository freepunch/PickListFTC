"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspaceOptional } from "@/context/WorkspaceContext";

interface WorkspaceGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
}

export function WorkspaceGate({ feature, description, children }: WorkspaceGateProps) {
  const ctx = useWorkspaceOptional();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [renewing, setRenewing] = useState(false);
  const router = useRouter();

  // Still loading — show nothing to avoid a flash of the gate for workspace members
  if (!ctx || ctx.loading) return null;

  if (ctx.isInWorkspace && ctx.isExpired) {
    const isAdmin = ctx.role === "admin";
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

    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          Workspace Expired
        </h2>
        <p className="text-sm text-[var(--foreground-muted)] max-w-sm mb-2">
          Your workspace has expired. Renew to continue using {feature} and all
          workspace features.
        </p>
        <p className="text-xs text-[var(--foreground-dim)] mb-8">$20/season</p>

        {isAdmin ? (
          <button
            onClick={handleRenew}
            disabled={renewing}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {renewing ? "Redirecting…" : "Renew Workspace"}
          </button>
        ) : (
          <p className="text-sm text-[var(--foreground-dim)]">
            Ask your workspace admin to renew.
          </p>
        )}
      </div>
    );
  }

  if (ctx.isInWorkspace) return <>{children}</>;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length === 6) router.push(`/join/${code}`);
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-[var(--foreground-dim)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
        {feature} is a Workspace feature
      </h2>
      <p className="text-sm text-[var(--foreground-muted)] max-w-sm mb-2">
        {description ??
          `Create or join a workspace to unlock ${feature}, plus shared scouting, collaborative pick lists, and more.`}
      </p>
      <p className="text-xs text-[var(--foreground-dim)] mb-8">$20/season for your team</p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/workspace"
          className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
        >
          Create Workspace
        </Link>

        {!joinOpen ? (
          <button
            onClick={() => setJoinOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] text-sm font-medium transition-colors"
          >
            Join Workspace
          </button>
        ) : (
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="6-char code"
              maxLength={6}
              autoFocus
              className="w-32 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)] text-center uppercase tracking-widest"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] text-sm font-medium transition-colors"
            >
              Join
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
