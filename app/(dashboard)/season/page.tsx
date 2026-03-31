"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { EventLoader } from "@/components/EventLoader";
import { StatCard } from "@/components/StatCard";
import { findScopedKeys, picklistKey, notesKey } from "@/lib/storage";

// ── Types ──

interface PickListSummary {
  eventCode: string;
  teamCount: number;
  updatedAt: string;
}

interface NoteSummary {
  eventCode: string;
  noteCount: number;
}

// ── Helpers ──

function getEventStatus(start?: string | null): "live" | "upcoming" | "finished" {
  if (!start) return "upcoming";
  const startDate = new Date(start);
  const now = new Date();
  const endEstimate = new Date(startDate);
  endEstimate.setDate(endEstimate.getDate() + 2);
  if (now < startDate) return "upcoming";
  if (now > endEstimate) return "finished";
  return "live";
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  live:     { color: "text-green-400", bg: "bg-green-500/10", label: "Live", dot: "bg-green-400 animate-pulse" },
  upcoming: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Upcoming", dot: "bg-amber-400" },
  finished: { color: "text-zinc-500",  bg: "bg-zinc-800",     label: "Completed", dot: "bg-zinc-600" },
};

function getLocalPickLists(userId?: string | null): PickListSummary[] {
  if (typeof window === "undefined") return [];
  const lists: PickListSummary[] = [];
  for (const { key, eventCode } of findScopedKeys("picklist", userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stored = JSON.parse(raw);
      if (!stored.entries || stored.entries.length === 0) continue;
      lists.push({
        eventCode,
        teamCount: stored.entries.length,
        updatedAt: stored.updatedAt ?? new Date().toISOString(),
      });
    } catch { continue; }
  }
  return lists;
}

function getLocalNotes(userId?: string | null): NoteSummary[] {
  if (typeof window === "undefined") return [];
  const notes: NoteSummary[] = [];
  for (const { key, eventCode } of findScopedKeys("notes", userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) continue;
      notes.push({
        eventCode,
        noteCount: parsed.length,
      });
    } catch { continue; }
  }
  return notes;
}

