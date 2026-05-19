"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useEvent } from "@/context/EventContext";
import {
  WorkspaceEvent,
  EventPrepSummary,
  addWorkspaceEvent,
  removeWorkspaceEvent,
  loadEventPrepSummaries,
} from "@/lib/workspace";
import { EventPickerDialog } from "@/components/EventPickerDialog";

function getStatus(start: string | null): "live" | "upcoming" | "completed" {
  if (!start) return "upcoming";
  const now = new Date();
  const s = new Date(start);
  const e = new Date(start);
  e.setDate(e.getDate() + 1);
  e.setHours(23, 59, 59, 999);
  if (now < s) return "upcoming";
  if (now > e) return "completed";
  return "live";
}

function getCountdown(start: string | null): string {
  if (!start) return "";
  const diff = new Date(start).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 0) return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${Math.abs(days)} days ago`;
}

function formatEventDate(start: string | null): string {
  if (!start) return "Date TBD";
  return new Date(start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CheckRow({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-600"
        }`}
      >
        {done ? (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>
      <span className={`text-xs ${done ? "text-[var(--foreground-muted)]" : "text-zinc-600"}`}>
        {label}
      </span>
    </div>
  );
}

function EventMissionCard({
  ev,
  prep,
  canEdit,
  onRemove,
  onLoad,
  onPrescout,
}: {
  ev: WorkspaceEvent;
  prep: EventPrepSummary | undefined;
  canEdit: boolean;
  onRemove: () => void;
  onLoad: () => void;
  onPrescout: () => void;
}) {
  const status = getStatus(ev.event_start);
  const countdown = getCountdown(ev.event_start);

  const statusColor = {
    live: "bg-green-500/15 text-green-400 border-green-500/20",
    upcoming: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    completed: "bg-zinc-700/40 text-zinc-500 border-zinc-700/40",
  }[status];

  const cardBorder = {
    live: "border-green-500/20",
    upcoming: "border-[var(--border)]",
    completed: "border-[var(--border)] opacity-75",
  }[status];

  return (
    <div className={`bg-[var(--bg-card)] border rounded-xl p-5 ${cardBorder}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${statusColor}`}
            >
              {status}
            </span>
            {countdown && (
              <span className="text-[11px] text-[var(--foreground-dim)]">{countdown}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
            {ev.event_name ?? ev.event_code}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--foreground-dim)]">
            <span className="font-mono">{ev.event_code}</span>
            {ev.event_start && (
              <>
                <span className="text-zinc-700">·</span>
                <span>{formatEventDate(ev.event_start)}</span>
              </>
            )}
            {ev.event_location && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="truncate">{ev.event_location}</span>
              </>
            )}
          </div>
          {ev.notes && (
            <p className="mt-1.5 text-xs text-[var(--foreground-muted)] italic">
              &ldquo;{ev.notes}&rdquo;
            </p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={onRemove}
            className="shrink-0 p-1 text-zinc-600 hover:text-red-400 transition-colors"
            title="Remove event"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4 pl-0.5">
        <CheckRow
          done={prep?.pickListStarted ?? false}
          label={prep?.pickListStarted ? "Pick list started" : "No pick list yet"}
        />
        <CheckRow
          done={(prep?.assignmentCount ?? 0) > 0}
          label={
            (prep?.assignmentCount ?? 0) > 0
              ? `${prep!.assignmentCount} scouting assignments`
              : "No scouting assignments"
          }
        />
        <CheckRow
          done={(prep?.notesCount ?? 0) > 0}
          label={
            (prep?.notesCount ?? 0) > 0
              ? `${prep!.notesCount} shared note${prep!.notesCount !== 1 ? "s" : ""}`
              : "No shared notes"
          }
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onLoad}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
        >
          Load Event
        </button>
        <button
          onClick={onPrescout}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Prescout
        </button>
      </div>
    </div>
  );
}

