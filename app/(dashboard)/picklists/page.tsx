"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { supabase } from "@/lib/supabase";
import { EventLoader } from "@/components/EventLoader";

// ── Types ──

interface PickListEntry {
  teamNumber: number;
  teamName: string;
  opr: number;
  notes: string;
  picked: boolean;
}

interface StoredPickList {
  entries: PickListEntry[];
  myTeamNumber: number | null;
  updatedAt?: string;
}

interface PickListCard {
  eventCode: string;
  eventName: string;
  teamCount: number;
  lastEdited: string;
  status: "active" | "archived";
  source: "local" | "cloud" | "both";
}

// ── Helpers ──

function getEventStatus(code: string): "active" | "archived" {
  // Simple heuristic: we can't know end dates without loading the event,
  // so default to "active" and let comparison/usage be the guide
  return "active";
}

function getAllLocalPickLists(): PickListCard[] {
  if (typeof window === "undefined") return [];
  const lists: PickListCard[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("picklistftc_picklist_")) continue;

    const eventCode = key.replace("picklistftc_picklist_", "");
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stored: StoredPickList = JSON.parse(raw);
      if (!stored.entries || stored.entries.length === 0) continue;

      lists.push({
        eventCode,
        eventName: eventCode, // Will be enriched if possible
        teamCount: stored.entries.length,
        lastEdited: stored.updatedAt ?? new Date().toISOString(),
        status: getEventStatus(eventCode),
        source: "local",
      });
    } catch {
      continue;
    }
  }

  return lists;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// ── Compare view ──