function getTopTeams(userId?: string | null): { teamNumber: number; count: number }[] {
  if (typeof window === "undefined") return [];
  const teamCounts = new Map<number, number>();

  for (const { key } of findScopedKeys("picklist", userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed.entries) {
        for (const entry of parsed.entries) {
          if (entry.teamNumber) teamCounts.set(entry.teamNumber, (teamCounts.get(entry.teamNumber) ?? 0) + 1);
        }
      }
    } catch { continue; }
  }

  for (const { key } of findScopedKeys("notes", userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const note of parsed) {
          if (note.teamNumber) teamCounts.set(note.teamNumber, (teamCounts.get(note.teamNumber) ?? 0) + 1);
        }
      }
    } catch { continue; }
  }

  return Array.from(teamCounts.entries())
    .map(([teamNumber, count]) => ({ teamNumber, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Event detail drawer ──

function EventDrawer({
  event,
  pickList,
  noteCount,
  onClose,
  onLoad,
}: {
  event: { event_code: string; event_name: string | null; start?: string | null; season: number };
  pickList: PickListSummary | null;
  noteCount: number;
  onClose: () => void;
  onLoad: () => void;
}) {
  const { user: authUser } = useAuth();
  const drawerUserId = authUser?.id ?? null;
  const status = getEventStatus(event.start);
  const cfg = STATUS_CONFIG[status];

  // Read pick list preview (top 10)
  const [preview, setPreview] = useState<{ teamNumber: number; teamName: string; opr: number }[]>([]);
  useEffect(() => {
    if (!pickList) { setPreview([]); return; }
    try {
      const raw = localStorage.getItem(picklistKey(event.event_code, drawerUserId));
      if (!raw) return;
      const stored = JSON.parse(raw);
      setPreview(
        (stored.entries ?? [])
          .filter((e: { picked?: boolean }) => !e.picked)
          .slice(0, 10)
          .map((e: { teamNumber: number; teamName: string; opr: number }) => ({
            teamNumber: e.teamNumber,
            teamName: e.teamName,
            opr: e.opr,
          }))
      );
    } catch { setPreview([]); }
  }, [pickList, event.event_code, drawerUserId]);

  // Read recent notes
  const [recentNotes, setRecentNotes] = useState<{ teamNumber: number; text: string; tags: string[] }[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(notesKey(event.event_code, drawerUserId));
      if (!raw) return;
      const notes = JSON.parse(raw);
      if (!Array.isArray(notes)) return;
      setRecentNotes(
        notes
          .sort((a: { timestamp: string }, b: { timestamp: string }) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, 3)
          .map((n: { teamNumber: number; text: string; tags: string[] }) => ({
            teamNumber: n.teamNumber,
            text: n.text,
            tags: n.tags ?? [],
          }))
      );
    } catch { setRecentNotes([]); }
  }, [event.event_code]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl h-full overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-start justify-between z-10">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-lg font-semibold text-white truncate">
              {event.event_name ?? event.event_code}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-[var(--accent)] font-mono">{event.event_code}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            {event.start && (
              <p className="text-xs text-zinc-500 mt-1">
                {new Date(event.start).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded-md transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onLoad}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
            >
              Load Event
            </button>
            <Link
              href="/leaderboard"
              onClick={onLoad}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
            >
              Leaderboard
            </Link>
          </div>

          {/* Pick list preview */}
          <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-300">Pick List</h3>
              {pickList && (
                <span className="text-[10px] text-zinc-500">{pickList.teamCount} teams ranked</span>
              )}
            </div>
            {preview.length > 0 ? (
              <div className="divide-y divide-zinc-800/50">
                {preview.map((team, i) => (
                  <div key={team.teamNumber} className="flex items-center gap-2 px-4 py-1.5 text-xs">
                    <span className="text-zinc-600 font-mono w-5 text-right">#{i + 1}</span>
                    <span className="font-mono font-semibold text-white w-12">{team.teamNumber}</span>
                    <span className="text-zinc-400 flex-1 truncate">{team.teamName}</span>
                    <span className="font-mono text-zinc-600">{team.opr.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-zinc-600">No pick list yet for this event</p>
              </div>
            )}
            {pickList && (
              <div className="px-4 py-2 border-t border-zinc-800">
                <Link
                  href="/picklist"
                  onClick={onLoad}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Open Full List
                </Link>
              </div>
            )}
          </div>

          {/* Scout notes preview */}
          <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-300">Scout Notes</h3>
              {noteCount > 0 && (
                <span className="text-[10px] text-zinc-500">{noteCount} note{noteCount !== 1 ? "s" : ""}</span>
              )}
            </div>
            {recentNotes.length > 0 ? (
              <div className="divide-y divide-zinc-800/50">
                {recentNotes.map((note, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-mono text-xs font-semibold text-white">{note.teamNumber}</span>
                      {note.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {note.text && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{note.text}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-zinc-600">No scouting notes yet for this event</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Season Dashboard ──

export default function SeasonPage() {
  const { loadEvent, setEventCode } = useEvent();
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const { favoriteEvents } = useFavorites();
  const router = useRouter();

  const [pickLists, setPickLists] = useState<PickListSummary[]>([]);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [topTeams, setTopTeams] = useState<{ teamNumber: number; count: number }[]>([]);
  const [sortMode, setSortMode] = useState<"chronological" | "upcoming" | "recent">("upcoming");
  const [drawerEvent, setDrawerEvent] = useState<string | null>(null);

  useEffect(() => {
    const pl = getLocalPickLists(userId);
    setPickLists(pl);
    setNotes(getLocalNotes(userId));
    setTopTeams(getTopTeams(userId));
  }, [userId]);

  const pickListMap = useMemo(
    () => new Map(pickLists.map((p) => [p.eventCode, p])),
    [pickLists]
  );
  const noteMap = useMemo(
    () => new Map(notes.map((n) => [n.eventCode, n.noteCount])),
    [notes]
  );

  // Stats
  const totalNotes = notes.reduce((s, n) => s + n.noteCount, 0);
  const uniqueTeams = useMemo(() => {
    const set = new Set<number>();
    topTeams.forEach((t) => set.add(t.teamNumber));
    return set.size;
  }, [topTeams]);

  // Sorted events
  const sortedEvents = useMemo(() => {
    const evs = [...favoriteEvents];
    if (sortMode === "upcoming") {
      const order = { live: 0, upcoming: 1, finished: 2 };
      evs.sort((a, b) => {
        const sa = order[getEventStatus(a.start)];
        const sb = order[getEventStatus(b.start)];
        if (sa !== sb) return sa - sb;
        const da = a.start ? new Date(a.start).getTime() : 0;
        const db = b.start ? new Date(b.start).getTime() : 0;
        return da - db;
      });
    } else if (sortMode === "chronological") {
      evs.sort((a, b) => {
        const da = a.start ? new Date(a.start).getTime() : 0;
        const db = b.start ? new Date(b.start).getTime() : 0;
        return da - db;
      });
    } else {
      // recent = most recently edited pick list first
      evs.sort((a, b) => {
        const pa = pickListMap.get(a.event_code)?.updatedAt ?? "";
        const pb = pickListMap.get(b.event_code)?.updatedAt ?? "";
        return pb.localeCompare(pa);
      });
    }
    return evs;
  }, [favoriteEvents, sortMode, pickListMap]);

  // Next upcoming event
  const nextEvent = useMemo(
    () => favoriteEvents.find((e) => getEventStatus(e.start) === "upcoming"),
    [favoriteEvents]
  );

  const handleLoadEvent = useCallback(
    (code: string) => {
      setEventCode(code);
      loadEvent(code);
      router.push("/dashboard");
    },
    [loadEvent, setEventCode, router]
  );

  // Drawer data
  const drawerEventData = drawerEvent
    ? favoriteEvents.find((e) => e.event_code === drawerEvent)
    : null;

  // ── Onboarding empty state ──
  if (favoriteEvents.length === 0) {
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">My Season</h1>
            <p className="text-sm text-zinc-500 mt-1">2025-2026 DECODE Season</p>
          </div>

          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">
              Add events to start building your season dashboard
            </h2>
            <p className="text-sm text-zinc-500 max-w-sm mb-8">
              Search for events in your region, then star them to build your season at a glance.
            </p>
            <div className="w-full max-w-md">
              <EventLoader bare />
            </div>
            <p className="text-xs text-zinc-600 mt-4">
              After loading an event, click the star icon in the sidebar to watch it
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Full season dashboard ──
  return (
    <div className="min-h-screen p-4 sm:p-6 pb-12">
      <div className="max-w-6xl mx-auto space-y-0">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">My Season</h1>
            {profile?.team_number && (
              <span className="text-sm font-mono text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-md">
                #{profile.team_number}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-1">2025-2026 DECODE Season</p>
        </div>

        {/* Next event card */}
        {nextEvent && nextEvent.start && (
          <div className="mb-8 bg-gradient-to-r from-[var(--accent)]/5 to-transparent border border-[var(--accent)]/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-wider mb-1">Next Event</p>
              <h2 className="text-lg font-semibold text-white">
                {nextEvent.event_name ?? nextEvent.event_code}
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {new Date(nextEvent.start).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {(() => {
                const days = Math.ceil((new Date(nextEvent.start).getTime() - Date.now()) / 86400000);
                return (
                  <p className="text-sm text-zinc-500 mt-1">
                    <span className="text-xl font-bold text-[var(--accent)]">
                      {days > 0 ? days : 0}
                    </span>{" "}
                    day{days !== 1 ? "s" : ""} away
                  </p>
                );
              })()}
            </div>
            <button
              onClick={() => handleLoadEvent(nextEvent.event_code)}
              className="px-5 py-2.5 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shrink-0"
            >
              Start Prescouting
            </button>
          </div>
        )}

        {/* Season stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Events Watched" value={favoriteEvents.length} mono={false} />
          <StatCard label="Pick Lists" value={pickLists.length} mono={false} />
          <StatCard label="Teams Scouted" value={uniqueTeams} mono={false} />
          <StatCard label="Notes Written" value={totalNotes} mono={false} />
        </div>

        {/* Events board */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-200">Watched Events</h2>
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {[
                { key: "upcoming", label: "Upcoming First" },
                { key: "chronological", label: "Date" },
                { key: "recent", label: "Recent" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortMode(s.key as typeof sortMode)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    sortMode === s.key
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEvents.map((ev) => {
              const status = getEventStatus(ev.start);
              const cfg = STATUS_CONFIG[status];
              const pl = pickListMap.get(ev.event_code);
              const nc = noteMap.get(ev.event_code) ?? 0;

              return (
                <div
                  key={ev.event_code}
                  onClick={() => setDrawerEvent(ev.event_code)}
                  className="group bg-zinc-900 border border-zinc-800 rounded-xl p-5 cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate group-hover:text-white">
                        {ev.event_name ?? ev.event_code}
                      </p>
                      {ev.start && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {new Date(ev.start).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                    <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="text-[var(--accent)] font-mono">{ev.event_code}</span>
                    {pl && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        {pl.teamCount} ranked
                      </span>
                    )}
                    {nc > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2 5.5A2.5 2.5 0 014.5 3h15A2.5 2.5 0 0122 5.5v10A2.5 2.5 0 0119.5 18H13l-4 3v-3H4.5A2.5 2.5 0 012 15.5v-10z" />
                        </svg>
                        {nc} note{nc !== 1 ? "s" : ""}
                      </span>
                    )}
                    {!pl && nc === 0 && (
                      <span className="text-zinc-700">No scouting data</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most scouted teams */}
        {topTeams.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-200">Most Scouted Teams</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Teams that appear across the most events in your pick lists and notes</p>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {topTeams.map((t) => (
                <Link
                  key={t.teamNumber}
                  href={`/report/${t.teamNumber}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="font-mono text-sm font-semibold text-white">{t.teamNumber}</span>
                  <span className="text-xs text-zinc-500">
                    {t.count} event{t.count !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event detail drawer */}
      {drawerEventData && (
        <EventDrawer
          event={drawerEventData}
          pickList={pickListMap.get(drawerEventData.event_code) ?? null}
          noteCount={noteMap.get(drawerEventData.event_code) ?? 0}
          onClose={() => setDrawerEvent(null)}
          onLoad={() => {
            handleLoadEvent(drawerEventData.event_code);
            setDrawerEvent(null);
          }}
        />
      )}
    </div>
  );
}
