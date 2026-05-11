import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkspaceRole = "admin" | "editor" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  team_number: number | null;
  invite_code: string;
  invite_disabled: boolean;
  owner_id: string;
  season: number;
  paid: boolean;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  display_name?: string | null;
}

export interface WorkspaceNote {
  id: string;
  workspace_id: string;
  author_id: string;
  event_code: string;
  team_number: number;
  text: string;
  tags: string[];
  created_at: string;
  authorName?: string | null;
}

export interface WorkspacePickListEntry {
  teamNumber: number;
  teamName: string;
  opr: number;
  notes: string;
  picked: boolean;
}

export interface WorkspacePickListData {
  entries: WorkspacePickListEntry[];
}

export interface WorkspacePickList {
  id: string;
  workspace_id: string;
  event_code: string;
  list_data: WorkspacePickListData;
  last_edited_by: string | null;
  updated_at: string;
  lastEditorName?: string | null;
}

export type SuggestionType = "add" | "remove" | "move";
export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface WorkspaceSuggestion {
  id: string;
  workspace_id: string;
  pick_list_id: string;
  author_id: string;
  suggestion_type: SuggestionType;
  team_number: number;
  target_position: number | null;
  reason: string | null;
  status: SuggestionStatus;
  created_at: string;
  authorName?: string | null;
}

export interface WorkspacePersonalRanking {
  id: string;
  workspace_id: string;
  pick_list_id: string;
  user_id: string;
  ranked_teams: number[];
  updated_at: string;
  memberName?: string | null;
}

export interface WorkspaceActivity {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  actorName?: string | null;
}

// ── Invite codes ───────────────────────────────────────────────────────────

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

// ── Membership ─────────────────────────────────────────────────────────────

export async function getMyWorkspace(userId: string): Promise<{
  workspace: Workspace;
  role: WorkspaceRole;
} | null> {
  const { data: membership, error: memErr } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (memErr || !membership) return null;

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", membership.workspace_id)
    .maybeSingle();
  if (wsErr || !ws) return null;

  return { workspace: ws as Workspace, role: membership.role as WorkspaceRole };
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, workspace_id, user_id, role, joined_at")
    .eq("workspace_id", workspaceId);
  if (error || !data) return [];

  const userIds = data.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameMap = new Map<string, string | null>(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p as { display_name: string | null }).display_name,
    ])
  );

  return data.map((row) => ({
    ...(row as Omit<WorkspaceMember, "display_name">),
    display_name: nameMap.get(row.user_id) ?? null,
  }));
}

export async function leaveWorkspace(userId: string, workspaceId: string): Promise<void> {
  await supabase
    .from("workspace_members")
    .delete()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): Promise<void> {
  await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
}

// ── Invite lookup ──────────────────────────────────────────────────────────

export interface InviteLookup {
  id: string;
  name: string;
  team_number: number | null;
  season: number;
  invite_disabled: boolean;
  member_count: number;
}

export async function lookupInvite(code: string): Promise<InviteLookup | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return null;
  const { data, error } = await supabase.rpc("lookup_workspace_by_invite", {
    invite_code_input: cleaned,
  });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    team_number: row.team_number,
    season: row.season,
    invite_disabled: row.invite_disabled,
    member_count: Number(row.member_count ?? 0),
  };
}

export async function joinWorkspaceByInvite(
  userId: string,
  code: string
): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  const invite = await lookupInvite(code);
  if (!invite) return { ok: false, error: "Invalid invite code." };
  if (invite.invite_disabled)
    return { ok: false, error: "This invite link has been disabled." };

  const { error } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: invite.id, user_id: userId, role: "viewer" });

  if (error) return { ok: false, error: error.message };
  await logActivity(invite.id, userId, "member.joined", {});
  return { ok: true, workspaceId: invite.id };
}

// ── Workspace admin ────────────────────────────────────────────────────────

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace, "name" | "team_number" | "invite_code" | "invite_disabled">>
): Promise<void> {
  await supabase.from("workspaces").update(updates).eq("id", workspaceId);
}

