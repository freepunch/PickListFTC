"use client";

import { useEffect, useMemo, useState } from "react";
import { ProcessedTeam } from "@/lib/types";
import { WorkspaceDraft, upsertDraft } from "@/lib/workspace";

interface Props {
  workspaceId: string;
  eventCode: string;
  teams: ProcessedTeam[];
  existing: WorkspaceDraft | null;
  canEdit: boolean;
}

const ALLIANCE_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export function DraftSetup({ workspaceId, eventCode, teams, existing, canEdit }: Props) {
  const [numAlliances, setNumAlliances] = useState(existing?.num_alliances ?? 4);
  const [order, setOrder] = useState<number[]>(existing?.ranking_order ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rankedFromEvent = useMemo(
    () => [...teams].sort((a, b) => a.stats.rank - b.stats.rank).map((t) => t.teamNumber),
    [teams]
  );

  const teamLookup = useMemo(() => new Map(teams.map((t) => [t.teamNumber, t])), [teams]);

  // Default the seed order to the leaderboard rankings the first time we land here
  useEffect(() => {
    if (!order.length && rankedFromEvent.length) {
      setOrder(rankedFromEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedFromEvent]);

  const prefillFromLeaderboard = () => setOrder(rankedFromEvent);

  const swap = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const captains = order.slice(0, numAlliances);
  const remaining = order.slice(numAlliances);

  const handleStart = async () => {
    if (!canEdit) return;
    if (order.length < numAlliances + numAlliances * 2) {
      setError(
        `Need at least ${numAlliances + numAlliances * 2} teams in the seed order to run a ${numAlliances}-alliance draft.`
      );
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await upsertDraft({
      workspaceId,
      eventCode,
      num_alliances: numAlliances,
      ranking_order: order,
      picks: [],
      status: "active",
    });
    setSaving(false);
    if (error) setError(error);
  };

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
      {!canEdit && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          You&apos;re viewing the setup. Only the admin can start the draft.
        </div>
      )}

      {/* Step 1: number of alliances */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">
          1 — Number of alliances
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ALLIANCE_OPTIONS.map((n) => (
            <button
              key={n}
              disabled={!canEdit}
              onClick={() => setNumAlliances(n)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                numAlliances === n
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40"
                  : "bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] border-[var(--border)] hover:text-[var(--foreground)]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--foreground-dim)] mt-1.5">
          Each alliance has a captain plus 2 picks ({numAlliances * 3} teams selected,{" "}
          {numAlliances * 2} picks recorded).
        </p>
      </section>

      {/* Step 2: ranking order */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            2 — Seed order
          </h2>
          {canEdit && (
            <button
              onClick={prefillFromLeaderboard}
              className="text-[11px] px-2 py-1 rounded text-[var(--foreground-muted)] hover:text-[var(--foreground)] border border-[var(--border)] bg-[var(--bg-card-hover)] transition-colors"
            >
              Reset from rankings
            </button>
          )}
        </div>

        {/* Captains */}
        <p className="text-[11px] text-[var(--foreground-dim)] mb-1.5">
          Captains (top {numAlliances} seeds)
        </p>
        <ul className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)] overflow-hidden">
          {captains.length === 0 && (
            <li className="px-3 py-4 text-center text-xs text-[var(--foreground-dim)]">
              Load an event with rankings to populate seeds.
            </li>
          )}
          {captains.map((tn, i) => {
            const t = teamLookup.get(tn);
            return (
              <li
                key={tn}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-card-hover)]/60"
              >
                <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold w-12 shrink-0">
                  #{i + 1}
                </span>
                <span className="font-mono text-sm font-semibold text-[var(--foreground)] w-14 shrink-0">
                  {tn}
                </span>
                <span className="text-xs text-[var(--foreground-muted)] flex-1 truncate">
                  {t?.teamName ?? "—"}
                </span>
                {t && (
                  <span className="font-mono text-[11px] text-[var(--foreground-dim)] tabular-nums shrink-0">
                    {t.stats.opr.totalPointsNp.toFixed(1)}
                  </span>
                )}
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <SeedArrow
                      disabled={i === 0}
                      direction="up"
                      onClick={() => swap(i, i - 1)}
                    />
                    <SeedArrow
                      disabled={i === order.length - 1}
                      direction="down"
                      onClick={() => swap(i, i + 1)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Pool preview */}
        {remaining.length > 0 && (
          <details className="mt-3 group">
            <summary className="text-[11px] text-[var(--foreground-dim)] cursor-pointer hover:text-[var(--foreground-muted)] flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">›</span>
              Picking pool · {remaining.length} teams
            </summary>
            <ul className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]/50 overflow-hidden max-h-72 overflow-y-auto">
              {remaining.map((tn, i) => {
                const t = teamLookup.get(tn);
                return (
                  <li key={tn} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[10px] text-[var(--foreground-dim)] font-mono w-12 shrink-0 tabular-nums">
                      #{numAlliances + i + 1}
                    </span>
                    <span className="font-mono text-xs font-semibold text-[var(--foreground)] w-14 shrink-0">
                      {tn}
                    </span>
                    <span className="text-[11px] text-[var(--foreground-muted)] flex-1 truncate">
                      {t?.teamName ?? "—"}
                    </span>
                    {t && (
                      <span className="font-mono text-[10px] text-[var(--foreground-dim)] tabular-nums shrink-0">
                        {t.stats.opr.totalPointsNp.toFixed(1)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>

      {/* Step 3: start */}
      <section className="border-t border-[var(--border)] pt-4">
        {error && (
          <p className="text-xs text-red-400 mb-2">{error}</p>
        )}
        {canEdit ? (
          <button
            onClick={handleStart}
            disabled={saving || order.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Starting…" : "Start draft"}
          </button>
        ) : (
          <p className="text-xs text-[var(--foreground-dim)]">
            Waiting for an admin to start the draft.
          </p>
        )}
      </section>
    </div>
  );
}

function SeedArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: "up" | "down";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={direction === "up" ? "Move up" : "Move down"}
      className="p-1 rounded text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {direction === "up" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        )}
      </svg>
    </button>
  );
}