export function SeasonPlanTab() {
  const { user } = useAuth();
  const { workspace, role, workspaceEvents, refreshWorkspaceEvents } = useWorkspace();
  const { loadEvent, setDataSource } = useEvent();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prepMap, setPrepMap] = useState<Map<string, EventPrepSummary>>(new Map());
  const [adding, setAdding] = useState(false);

  const canEdit = role === "admin" || role === "editor";
  const isAdmin = role === "admin";

  const loadPrep = useCallback(async () => {
    if (!workspace || workspaceEvents.length === 0) {
      setPrepMap(new Map());
      return;
    }
    const codes = workspaceEvents.map((e) => e.event_code);
    const map = await loadEventPrepSummaries(workspace.id, codes);
    setPrepMap(map);
  }, [workspace, workspaceEvents]);

  useEffect(() => {
    loadPrep();
  }, [loadPrep]);

  if (!workspace) return null;

  const handlePickEvent = async (result: {
    code: string;
    name: string;
    start: string;
    location?: { city?: string; state?: string };
  }) => {
    console.log("[WS EVENTS] Selected event:", result);
    if (!user) { console.warn("[WS EVENTS] No user — aborting"); return; }
    const already = workspaceEvents.some((e) => e.event_code === result.code);
    if (already) { console.log("[WS EVENTS] Already in list, skipping"); return; }
    setAdding(true);
    const loc = [result.location?.city, result.location?.state].filter(Boolean).join(", ");
    const { error } = await addWorkspaceEvent(workspace.id, user.id, {
      event_code: result.code,
      event_name: result.name,
      event_start: result.start,
      event_location: loc || null,
    });
    if (error) {
      console.error("[WS EVENTS] Save failed:", error);
      setAdding(false);
      return;
    }
    await refreshWorkspaceEvents();
    setAdding(false);
  };

  const handleRemove = async (ev: WorkspaceEvent) => {
    await removeWorkspaceEvent(ev.id);
    await refreshWorkspaceEvents();
  };

  const handleLoad = async (code: string) => {
    await loadEvent(code);
    router.push("/dashboard");
  };

  const handlePrescout = async (code: string) => {
    await loadEvent(code);
    setDataSource("season");
    router.push("/leaderboard");
  };

  const upcoming = workspaceEvents.filter((e) => {
    const s = getStatus(e.event_start);
    return s === "upcoming" || s === "live";
  });
  const completed = workspaceEvents.filter((e) => getStatus(e.event_start) === "completed");

  return (
    <div className="px-6 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Season Plan
          </h2>
          <p className="text-xs text-[var(--foreground-dim)] mt-0.5">
            {workspaceEvents.length === 0
              ? "No events added yet"
              : `${workspaceEvents.length} event${workspaceEvents.length !== 1 ? "s" : ""} · ${upcoming.length} upcoming`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setPickerOpen(true)}
            disabled={adding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            {adding ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            Add Event
          </button>
        )}
      </div>

      {workspaceEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--foreground-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--foreground-muted)] mb-1">
            No events on the calendar yet
          </p>
          <p className="text-xs text-[var(--foreground-dim)] max-w-xs">
            {canEdit
              ? "Add upcoming events to track your team's season and prep status."
              : "Ask an admin or editor to add events to the team calendar."}
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3 mb-6">
          {upcoming.map((ev) => (
            <EventMissionCard
              key={ev.id}
              ev={ev}
              prep={prepMap.get(ev.event_code)}
              canEdit={isAdmin}
              onRemove={() => handleRemove(ev)}
              onLoad={() => handleLoad(ev.event_code)}
              onPrescout={() => handlePrescout(ev.event_code)}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] mb-3">
            Completed
          </p>
          <div className="space-y-3">
            {completed.map((ev) => (
              <EventMissionCard
                key={ev.id}
                ev={ev}
                prep={prepMap.get(ev.event_code)}
                canEdit={isAdmin}
                onRemove={() => handleRemove(ev)}
                onLoad={() => handleLoad(ev.event_code)}
                onPrescout={() => handlePrescout(ev.event_code)}
              />
            ))}
          </div>
        </>
      )}

      {pickerOpen && (
        <EventPickerDialog
          onSelect={handlePickEvent}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
