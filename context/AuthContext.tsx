"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { hasUnscopedData } from "@/lib/storage";
import { track } from "@vercel/analytics";
import type { User, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  display_name: string | null;
  team_number: number | null;
  created_at: string;
  welcome_email_sent: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, "display_name" | "team_number">>) => Promise<void>;
  showTeamPrompt: boolean;
  dismissTeamPrompt: () => void;
  showMigrationPrompt: boolean;
  acceptMigration: () => void;
  dismissMigration: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Check if user has any unscoped localStorage scouting data worth migrating
function hasLocalData(): boolean {
  return hasUnscopedData();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTeamPrompt, setShowTeamPrompt] = useState(false);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [migrationAccepted, setMigrationAccepted] = useState(false);

  // Fetch or create profile
  const fetchProfile = useCallback(async (userId: string, isNewUser: boolean, userEmail?: string, userName?: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist — create one (new user)
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ id: userId, display_name: userName ?? null })
          .select()
          .single();

        if (!insertError && newProfile) {
          setProfile(newProfile as Profile);
          setShowTeamPrompt(true);
          if (hasLocalData()) setShowMigrationPrompt(true);

          // Fire-and-forget welcome email
          if (userEmail) {
            fetch('/api/welcome-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail, name: userName }),
            }).then(() => {
              supabase.from('profiles').update({ welcome_email_sent: true }).eq('id', userId);
            }).catch(err => console.error('[EMAIL] Failed to send welcome:', err));
          }
        }
        return;
      }

      if (!error && data) {
        setProfile(data as Profile);
        // If this is a fresh login and the user has no team number, prompt
        if (isNewUser && !data.team_number) {
          setShowTeamPrompt(true);
          if (hasLocalData()) setShowMigrationPrompt(true);
        }
      }
    } catch {
      // Silently fail — app works without profile
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[AUTH] getSession:", session?.user?.email ?? "no session");
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, false, session.user.email, session.user.user_metadata?.full_name);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[AUTH] onAuthStateChange:", _event, session?.user?.email ?? "no session");
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        const isNew = _event === "SIGNED_IN";
        if (isNew) {
          // Track sign-in for analytics (daily active users, adoption metrics)
          track("user_signed_in", { userId: newUser.id, email: newUser.email ?? "" });
        }
        fetchProfile(newUser.id, isNew, newUser.email, newUser.user_metadata?.full_name);
      } else {
        setProfile(null);
        setShowTeamPrompt(false);
        setShowMigrationPrompt(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, "display_name" | "team_number">>) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      }
    },
    [user]
  );

  const dismissTeamPrompt = useCallback(() => setShowTeamPrompt(false), []);

  const acceptMigration = useCallback(() => {
    setMigrationAccepted(true);
    setShowMigrationPrompt(false);
  }, []);

  const dismissMigration = useCallback(() => {
    setShowMigrationPrompt(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        updateProfile,
        showTeamPrompt,
        dismissTeamPrompt,
        showMigrationPrompt: showMigrationPrompt || migrationAccepted,
        acceptMigration,
        dismissMigration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Expose whether migration was just accepted (for other contexts to trigger sync)
export function useMigrationAccepted() {
  const ctx = useContext(AuthContext);
  if (!ctx) return false;
  // showMigrationPrompt stays true via migrationAccepted after acceptMigration
  return ctx.showMigrationPrompt;
}
