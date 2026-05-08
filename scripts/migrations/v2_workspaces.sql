-- V2: Paid collaborative workspaces.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team_number INT,
  invite_code TEXT UNIQUE NOT NULL,
  invite_disabled BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  season INT NOT NULL DEFAULT 2025,
  stripe_session_id TEXT,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'admin', 'editor', 'viewer'
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  team_number INT NOT NULL,
  text TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_pick_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  list_data JSONB NOT NULL,
  last_edited_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, event_code)
);

CREATE TABLE IF NOT EXISTS workspace_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  pick_list_id UUID REFERENCES workspace_pick_lists(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'add', 'remove', 'move'
  team_number INT NOT NULL,
  target_position INT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_notes_ws_event_idx
  ON workspace_notes (workspace_id, event_code);
CREATE INDEX IF NOT EXISTS workspace_pick_lists_ws_idx
  ON workspace_pick_lists (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_suggestions_ws_status_idx
  ON workspace_suggestions (workspace_id, status);
CREATE INDEX IF NOT EXISTS workspace_activity_ws_created_idx
  ON workspace_activity (workspace_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read workspace" ON workspaces;
CREATE POLICY "Members read workspace" ON workspaces FOR SELECT
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin manages workspace" ON workspaces;
CREATE POLICY "Admin manages workspace" ON workspaces FOR ALL
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members read members" ON workspace_members;
CREATE POLICY "Members read members" ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin manages members" ON workspace_members;
CREATE POLICY "Admin manages members" ON workspace_members FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Members leave" ON workspace_members;
CREATE POLICY "Members leave" ON workspace_members FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members read notes" ON workspace_notes;
CREATE POLICY "Members read notes" ON workspace_notes FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Members write notes" ON workspace_notes;
CREATE POLICY "Members write notes" ON workspace_notes FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    AND author_id = auth.uid()
  );
DROP POLICY IF EXISTS "Authors edit notes" ON workspace_notes;
CREATE POLICY "Authors edit notes" ON workspace_notes FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "Authors delete notes" ON workspace_notes;
CREATE POLICY "Authors delete notes" ON workspace_notes FOR DELETE
  USING (
    author_id = auth.uid()
    OR workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members read pick lists" ON workspace_pick_lists;
CREATE POLICY "Members read pick lists" ON workspace_pick_lists FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Editors write pick lists" ON workspace_pick_lists;
CREATE POLICY "Editors write pick lists" ON workspace_pick_lists FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Members read suggestions" ON workspace_suggestions;
CREATE POLICY "Members read suggestions" ON workspace_suggestions FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Members write suggestions" ON workspace_suggestions;
CREATE POLICY "Members write suggestions" ON workspace_suggestions FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    AND author_id = auth.uid()
  );
DROP POLICY IF EXISTS "Admin manages suggestions" ON workspace_suggestions;
CREATE POLICY "Admin manages suggestions" ON workspace_suggestions FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "Members read activity" ON workspace_activity;
CREATE POLICY "Members read activity" ON workspace_activity FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Members write activity" ON workspace_activity;
CREATE POLICY "Members write activity" ON workspace_activity FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    AND actor_id = auth.uid()
  );

-- Public read for invite-code lookups on the /join/[code] page.
CREATE OR REPLACE FUNCTION public.lookup_workspace_by_invite(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  team_number INT,
  season INT,
  invite_disabled BOOLEAN,
  member_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id,
    w.name,
    w.team_number,
    w.season,
    w.invite_disabled,
    (SELECT count(*) FROM workspace_members m WHERE m.workspace_id = w.id) AS member_count
  FROM workspaces w
  WHERE w.invite_code = upper(p_code) AND w.paid = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_workspace_by_invite(TEXT) TO anon, authenticated;
