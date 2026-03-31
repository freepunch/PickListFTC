"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, profile, loading, updateProfile, signOut } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync form fields when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setTeamInput(profile.team_number ? String(profile.team_number) : "");
    } else if (user) {
      setDisplayName(
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        ""
      );
    }
  }, [profile, user]);

  // Redirect if not logged in (after auth finishes loading)
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    toastTimer.current = setTimeout(() => setToast(null), 2500);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);

    const teamNum = teamInput.trim() ? parseInt(teamInput.trim(), 10) : null;
    if (teamInput.trim() && (isNaN(teamNum!) || teamNum! < 1 || teamNum! > 99999)) {
      setToast("Invalid team number");
      setSaving(false);
      return;
    }

    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        team_number: teamNum,
      });
      setDirty(false);
      setToast("Saved");
    } catch {
      setToast("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  // Loading / not signed in
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const email = user.email;
  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-2.5">
              {toast === "Saved" ? (
                <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              <span className="text-sm text-zinc-200">{toast}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your account settings</p>
        </div>

        {/* User info card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-14 h-14 rounded-full border border-zinc-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white truncate">
                {displayName || email?.split("@")[0] || "User"}
              </p>
              {email && (
                <p className="text-sm text-zinc-500 truncate">{email}</p>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setDirty(true); }}
                placeholder="Your name"
                maxLength={50}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
                  placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]
                  focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Team Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={teamInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setTeamInput(val);
                  setDirty(true);
                }}
                placeholder="Enter your team #"
                maxLength={5}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono
                  placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]
                  focus:ring-1 focus:ring-[var(--accent)]/30 transition-colors"
              />
              <p className="text-[11px] text-zinc-600 mt-1">
                Used to match you with teammates for shared notes and pick lists.
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="w-full py-2 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)]
                disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Account info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">Account</h2>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Sign-in method</span>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-xs text-zinc-300">Google</span>
            </div>
          </div>

          {createdAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Member since</span>
              <span className="text-xs text-zinc-300">{createdAt}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">User ID</span>
            <span className="text-[11px] text-zinc-600 font-mono truncate max-w-[180px]">
              {user.id}
            </span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full py-2.5 text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20
            hover:bg-red-500/20 rounded-xl transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
