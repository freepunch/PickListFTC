"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Workspace,
  WorkspaceEvent,
  WorkspaceMember,
  WorkspaceNote,
  WorkspaceRole,
  WorkspaceSuggestion,
  getMyWorkspace,
  listMembers,
  loadWorkspaceNotes,
  loadSuggestions,
  loadWorkspaceEvents,
} from "@/lib/workspace";

interface WorkspaceContextValue {
  loading: boolean;
  isInWorkspace: boolean;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  workspace: Workspace | null;
  role: WorkspaceRole | null;
  members: WorkspaceMember[];
  notes: WorkspaceNote[];
  workspaceEvents: WorkspaceEvent[];
  pendingSuggestions: WorkspaceSuggestion[];
  refresh: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshWorkspaceEvents: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<WorkspaceSuggestion[]>([]);
  const [workspaceEvents, setWorkspaceEvents] = useState<WorkspaceEvent[]>([]);
  const subscribedWorkspaceRef = useRef<string | null>(null);

  const userId = user?.id ?? null;

  const refreshMembers = useCallback(async () => {
    if (!workspace) return;
    setMembers(await listMembers(workspace.id));
  }, [workspace]);

  const refreshNotes = useCallback(async () => {
    if (!workspace) return;
    setNotes(await loadWorkspaceNotes(workspace.id));
  }, [workspace]);

  const refreshSuggestions = useCallback(async () => {
    if (!workspace) return;
    const s = await loadSuggestions(workspace.id);
    setPendingSuggestions(s.filter((x) => x.status === "pending"));
  }, [workspace]);

  const refreshWorkspaceEvents = useCallback(async () => {
    if (!workspace) return;
    setWorkspaceEvents(await loadWorkspaceEvents(workspace.id));
  }, [workspace]);

  const isExpired = useMemo(() => {
    if (!workspace?.expires_at) return false;
    return new Date(workspace.expires_at).getTime() < Date.now();
  }, [workspace]);

  const daysUntilExpiry = useMemo(() => {
    if (!workspace?.expires_at) return null;
    const ms = new Date(workspace.expires_at).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }, [workspace]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setWorkspace(null);
      setRole(null);
      setMembers([]);
      setNotes([]);
      setWorkspaceEvents([]);
      setPendingSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getMyWorkspace(userId);
    if (!result) {
      setWorkspace(null);
      setRole(null);
      setMembers([]);
      setNotes([]);
      setWorkspaceEvents([]);
      setPendingSuggestions([]);
      setLoading(false);
      return;
    }
    setWorkspace(result.workspace);
    setRole(result.role);
    const [m, n, sugg, evts] = await Promise.all([
      listMembers(result.workspace.id),
      loadWorkspaceNotes(result.workspace.id),
      loadSuggestions(result.workspace.id),
      loadWorkspaceEvents(result.workspace.id),
    ]);
    setMembers(m);
    setNotes(n);
    setWorkspaceEvents(evts);
    setPendingSuggestions(sugg.filter((x) => x.status === "pending"));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, userId, refresh]);

  useEffect(() => {
    if (!workspace) {
      subscribedWorkspaceRef.current = null;
      return;
    }
    if (subscribedWorkspaceRef.current === workspace.id) return;
    subscribedWorkspaceRef.current = workspace.id;

    const channel = supabase
      .channel(`workspace:${workspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_notes",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          refreshNotes();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_suggestions",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          refreshSuggestions();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          refreshMembers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_events",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          refreshWorkspaceEvents();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspaces",
          filter: `id=eq.${workspace.id}`,
        },
        async () => {
          if (!userId) return;
          const result = await getMyWorkspace(userId);
          if (result) {
            setWorkspace(result.workspace);
            setRole(result.role);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      subscribedWorkspaceRef.current = null;
    };
  }, [workspace, userId, refreshNotes, refreshSuggestions, refreshMembers]);

  return (
    <WorkspaceContext.Provider
      value={{
        loading,
        isInWorkspace: !!workspace,
        isExpired,
        daysUntilExpiry,
        workspace,
        role,
        members,
        notes,
        workspaceEvents,
        pendingSuggestions,
        refresh,
        refreshNotes,
        refreshSuggestions,
        refreshMembers,
        refreshWorkspaceEvents,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}
