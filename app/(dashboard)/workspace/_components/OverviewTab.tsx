"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useEvent } from "@/context/EventContext";
import {
  WorkspaceEvent,
  describeActivity,
  formatExpiry,
  formatRelative,
  loadActivity,
  loadWorkspacePickLists,
  loadMatchAssignments,
  addWorkspaceEvent,
  updateWorkspaceEventNotes,
  removeWorkspaceEvent,
  WorkspaceActivity,
  MatchAssignment,
} from "@/lib/workspace";
import { EventPickerDialog } from "@/components/EventPickerDialog";

export function OverviewTab() {
  const { user } = useAuth();
  const {
    workspace,
    members,
    notes,
    workspaceEvents,
    refreshWorkspaceEvents,
    role,
    isExpired,
    daysUntilExpiry,
  } = useWorkspace();
  const { event, loadEvent, setDataSource } = useEvent();
  const router = useRouter();
  const [activity, setActivity] = useState<WorkspaceActivity[]>([]);
  const [pickListEvents, setPickListEvents] = useState<number>(0);
  const [matchAssignments, setMatchAssignments] = useState<MatchAssignment[]>([]);
  const [copyToast, setCopyToast] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);

  const canEdit = role === "admin" || role === "editor";
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!workspace) return;
    loadActivity(workspace.id, 20).then(setActivity);
    loadWorkspacePickLists(workspace.id).then((lists) =>
      setPickListEvents(lists.length)
    );
  }, [workspace]);

  useEffect(() => {
    if (!workspace || !event) { setMatchAssignments([]); return; }
    loadMatchAssignments(workspace.id, event.code).then(setMatchAssignments);
  }, [workspace, event]);

  if (!workspace) return null;

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${workspace.invite_code}`
      : `/join/${workspace.invite_code}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="px-6 py-6 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Members" value={members.length} />
        <Stat label="Shared notes" value={notes.length} />
        <Stat label="Pick lists" value={pickListEvents} />
        <Stat
          label="Season"
          value={`${workspace.season}-${(workspace.season + 1).toString().slice(-2)}`}
        />
      </div>

      {workspace.expires_at && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
            Subscription
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">
            {isExpired
              ? "Expired"
              : `Active until ${formatExpiry(workspace.expires_at)}`}
          </p>
          {daysUntilExpiry !== null && !isExpired && daysUntilExpiry <= 30 && (
            <p
              className={`text-xs mt-0.5 ${
                daysUntilExpiry <= 7 ? "text-red-400" : "text-amber-400"
              }`}
            >
              {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""} remaining
            </p>
          )}
          {isExpired && (
            <p className="text-xs text-red-400 mt-0.5">
              Renew from the Members tab to restore full access.
            </p>
          )}
        </div>
      )}

      {event && matchAssignments.length > 0 && (() => {
        const total = matchAssignments.length;
        const reported = matchAssignments.filter((a) => a.status === "completed").length;
        const assigned = total - reported;
        const unassignedMatches = event.matches
          ? event.matches
              .filter((m) => !m.hasBeenPlayed)
              .filter((m) => !matchAssignments.some((a) => a.match_id === String(m.id)))
              .slice(0, 5)
          : [];
        return (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
              Match Coverage · <span className="font-mono text-[var(--foreground-dim)]">{event.code}</span>
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-xl font-bold font-mono text-[var(--foreground)]">{total}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">Assigned</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-mono text-emerald-400">{reported}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">Reported</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-mono text-[var(--foreground-muted)]">{assigned}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">Pending</p>
              </div>
            </div>
            {total > 0 && (
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.round((reported / total) * 100)}%` }}
                />
              </div>
            )}
            {unassignedMatches.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)] mb-1">
                  Upcoming without scout
                </p>
                <div className="flex flex-wrap gap-1">
                  {unassignedMatches.map((m) => (
                    <span
                      key={m.id}
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    >
                      {m.description ?? `#${m.matchNum}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <TeamEventsSection
        workspace={workspace}
        workspaceEvents={workspaceEvents}
        canEdit={canEdit}
        isAdmin={isAdmin}
        user={user}
        loadEvent={loadEvent}
        setDataSource={setDataSource}
        router={router}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        addingEvent={addingEvent}
        setAddingEvent={setAddingEvent}
        refreshWorkspaceEvents={refreshWorkspaceEvents}
      />

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Invite teammates
          </h3>
          {workspace.invite_disabled && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
              Disabled
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--foreground-dim)] mb-3">
          Share this link or the 6-character code. They&apos;ll join as a viewer
          and you can promote them later.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-mono text-[var(--foreground-muted)] truncate">
            {inviteUrl}
          </code>
          <button
            onClick={copyInvite}
            className="px-3 py-2 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
          >
            {copyToast ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
            Code
          </span>
          <span className="text-lg font-mono font-bold tracking-[0.3em] text-[var(--foreground)]">
            {workspace.invite_code}
          </span>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Recent activity
          </h3>
        </div>
        {activity.length === 0 ? (
          <div className="px-5 py-6 text-xs text-[var(--foreground-dim)] text-center">
            No activity yet — invite a teammate or add a shared note.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {activity.map((a) => (
              <li
                key={a.id}
                className="px-5 py-2.5 flex items-center justify-between gap-3"
              >
                <span className="text-sm text-[var(--foreground-muted)] truncate">
                  {describeActivity(a)}
                </span>
                <span className="text-[11px] text-[var(--foreground-dim)] shrink-0">
                  {formatRelative(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function getEventStatus(start: string | null): "live" | "upcoming" | "completed" {
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

interface TeamEventsSectionProps {
  workspace: { id: string } | null;
  workspaceEvents: WorkspaceEvent[];
  canEdit: boolean;
  isAdmin: boolean;
  user: { id: string } | null;
  loadEvent: (code: string) => Promise<void>;
  setDataSource: (s: "season" | "event") => void;
  router: ReturnType<typeof useRouter>;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  addingEvent: boolean;
  setAddingEvent: (v: boolean) => void;
  refreshWorkspaceEvents: () => Promise<void>;
}

function EventNoteField({
  event,
  canEdit,
}: {
  event: WorkspaceEvent;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState(event.notes ?? "");
  const [saving, setSaving] = useState(false);
  const prevRef = useRef(event.notes ?? "");

  const handleBlur = async () => {
    if (draft === prevRef.current) return;
    setSaving(true);
    await updateWorkspaceEventNotes(event.id, draft);
    prevRef.current = draft;
    setSaving(false);
  };

  if (!canEdit) {
    return event.notes ? (
      <p className="text-xs text-[var(--foreground-muted)] italic mt-1">&ldquo;{event.notes}&rdquo;</p>
    ) : null;
  }

  return (
    <div className="mt-1.5 relative">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        rows={1}
        placeholder="Add a team note… (e.g. 'Our qualifier' or 'Prescout priority')"
        className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--foreground-muted)] placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)] resize-none"
      />
      {saving && (
        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-600">saving…</span>
      )}
    </div>
  );
}

function TeamEventsSection({
  workspace,
  workspaceEvents,
  canEdit,
  isAdmin,
  user,
  loadEvent,
  setDataSource,
  router,
  pickerOpen,
  setPickerOpen,
  addingEvent,
  setAddingEvent,
  refreshWorkspaceEvents,
}: TeamEventsSectionProps) {
  if (!workspace) return null;

  const handleAdd = async (result: {
    code: string;
    name: string;
    start: string;
    location?: { city?: string; state?: string };
  }) => {
    console.log("[WS EVENTS] Selected event:", result);
    if (!user) { console.warn("[WS EVENTS] No user — aborting"); return; }
    if (!workspace) { console.warn("[WS EVENTS] No workspace — aborting"); return; }
    const already = workspaceEvents.some((e) => e.event_code === result.code);
    if (already) { console.log("[WS EVENTS] Already in list, skipping"); return; }
    setAddingEvent(true);
    const loc = [result.location?.city, result.location?.state].filter(Boolean).join(", ");
    const { error } = await addWorkspaceEvent(workspace.id, user.id, {
      event_code: result.code,
      event_name: result.name,
      event_start: result.start,
      event_location: loc || null,
    });
    if (error) {
      console.error("[WS EVENTS] Save failed:", error);
      setAddingEvent(false);
      return;
    }
    await refreshWorkspaceEvents();
    setAddingEvent(false);
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

  const STATUS_DOT: Record<string, string> = {
    live: "bg-green-500",
    upcoming: "bg-yellow-400",
    completed: "bg-zinc-600",
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Team Events</h3>
        {canEdit && (
          <button
            onClick={() => setPickerOpen(true)}
            disabled={addingEvent}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
          >
            {addingEvent ? (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            Add Event
          </button>
        )}
      </div>

      {workspaceEvents.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-5 py-6 text-xs text-[var(--foreground-dim)] text-center">
          {canEdit
            ? "No team events yet — add your first upcoming competition."
            : "No team events added yet."}
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
          {workspaceEvents.map((ev) => {
            const status = getEventStatus(ev.event_start);
            return (
              <div key={ev.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)] truncate">
                        {ev.event_name ?? ev.event_code}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--foreground-dim)] shrink-0">
                        {ev.event_code}
                      </span>
                    </div>
                    {(ev.event_start || ev.event_location) && (
                      <p className="text-xs text-[var(--foreground-dim)] mt-0.5">
                        {ev.event_start &&
                          new Date(ev.event_start).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        {ev.event_start && ev.event_location && " · "}
                        {ev.event_location}
                      </p>
                    )}
                    <EventNoteField event={ev} canEdit={canEdit} />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleLoad(ev.event_code)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
                      >
                        Load Event
                      </button>
                      <button
                        onClick={() => handlePrescout(ev.event_code)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        Prescout
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemove(ev)}
                          className="ml-auto p-1 text-zinc-600 hover:text-red-400 transition-colors"
                          title="Remove event"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pickerOpen && (
        <EventPickerDialog
          onSelect={handleAdd}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-dim)]">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">
        {value}
      </p>
    </div>
  );
}
