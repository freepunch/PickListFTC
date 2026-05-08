"use client";

import { useState } from "react";

export function CreateWorkspaceCard() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Workspace name is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/workspace-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceName: name.trim(),
          teamNumber: team.trim() ? parseInt(team.trim(), 10) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">Create a Workspace</h3>
          <p className="text-xs text-[var(--foreground-dim)]">$20 for the DECODE 2025-2026 season</p>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] mb-1">
            Workspace name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="e.g. First Try Scouting"
            className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] mb-1">
            Team number <span className="text-[var(--foreground-dim)] normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="21364"
            className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm text-[var(--foreground)] font-mono placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <button
        onClick={handleCreate}
        disabled={loading || !name.trim()}
        className="mt-auto px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Redirecting to checkout…" : "Create & Pay"}
      </button>
      <p className="text-[10px] text-[var(--foreground-dim)] mt-2 text-center">
        Secure payment via Stripe. You&apos;ll be the workspace admin.
      </p>
    </div>
  );
}

export function JoinWorkspaceCard({
  code,
  setCode,
  error,
  onSubmit,
}: {
  code: string;
  setCode: (v: string) => void;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">Join a Workspace</h3>
          <p className="text-xs text-[var(--foreground-dim)]">Enter the 6-character code from your admin</p>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] mb-1">
          Invite code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder="FTR24X"
          className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-base font-mono tracking-[0.3em] text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <button
        onClick={onSubmit}
        disabled={code.length < 6}
        className="mt-auto px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
      </button>
      <p className="text-[10px] text-[var(--foreground-dim)] mt-2 text-center">
        Or open the invite link directly to skip this step.
      </p>
    </div>
  );
}
