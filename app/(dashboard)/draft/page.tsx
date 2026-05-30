"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/context/EventContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { supabase } from "@/lib/supabase";
import { WorkspaceDraft, loadDraft } from "@/lib/workspace";
import { DraftSetup } from "./_components/DraftSetup";
import { DraftActive } from "./_components/DraftActive";
import { DraftSummary } from "./_components/DraftSummary";

export default function DraftPage() {
  const { user, loading: authLoading } = useAuth();
  const { event, teams } = useEvent();
  const { workspace, role, loading: wsLoading } = useWorkspace();

  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspace || !event) {
      setLoading(false);
      return;
    }
    const d = await loadDraft(workspace.id, event.code);
    setDraft(d);
    setLoading(false);
  }, [workspace, event]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime: any change to drafts table for this workspace
  useEffect(() => {
    if (!workspace || !event) return;
    const ch = supabase
      .channel(`ws-draft:${workspace.id}:${event.code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_drafts",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { event_code?: string } | undefined;
          if (row?.event_code && row.event_code !== event.code) return;
          refresh();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspace, event, refresh]);

  if (authLoading || wsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[var(--foreground-dim)]">Loading draft board…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-6 py-12 max-w-md mx-auto text-center">
        <p className="text-sm text-[var(--foreground-dim)]">Sign in to use the draft board.</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <WorkspaceGate feature="Draft Board">
        <></>
      </WorkspaceGate>
    );
  }

  if (!event) {
    return (
      <div className="px-6 py-12 max-w-md mx-auto text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)] mb-1">Draft Board</h1>
        <p className="text-sm text-[var(--foreground-dim)]">
          Load an event from the sidebar to start a draft.
        </p>
      </div>
    );
  }

  const canEdit = role === "admin" || role === "editor";
  const status = draft?.status ?? "setup";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Draft Board</h1>
          <p className="text-xs text-[var(--foreground-dim)] mt-0.5">
            {workspace.name} · <span className="font-mono">{event.code}</span> ·{" "}
            <span className={
              status === "active"
                ? "text-blue-400"
                : status === "complete"
                ? "text-emerald-400"
                : "text-[var(--foreground-muted)]"
            }>
              {status === "setup" ? "Setup" : status === "active" ? "Live draft" : "Complete"}
            </span>
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {status === "setup" && (
          <DraftSetup
            workspaceId={workspace.id}
            eventCode={event.code}
            teams={teams}
            existing={draft}
            canEdit={canEdit}
          />
        )}
        {status === "active" && draft && (
          <DraftActive
            draft={draft}
            workspaceId={workspace.id}
            workspaceTeamNumber={workspace.team_number ?? null}
            eventCode={event.code}
            teams={teams}
            eventTeams={event.teams.map((tep) => ({ teamNumber: tep.teamNumber, teamName: tep.team.name }))}
            canEdit={canEdit}
          />
        )}
        {status === "complete" && draft && (
          <DraftSummary
            draft={draft}
            workspaceTeamNumber={workspace.team_number ?? null}
            teams={teams}
            eventTeams={event.teams.map((tep) => ({ teamNumber: tep.teamNumber, teamName: tep.team.name }))}
            canEdit={canEdit}
            workspaceId={workspace.id}
            eventCode={event.code}
          />
        )}
      </div>
    </div>
  );
}