function CompareView({
  listA,
  listB,
  onClose,
}: {
  listA: { eventCode: string; entries: PickListEntry[] };
  listB: { eventCode: string; entries: PickListEntry[] };
  onClose: () => void;
}) {
  const teamsA = new Set(listA.entries.map((e) => e.teamNumber));
  const teamsB = new Set(listB.entries.map((e) => e.teamNumber));
  const commonTeams = new Set(Array.from(teamsA).filter((t) => teamsB.has(t)));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200">
          Comparing Pick Lists
        </h3>
        <div className="flex items-center gap-3">
          {commonTeams.size > 0 && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {commonTeams.size} team{commonTeams.size !== 1 ? "s" : ""} in common
            </span>
          )}
          <button
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-zinc-800">
        {[listA, listB].map((list, colIdx) => {
          const otherTeams = colIdx === 0 ? teamsB : teamsA;
          return (
            <div key={list.eventCode}>
              <div className="px-4 py-2.5 bg-zinc-800/30 border-b border-zinc-800">
                <p className="text-xs font-mono text-[var(--accent)]">{list.eventCode}</p>
                <p className="text-[10px] text-zinc-500">{list.entries.length} teams</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {list.entries.filter((e) => !e.picked).map((entry, i) => {
                  const isCommon = otherTeams.has(entry.teamNumber);
                  return (
                    <div
                      key={entry.teamNumber}
                      className={`flex items-center gap-2 px-4 py-1.5 text-xs border-b border-zinc-800/30 ${
                        isCommon ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <span className="text-zinc-600 font-mono w-6 text-right">
                        {i + 1}
                      </span>
                      <span className="font-mono text-white w-12 font-medium">
                        {entry.teamNumber}
                      </span>
                      <span className="text-zinc-400 flex-1 truncate">
                        {entry.teamName}
                      </span>
                      {isCommon && (
                        <span className="text-emerald-400 text-[10px] font-medium shrink-0">
                          Common
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function PickListsPage() {
  const { loadEvent, setEventCode } = useEvent();
  const { user } = useAuth();
  const { favoriteEvents } = useFavorites();
  const router = useRouter();

  const [pickLists, setPickLists] = useState<PickListCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<{
    a: { eventCode: string; entries: PickListEntry[] };
    b: { eventCode: string; entries: PickListEntry[] };
  } | null>(null);
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Delete a pick list from localStorage and Supabase
  const handleDelete = useCallback(
    async (eventCode: string) => {
      // Remove from localStorage
      localStorage.removeItem(`picklistftc_picklist_${eventCode}`);

      // Remove from Supabase if logged in
      if (user) {
        try {
          await supabase
            .from("pick_lists")
            .delete()
            .eq("user_id", user.id)
            .eq("event_code", eventCode);
        } catch {
          // Ignore cloud errors
        }
      }

      // Update state
      setPickLists((prev) => prev.filter((pl) => pl.eventCode !== eventCode));
      setDeleteConfirm(null);
    },
    [user]
  );

  // Load pick lists from localStorage + Supabase
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Get local pick lists
      const local = getAllLocalPickLists();
      const localMap = new Map(local.map((l) => [l.eventCode, l]));

      // Get cloud pick lists if logged in
      if (user) {
        try {
          const { data, error } = await supabase
            .from("pick_lists")
            .select("event_code, list_data, updated_at")
            .eq("user_id", user.id);

          if (!error && data) {
            for (const row of data) {
              const stored = row.list_data as StoredPickList;
              if (!stored.entries || stored.entries.length === 0) continue;

              const existing = localMap.get(row.event_code);
              if (existing) {
                // Merge: use most recent
                const cloudTime = new Date(row.updated_at).getTime();
                const localTime = new Date(existing.lastEdited).getTime();
                existing.source = "both";
                if (cloudTime > localTime) {
                  existing.lastEdited = row.updated_at;
                  existing.teamCount = stored.entries.length;
                }
              } else {
                localMap.set(row.event_code, {
                  eventCode: row.event_code,
                  eventName: row.event_code,
                  teamCount: stored.entries.length,
                  lastEdited: row.updated_at,
                  status: "active",
                  source: "cloud",
                });
              }
            }
          }
        } catch {
          // Continue with local only
        }
      }

      // Enrich event names from favorited events
      const nameMap = new Map(
        favoriteEvents.map((e) => [e.event_code, e.event_name])
      );
      const lists = Array.from(localMap.values()).map((l) => ({
        ...l,
        eventName: nameMap.get(l.eventCode) ?? l.eventCode,
      }));

      // Sort by last edited (newest first)
      lists.sort(
        (a, b) =>
          new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime()
      );

      setPickLists(lists);
      setLoading(false);
    };

    load();
  }, [user, favoriteEvents]);

  const handleOpenPickList = useCallback(
    (eventCode: string) => {
      setEventCode(eventCode);
      loadEvent(eventCode);
      router.push("/picklist");
    },
    [loadEvent, setEventCode, router]
  );

  const handleToggleCompare = (eventCode: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(eventCode)) {
        return prev.filter((c) => c !== eventCode);
      }
      if (prev.length >= 2) {
        return [prev[1], eventCode];
      }
      return [...prev, eventCode];
    });
  };

  const handleStartCompare = () => {
    if (compareSelection.length !== 2) return;

    const getEntries = (code: string): PickListEntry[] => {
      try {
        const raw = localStorage.getItem(`picklistftc_picklist_${code}`);
        if (!raw) return [];
        const stored: StoredPickList = JSON.parse(raw);
        return stored.entries ?? [];
      } catch {
        return [];
      }
    };

    setCompareData({
      a: { eventCode: compareSelection[0], entries: getEntries(compareSelection[0]) },
      b: { eventCode: compareSelection[1], entries: getEntries(compareSelection[1]) },
    });
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Pick Lists</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {pickLists.length} pick list{pickLists.length !== 1 ? "s" : ""} across events
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pickLists.length >= 2 && (
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  setCompareSelection([]);
                  setCompareData(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  compareMode
                    ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                {compareMode ? "Cancel Compare" : "Compare Lists"}
              </button>
            )}
            <button
              onClick={() => setShowNewPicker(!showNewPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Pick List
            </button>
          </div>
        </div>

        {/* New pick list event search */}
        {showNewPicker && (
          <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-3">Search for an event to create a new pick list:</p>
            <EventLoader bare />
          </div>
        )}

        {/* Compare selection bar */}
        {compareMode && !compareData && (
          <div className="mb-4 bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Select 2 pick lists to compare.{" "}
              <span className="text-zinc-500">{compareSelection.length}/2 selected</span>
            </p>
            {compareSelection.length === 2 && (
              <button
                onClick={handleStartCompare}
                className="px-3 py-1 text-xs font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors"
              >
                Compare
              </button>
            )}
          </div>
        )}

        {/* Comparison view */}
        {compareData && (
          <div className="mb-6">
            <CompareView
              listA={compareData.a}
              listB={compareData.b}
              onClose={() => {
                setCompareData(null);
                setCompareSelection([]);
              }}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <div className="skeleton h-4 w-32 mb-3" />
                <div className="skeleton h-3 w-20 mb-2" />
                <div className="skeleton h-3 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && pickLists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">No pick lists yet</h2>
            <p className="text-sm text-zinc-500 max-w-sm">
              Load an event and build a pick list from the Pick List page. Your lists will appear here.
            </p>
          </div>
        )}

        {/* Pick list cards */}
        {!loading && pickLists.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pickLists.map((pl) => {
              const isSelected = compareSelection.includes(pl.eventCode);
              return (
                <div
                  key={pl.eventCode}
                  onClick={() => {
                    if (compareMode) {
                      handleToggleCompare(pl.eventCode);
                    } else {
                      handleOpenPickList(pl.eventCode);
                    }
                  }}
                  className={`group relative bg-zinc-900 border rounded-xl p-5 cursor-pointer transition-all hover:bg-zinc-800/50 ${
                    isSelected
                      ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Compare checkbox */}
                  {compareMode && (
                    <div className="absolute top-3 right-3">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-[var(--accent)] border-[var(--accent)]"
                            : "border-zinc-700"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">
                        {pl.eventName}
                      </p>
                      <p className="text-xs text-[var(--accent)] font-mono mt-0.5">
                        {pl.eventCode}
                      </p>
                    </div>
                    {!compareMode && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            pl.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          {pl.status === "active" ? "Active" : "Archived"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(pl.eventCode);
                          }}
                          className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete pick list"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      {pl.teamCount} teams
                    </span>
                    <span>&middot;</span>
                    <span>{formatRelativeDate(pl.lastEdited)}</span>
                    {pl.source === "cloud" && (
                      <>
                        <span>&middot;</span>
                        <span className="text-[var(--accent)]" title="Synced from cloud">
                          <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                          </svg>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white mb-2">Delete pick list?</h3>
            <p className="text-sm text-zinc-400 mb-1">
              This will permanently delete the pick list for{" "}
              <span className="font-mono text-[var(--accent)]">{deleteConfirm}</span>.
            </p>
            <p className="text-xs text-zinc-600 mb-5">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
