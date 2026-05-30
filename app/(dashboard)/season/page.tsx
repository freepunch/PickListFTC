"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { EventsView } from "./_views/EventsView";
import { WatchedTeamsView } from "./_views/WatchedTeamsView";
import { PickListsView } from "./_views/PickListsView";

type Tab = "events" | "teams" | "picklists";

const TABS: { key: Tab; label: string }[] = [
  { key: "events", label: "Events" },
  { key: "teams", label: "Watched Teams" },
  { key: "picklists", label: "Pick Lists" },
];

function isValidTab(value: string | null): value is Tab {
  return value === "events" || value === "teams" || value === "picklists";
}

function SeasonPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { favoriteEvents, favoriteTeams } = useFavorites();

  const queryTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isValidTab(queryTab) ? queryTab : "events");

  // Keep tab state in sync with URL when it changes externally
  useEffect(() => {
    if (isValidTab(queryTab) && queryTab !== tab) setTab(queryTab);
  }, [queryTab, tab]);

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "events") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/season${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 pb-12 animate-page-fade-in">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">My Season</h1>
            {profile?.team_number && (
              <span className="text-sm font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-md">
                #{profile.team_number}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">2025-2026 DECODE Season</p>
        </div>

        {/* Tab bar — underline style */}
        <div className="mb-6 flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const count =
              t.key === "events" ? favoriteEvents.length :
              t.key === "teams" ? favoriteTeams.length :
              null;
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={`px-3 py-2.5 -mb-px text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  tab === t.key
                    ? "border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t.label}
                {count !== null && count > 0 && (
                  <span className={`ml-2 text-xs ${tab === t.key ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "events" && <EventsView />}
        {tab === "teams" && <WatchedTeamsView />}
        {tab === "picklists" && <PickListsView />}
      </div>
    </div>
  );
}

export default function SeasonPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">Loading…</div>}>
      <SeasonPageInner />
    </Suspense>
  );
}