export async function regenerateInviteCode(workspaceId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode();
    const { error } = await supabase
      .from("workspaces")
      .update({ invite_code: code })
      .eq("id", workspaceId);
    if (!error) return code;
  }
  throw new Error("Failed to generate unique invite code");
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await supabase.from("workspaces").delete().eq("id", workspaceId);
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function loadWorkspaceNotes(workspaceId: string): Promise<WorkspaceNote[]> {
  const { data, error } = await supabase
    .from("workspace_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const ids = Array.from(new Set(data.map((n) => n.author_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const nameMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p as { display_name: string | null }).display_name,
    ])
  );

  return data.map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    author_id: row.author_id,
    event_code: row.event_code,
    team_number: row.team_number,
    text: row.text,
    tags: row.tags ?? [],
    created_at: row.created_at,
    authorName: nameMap.get(row.author_id) ?? null,
  }));
}

export async function addWorkspaceNote(
  workspaceId: string,
  authorId: string,
  eventCode: string,
  teamNumber: number,
  text: string,
  tags: string[]
): Promise<WorkspaceNote | null> {
  const { data, error } = await supabase
    .from("workspace_notes")
    .insert({
      workspace_id: workspaceId,
      author_id: authorId,
      event_code: eventCode,
      team_number: teamNumber,
      text,
      tags,
    })
    .select()
    .single();
  if (error || !data) return null;
  await logActivity(workspaceId, authorId, "note.added", { teamNumber, eventCode });
  return {
    id: data.id,
    workspace_id: data.workspace_id,
    author_id: data.author_id,
    event_code: data.event_code,
    team_number: data.team_number,
    text: data.text,
    tags: data.tags ?? [],
    created_at: data.created_at,
  };
}

export async function deleteWorkspaceNote(noteId: string): Promise<void> {
  await supabase.from("workspace_notes").delete().eq("id", noteId);
}

// ── Pick lists ─────────────────────────────────────────────────────────────

export async function loadWorkspacePickLists(workspaceId: string): Promise<WorkspacePickList[]> {
  const { data, error } = await supabase
    .from("workspace_pick_lists")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (error || !data) return [];

  const editorIds = Array.from(
    new Set(data.map((p) => p.last_edited_by).filter(Boolean) as string[])
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", editorIds.length ? editorIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p as { display_name: string | null }).display_name,
    ])
  );

  return data.map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    event_code: row.event_code,
    list_data: row.list_data as WorkspacePickListData,
    last_edited_by: row.last_edited_by,
    updated_at: row.updated_at,
    lastEditorName: row.last_edited_by ? nameMap.get(row.last_edited_by) ?? null : null,
  }));
}

export async function loadWorkspacePickList(
  workspaceId: string,
  eventCode: string
): Promise<WorkspacePickList | null> {
  const { data, error } = await supabase
    .from("workspace_pick_lists")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("event_code", eventCode)
    .maybeSingle();
  if (error || !data) return null;

  let editorName: string | null = null;
  if (data.last_edited_by) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", data.last_edited_by)
      .maybeSingle();
    editorName = (prof as { display_name?: string | null } | null)?.display_name ?? null;
  }

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    event_code: data.event_code,
    list_data: data.list_data as WorkspacePickListData,
    last_edited_by: data.last_edited_by,
    updated_at: data.updated_at,
    lastEditorName: editorName,
  };
}

export async function saveWorkspacePickList(
  workspaceId: string,
  eventCode: string,
  list: WorkspacePickListData,
  editorId: string
): Promise<WorkspacePickList | null> {
  const { data, error } = await supabase
    .from("workspace_pick_lists")
    .upsert(
      {
        workspace_id: workspaceId,
        event_code: eventCode,
        list_data: list,
        last_edited_by: editorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,event_code" }
    )
    .select()
    .single();
  if (error || !data) return null;
  await logActivity(workspaceId, editorId, "picklist.updated", { eventCode });
  return {
    id: data.id,
    workspace_id: data.workspace_id,
    event_code: data.event_code,
    list_data: data.list_data as WorkspacePickListData,
    last_edited_by: data.last_edited_by,
    updated_at: data.updated_at,
  };
}

// ── Suggestions ────────────────────────────────────────────────────────────

export async function loadSuggestions(
  workspaceId: string,
  pickListId?: string
): Promise<WorkspaceSuggestion[]> {
  let q = supabase
    .from("workspace_suggestions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (pickListId) q = q.eq("pick_list_id", pickListId);
  const { data, error } = await q;
  if (error || !data) return [];

  const ids = Array.from(new Set(data.map((s) => s.author_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nameMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p as { display_name: string | null }).display_name,
    ])
  );

  return data.map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    pick_list_id: row.pick_list_id,
    author_id: row.author_id,
    suggestion_type: row.suggestion_type as SuggestionType,
    team_number: row.team_number,
    target_position: row.target_position,
    reason: row.reason,
    status: row.status as SuggestionStatus,
    created_at: row.created_at,
    authorName: nameMap.get(row.author_id) ?? null,
  }));
}

export async function createSuggestion(args: {
  workspaceId: string;
  pickListId: string;
  authorId: string;
  suggestionType: SuggestionType;
  teamNumber: number;
  targetPosition?: number | null;
  reason?: string;
}): Promise<void> {
  await supabase.from("workspace_suggestions").insert({
    workspace_id: args.workspaceId,
    pick_list_id: args.pickListId,
    author_id: args.authorId,
    suggestion_type: args.suggestionType,
    team_number: args.teamNumber,
    target_position: args.targetPosition ?? null,
    reason: args.reason ?? null,
  });
  await logActivity(args.workspaceId, args.authorId, "suggestion.created", {
    teamNumber: args.teamNumber,
    suggestionType: args.suggestionType,
  });
}

export async function updateSuggestionStatus(
  suggestionId: string,
  status: SuggestionStatus
): Promise<void> {
  await supabase
    .from("workspace_suggestions")
    .update({ status })
    .eq("id", suggestionId);
}

// ── Personal rankings ─────────────────────────────────────────────────────

export async function loadPersonalRankings(
  pickListId: string
): Promise<WorkspacePersonalRanking[]> {
  const { data, error } = await supabase
    .from("workspace_personal_rankings")
    .select("*")
    .eq("pick_list_id", pickListId);
  if (error || !data) return [];

  const ids = Array.from(new Set(data.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nameMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p as { display_name: string | null }).display_name,
    ])
  );

  return data.map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    pick_list_id: row.pick_list_id,
    user_id: row.user_id,
    ranked_teams: row.ranked_teams as number[],
    updated_at: row.updated_at,
    memberName: nameMap.get(row.user_id) ?? null,
  }));
}

export async function savePersonalRanking(
  workspaceId: string,
  pickListId: string,
  userId: string,
  rankedTeams: number[]
): Promise<{ error: string | null }> {
  console.log("[CONSENSUS] savePersonalRanking:", { workspaceId, pickListId, userId, rankedTeams });
  const { data, error } = await supabase
    .from("workspace_personal_rankings")
    .upsert(
      {
        workspace_id: workspaceId,
        pick_list_id: pickListId,
        user_id: userId,
        ranked_teams: rankedTeams,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pick_list_id,user_id" }
    )
    .select();
  console.log("[CONSENSUS] upsert result:", { data, error });
  return { error: error?.message ?? null };
}

// ── Activity feed ──────────────────────────────────────────────────────────

export async function logActivity(
  workspaceId: string,
  actorId: string,
  kind: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabase
      .from("workspace_activity")
      .insert({ workspace_id: workspaceId, actor_id: actorId, kind, payload });
  } catch {
    // best-effort
  }
}

export async function loadActivity(
  workspaceId: string,
  limit = 20
): Promise<WorkspaceActivity[]> {
  const { data, error } = await supabase
    .from("workspace_activity")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const ids = Array.from(new Set(data.map((a) => a.actor_id).filter(Boolean) as string[]));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nameMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      (p as { display_name: string | null }).display_name,
    ])
  );

  return data.map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    actor_id: row.actor_id,
    kind: row.kind,
    payload: row.payload as Record<string, unknown> | null,
    created_at: row.created_at,
    actorName: row.actor_id ? nameMap.get(row.actor_id) ?? null : null,
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function describeActivity(a: WorkspaceActivity): string {
  const who = a.actorName ?? "Someone";
  const p = (a.payload ?? {}) as { teamNumber?: number; eventCode?: string; suggestionType?: string };
  switch (a.kind) {
    case "note.added":
      return `${who} added a note on Team ${p.teamNumber ?? "?"}`;
    case "picklist.updated":
      return `${who} updated the pick list${p.eventCode ? ` for ${p.eventCode}` : ""}`;
    case "suggestion.created":
      return `${who} suggested a ${p.suggestionType ?? "change"} for Team ${p.teamNumber ?? "?"}`;
    case "member.joined":
      return `${who} joined the workspace`;
    default:
      return `${who} ${a.kind.replace(/\./g, " ")}`;
  }
}

export function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
