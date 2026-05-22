"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useWorkspace, useWorkspaceOptional } from "@/context/WorkspaceContext";

// ── Nav data ──────────────────────────────────────────────────────────────────
// Icons are 18px (was 20–24): smaller icons feel more refined.

const DASHBOARD_ITEM = {
  href: "/dashboard",
  label: "Dashboard",
  icon: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
};

const SCOUT_NAV = [
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: "/compare",
    label: "Compare",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    href: "/partners",
    label: "Partner Finder",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/report",
    label: "Team Report",
    isReport: true,
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

const PLAN_NAV = [
  {
    href: "/picklist",
    label: "Pick List",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/draft",
    label: "Draft Board",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
      </svg>
    ),
    needsWorkspace: true,
  },
  {
    href: "/simulator",
    label: "Alliance Sim",
    eventOptional: true,
    needsWorkspace: true,
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    href: "/workspace",
    label: "Workspace",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    eventOptional: true,
  },
];

const SEASON_NAV = [
  {
    href: "/season",
    label: "My Season",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
];

const SETTINGS_ITEM = {
  href: "/settings",
  label: "Settings",
  icon: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

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

const STATUS_DOT: Record<string, string> = {
  live: "bg-[var(--success)]",
  upcoming: "bg-[var(--warning)]",
  finished: "bg-[var(--text-muted)]",
};

// ── Wordmark ──────────────────────────────────────────────────────────────────

function Wordmark() {
  return (
    <h1 className="font-display text-[15px] tracking-tight text-[var(--text-primary)] select-none">
      <span className="font-semibold">PickList</span>
      <span className="font-bold text-[var(--accent)]">FTC</span>
    </h1>
  );
}

// ── Team number prompt modal ──────────────────────────────────────────────────

function TeamPromptModal() {
  const { updateProfile, dismissTeamPrompt } = useAuth();
  const [teamNum, setTeamNum] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const num = parseInt(teamNum.trim(), 10);
    if (!isNaN(num) && num > 0) {
      setSaving(true);
      await updateProfile({ team_number: num });
      setSaving(false);
    }
    dismissTeamPrompt();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl animate-popover-in">
        <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-2 tracking-tight">Welcome</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          What&apos;s your FTC team number? This is optional and helps with team sharing features.
        </p>
        <input
          type="text"
          value={teamNum}
          onChange={(e) => setTeamNum(e.target.value)}
          placeholder="e.g. 21364"
          autoFocus
          className="w-full bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]
            font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={dismissTeamPrompt} className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Skip</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Migration prompt modal ────────────────────────────────────────────────────

function MigrationPromptModal() {
  const { acceptMigration, dismissMigration } = useAuth();

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl animate-popover-in">
        <h3 className="font-display text-lg font-semibold text-[var(--text-primary)] mb-2 tracking-tight">Sync local data</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          You have existing scouting data saved in this browser. Would you like to sync it to your account so it&apos;s available on all your devices?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={dismissMigration} className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Keep Local</button>
          <button onClick={acceptMigration} className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors">Sync to Account</button>
        </div>
      </div>
    </div>
  );
}

// ── User avatar menu ──────────────────────────────────────────────────────────

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm hover:bg-[var(--bg-card-hover)] transition-colors min-h-[40px] ${collapsed ? "justify-center" : ""}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {displayName[0].toUpperCase()}
          </div>
        )}
        {!collapsed && <span className="text-[var(--text-secondary)] truncate text-xs">{displayName}</span>}
      </button>

      {open && (
        <div className={`absolute ${collapsed ? "left-full ml-2" : "left-0 right-0"} bottom-full mb-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl z-50 overflow-hidden min-w-[160px] animate-popover-in`}>
          <button
            onClick={() => { setOpen(false); router.push("/profile"); }}
            className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            My Profile
          </button>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--danger)] transition-colors flex items-center gap-2 border-t border-[var(--border)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sign in button (kept for parity) ──────────────────────────────────────────

function SignInButton({ collapsed }: { collapsed: boolean }) {
  const { signInWithGoogle, loading } = useAuth();
  if (loading) return null;

  return (
    <button
      onClick={signInWithGoogle}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors min-h-[40px] ${collapsed ? "justify-center w-full" : "w-full"}`}
      title="Sign in with Google"
    >
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {!collapsed && <span>Sign In</span>}
    </button>
  );
}

// ── My Events sidebar section ─────────────────────────────────────────────────

function MyEventsPanel({ collapsed, onSelectEvent }: { collapsed: boolean; onSelectEvent?: () => void }) {
  const { favoriteEvents, toggleEventFav } = useFavorites();
  const { loadEvent, setEventCode, event: activeEvent } = useEvent();
  const wsCtx = useWorkspaceOptional();
  const [expanded, setExpanded] = useState(true);

  function handleSelect(eventCode: string, eventName: string | null) {
    setEventCode(eventCode);
    loadEvent(eventCode);
    window.dispatchEvent(
      new CustomEvent("plftc:eventLoading", {
        detail: { code: eventCode, name: eventName ?? eventCode },
      })
    );
    onSelectEvent?.();
  }

  const wsEvents = wsCtx?.workspaceEvents ?? [];
  const wsEventCodes = new Set(wsEvents.map((e) => e.event_code));
  const personalOnly = favoriteEvents.filter((e) => !wsEventCodes.has(e.event_code));
  const totalCount = wsEvents.length + personalOnly.length;

  if (totalCount === 0 || collapsed) return null;

  return (
    <div data-tutorial="my-events-panel" className="border-t border-[var(--border-subtle)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <span>My Events</span>
        <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5 max-h-[200px] overflow-y-auto">
          {/* Workspace events — shown first with a team badge */}
          {wsEvents.map((ev) => {
            const status = getEventStatus(ev.event_start ?? undefined);
            const isActive = activeEvent?.code === ev.event_code;
            return (
              <button
                type="button"
                key={`ws-${ev.event_code}`}
                onClick={() => handleSelect(ev.event_code, ev.event_name ?? null)}
                className={`group w-full flex items-center gap-2 px-2 py-2 min-h-[36px] rounded-lg text-xs transition-colors text-left ${
                  isActive
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                <span className="flex-1 truncate min-w-0">{ev.event_name ?? ev.event_code}</span>
                <span className="shrink-0 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold">
                  Team
                </span>
              </button>
            );
          })}

          {/* Personal favorites not already in workspace */}
          {personalOnly.map((ev) => {
            const status = getEventStatus(ev.start);
            const isActive = activeEvent?.code === ev.event_code;
            return (
              <button
                type="button"
                key={ev.event_code}
                onClick={() => handleSelect(ev.event_code, ev.event_name ?? null)}
                className={`group w-full flex items-center gap-2 px-2 py-2 min-h-[36px] rounded-lg text-xs transition-colors text-left ${
                  isActive
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                <span className="flex-1 truncate min-w-0">{ev.event_name ?? ev.event_code}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); toggleEventFav(ev); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleEventFav(ev); } }}
                  className="md:opacity-0 md:group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-all shrink-0 p-1"
                  title="Unwatch event"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Nav link with active-indicator bar ────────────────────────────────────────

function NavLink({
  href,
  label,
  icon,
  isActive,
  collapsed,
  disabled,
  wsLocked,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  collapsed: boolean;
  disabled?: boolean;
  wsLocked?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
}) {
  const baseCls = `relative flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition-all duration-150 ${
    isActive
      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
      : disabled
        ? "text-[var(--text-muted)] cursor-not-allowed opacity-60"
        : wsLocked
          ? "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
  } ${collapsed ? "justify-center" : ""}`;

  const inner = (
    <>
      {/* Sliding active indicator bar */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-[var(--accent)] transition-[height,opacity] duration-200 ${
          isActive ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
        aria-hidden
      />
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && wsLocked && (
        <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )}
      {!collapsed && badge}
    </>
  );

  if (disabled) {
    return (
      <div className={baseCls} title="Load an event first">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? (wsLocked ? `${label} (Workspace)` : label) : undefined}
      className={baseCls}
    >
      {inner}
    </Link>
  );
}

// ── Shared sidebar content ────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onNavClick,
  isMobile = false,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { event, teams, lastUpdated, loading, refreshEvent } = useEvent();
  const { user, showTeamPrompt, showMigrationPrompt } = useAuth();
  const { isEventFavorited, toggleEventFav } = useFavorites();
  const { workspace: ws, pendingSuggestions: wsPending, isInWorkspace } = useWorkspace();
  const workspacePendingCount = wsPending.length;
  const [showReportSearch, setShowReportSearch] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [, setTick] = useState(0);
  const [tickerScroll, setTickerScroll] = useState(false);
  const [tickerVars, setTickerVars] = useState({ distance: "0px", duration: "8s" });
  const tickerTextRef = useRef<HTMLSpanElement>(null);
  const tickerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function measure() {
      if (!tickerTextRef.current || !tickerContainerRef.current) return;
      const textWidth = tickerTextRef.current.scrollWidth;
      const containerWidth = tickerContainerRef.current.clientWidth;
      const overflow = textWidth - containerWidth;
      if (overflow > 0) {
        setTickerScroll(true);
        setTickerVars({
          distance: `-${overflow + 16}px`,
          duration: `${Math.max(5, textWidth / 30).toFixed(1)}s`,
        });
      } else {
        setTickerScroll(false);
      }
    }
    measure();
    const container = tickerContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [event?.name, collapsed]);

  const hasEvent = !!event;

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleReportSubmit = () => {
    const num = parseInt(reportQuery.trim(), 10);
    if (!isNaN(num) && num > 0) {
      router.push(`/report/${num}`);
      setShowReportSearch(false);
      setReportQuery("");
      onNavClick?.();
    }
  };

  // Report link: inline search expander
  const reportActive = pathname.startsWith("/report");
  const reportNode = (
    <div key="/report">
      <button
        onClick={() => {
          if (collapsed) {
            const num = prompt("Enter team number:");
            if (num) { router.push(`/report/${num}`); onNavClick?.(); }
          } else {
            setShowReportSearch(!showReportSearch);
          }
        }}
        title={collapsed ? "Team Report" : undefined}
        className={`relative w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          reportActive
            ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-[var(--accent)] transition-[height,opacity] duration-200 ${
            reportActive ? "h-5 opacity-100" : "h-0 opacity-0"
          }`}
          aria-hidden
        />
        <span className="shrink-0">
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </span>
        {!collapsed && <span>Team Report</span>}
      </button>
      {showReportSearch && !collapsed && (
        <div className="mt-1 px-1">
          <form onSubmit={(e) => { e.preventDefault(); handleReportSubmit(); }} className="flex gap-1">
            <input
              type="text"
              value={reportQuery}
              onChange={(e) => setReportQuery(e.target.value)}
              placeholder="Team #"
              autoFocus
              className="flex-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-full"
            />
            <button type="submit" className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );

  // ── Mobile flat-list nav ────────────────────────────────────────────────────
  if (isMobile) {
    const allItems: { href: string; label: string; icon: React.ReactNode; needsEvent: boolean; section?: string; wsLocked?: boolean }[] = [
      { href: "/dashboard", label: "Dashboard", icon: DASHBOARD_ITEM.icon, needsEvent: false },
      ...SCOUT_NAV.filter((it) => !it.isReport).map((it) => ({
        href: it.href, label: it.label, icon: it.icon, needsEvent: true,
      })),
      ...PLAN_NAV.map((it) => ({
        href: it.href, label: it.label, icon: it.icon,
        needsEvent: !("eventOptional" in it && it.eventOptional),
        wsLocked: "needsWorkspace" in it && it.needsWorkspace && !isInWorkspace,
      })),
      { href: "/report", label: "Team Report", icon: SCOUT_NAV.find((it) => it.isReport)!.icon, needsEvent: false, section: "report" },
      ...SEASON_NAV.map((it, i) => ({
        href: it.href, label: it.label, icon: it.icon, needsEvent: false,
        section: i === 0 ? "season-divider" : undefined,
      })),
      {
        href: "/settings",
        label: "Settings",
        icon: SETTINGS_ITEM.icon,
        needsEvent: false,
        section: "settings-divider",
      },
    ];

    return (
      <>
        <nav data-tutorial="sidebar-nav" className="flex-1 px-3 py-2 overflow-y-auto">
          {/* Search Events */}
          <button
            type="button"
            onClick={() => {
              onNavClick?.();
              window.dispatchEvent(new CustomEvent("plftc:openQuickSwitcher"));
            }}
            className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg bg-[var(--bg-card-hover)] text-[var(--text-secondary)] active:bg-[var(--border)] mb-3"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="text-sm font-medium">Search Events</span>
          </button>

          {allItems.map((it, idx) => {
            const isActive =
              it.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(it.href);
            const disabled = it.needsEvent && !hasEvent;
            const wsLocked = "wsLocked" in it && it.wsLocked;
            const showDivider = it.section === "season-divider" || it.section === "settings-divider";

            if (it.section === "report") {
              return (
                <button
                  key={`${it.href}-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const num = window.prompt("Enter team number:");
                    const parsed = parseInt(num ?? "", 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      router.push(`/report/${parsed}`);
                      onNavClick?.();
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-colors text-left ${
                    isActive
                      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                      : disabled
                        ? "text-[var(--text-muted)] cursor-not-allowed"
                        : "text-[var(--text-secondary)] active:bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card-hover)]"
                  }`}
                >
                  <span className="shrink-0">{it.icon}</span>
                  <span>{it.label}</span>
                </button>
              );
            }

            const linkCls = `w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                : disabled
                  ? "text-[var(--text-muted)] cursor-not-allowed"
                  : wsLocked
                    ? "text-[var(--text-muted)] active:bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card-hover)]"
                    : "text-[var(--text-secondary)] active:bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card-hover)]"
            }`;

            return (
              <div key={`${it.href}-${idx}`}>
                {showDivider && <div className="my-2 border-t border-[var(--border-subtle)]" />}
                {disabled ? (
                  <div className={linkCls} aria-disabled="true">
                    <span className="shrink-0">{it.icon}</span>
                    <span>{it.label}</span>
                  </div>
                ) : (
                  <Link href={it.href} onClick={onNavClick} className={linkCls}>
                    <span className="shrink-0">{it.icon}</span>
                    <span className="flex-1">{it.label}</span>
                    {wsLocked && (
                      <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        <MyEventsPanel collapsed={false} onSelectEvent={onNavClick} />

        <div data-tutorial="sidebar-footer" className="p-3 border-t border-[var(--border-subtle)]">
          {event && (
            <div className="mb-3">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{event.name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {teams.length} teams
                {lastUpdated && <span> · {formatTimeAgo(lastUpdated)}</span>}
              </p>
            </div>
          )}
          <UserMenu collapsed={false} />
        </div>

        {showTeamPrompt && <TeamPromptModal />}
        {showMigrationPrompt && !showTeamPrompt && <MigrationPromptModal />}
      </>
    );
  }

  // ── Desktop nav: groups expressed as spacing, not labels ───────────────────

  // Filter scout/plan items based on event/workspace availability — but still
  // render them so users see what's there.
  return (
    <>
      <nav data-tutorial="sidebar-nav" className="flex-1 p-2 overflow-y-auto">
        {/* Group 1: Dashboard */}
        <div className="space-y-0.5">
          <NavLink
            href={DASHBOARD_ITEM.href}
            label={DASHBOARD_ITEM.label}
            icon={DASHBOARD_ITEM.icon}
            isActive={pathname === "/dashboard"}
            collapsed={collapsed}
            onClick={onNavClick}
          />
        </div>

        {/* Group 2: Scout — separation via mt-6 spacing */}
        <div className="mt-6 space-y-0.5">
          {SCOUT_NAV.map((item) => {
            if (item.isReport) return reportNode;
            const isActive =
              item.href === "/leaderboard"
                ? pathname.startsWith("/leaderboard")
                : item.href === "/compare"
                  ? pathname.startsWith("/compare")
                  : item.href === "/partners"
                    ? pathname.startsWith("/partners")
                    : false;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                collapsed={collapsed}
                disabled={!hasEvent}
                onClick={onNavClick}
              />
            );
          })}
        </div>

        {/* Group 3: Plan */}
        <div className="mt-6 space-y-0.5">
          {PLAN_NAV.map((item) => {
            const isActive =
              item.href === "/picklist"
                ? pathname === "/picklist"
                : pathname.startsWith(item.href);
            const eventOptional = "eventOptional" in item && item.eventOptional;
            const itemDisabled = !eventOptional && !hasEvent;
            const needsWs = "needsWorkspace" in item && item.needsWorkspace;
            const wsLocked = needsWs && !isInWorkspace;
            const showDot = item.href === "/workspace" && workspacePendingCount > 0;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                collapsed={collapsed}
                disabled={itemDisabled}
                wsLocked={wsLocked}
                badge={
                  showDot ? (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0"
                      title={`${workspacePendingCount} pending suggestion${workspacePendingCount === 1 ? "" : "s"}`}
                    />
                  ) : undefined
                }
                onClick={onNavClick}
              />
            );
          })}
        </div>

        {/* Group 4: Season */}
        <div className="mt-6 space-y-0.5" data-tutorial="sidebar-season">
          {SEASON_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                collapsed={collapsed}
                onClick={onNavClick}
              />
            );
          })}
        </div>

        {/* Group 5: Settings */}
        <div className="mt-6 space-y-0.5">
          <NavLink
            href={SETTINGS_ITEM.href}
            label={SETTINGS_ITEM.label}
            icon={SETTINGS_ITEM.icon}
            isActive={pathname === "/settings"}
            collapsed={collapsed}
            onClick={onNavClick}
          />
        </div>
      </nav>

      {/* Workspace indicator card */}
      {ws && (
        <Link
          href="/workspace"
          onClick={onNavClick}
          title={collapsed ? `Workspace: ${ws.name}` : undefined}
          className={`relative mx-2 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-[var(--border-subtle)] bg-[var(--bg-card-hover)]/40 hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] ${collapsed ? "justify-center" : ""}`}
        >
          <svg className="w-4 h-4 shrink-0 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          {!collapsed && (
            <span className="flex-1 truncate text-[var(--text-primary)]">{ws.name}</span>
          )}
          {workspacePendingCount > 0 && (
            <span
              className={`${collapsed ? "absolute top-1 right-1" : ""} w-1.5 h-1.5 rounded-full bg-[var(--warning)]`}
              title={`${workspacePendingCount} pending`}
            />
          )}
        </Link>
      )}

      <MyEventsPanel collapsed={collapsed} onSelectEvent={onNavClick} />

      {/* Footer — event info → user → watermark */}
      <div data-tutorial="sidebar-footer" className="p-3 border-t border-[var(--border-subtle)] space-y-3">
        {event ? (
          collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="font-mono text-xs text-[var(--text-secondary)]" title={event.name}>{teams.length}</span>
              <button
                onClick={refreshEvent}
                disabled={loading}
                title="Refresh"
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40"
              >
                <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5">
                <div ref={tickerContainerRef} className="overflow-hidden flex-1 min-w-0">
                  <span
                    ref={tickerTextRef}
                    className={`text-sm font-medium text-[var(--text-primary)]${tickerScroll ? " ticker-text" : ""}`}
                    style={{
                      display: "inline-block",
                      whiteSpace: "nowrap",
                      ...(tickerScroll && {
                        "--scroll-distance": tickerVars.distance,
                        "--ticker-duration": tickerVars.duration,
                      } as React.CSSProperties),
                    }}
                  >
                    {event.name}
                  </span>
                </div>
                <button
                  onClick={() => toggleEventFav({ event_code: event.code, event_name: event.name, season: event.season, start: event.start })}
                  title={isEventFavorited(event.code) ? "Unwatch" : "Watch"}
                  className={`p-1 rounded-md shrink-0 transition-colors ${
                    isEventFavorited(event.code)
                      ? "text-[var(--warning)]"
                      : "text-[var(--text-muted)] hover:text-[var(--warning)]"
                  }`}
                >
                  <svg
                    className={`w-4 h-4 ${isEventFavorited(event.code) ? "fill-[var(--warning)]" : ""}`}
                    fill={isEventFavorited(event.code) ? "currentColor" : "none"}
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </button>
                <button
                  onClick={refreshEvent}
                  disabled={loading}
                  title="Refresh"
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-40 shrink-0"
                >
                  <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs text-[var(--text-muted)]">{teams.length} teams</p>
                {lastUpdated && (
                  <span className="text-xs text-[var(--text-muted)]">· {formatTimeAgo(lastUpdated)}</span>
                )}
              </div>
            </div>
          )
        ) : (
          !collapsed && <p className="text-xs text-[var(--text-muted)]">No event loaded</p>
        )}

        <UserMenu collapsed={collapsed} />

        {!collapsed && (
          <p className="text-[10px] text-[var(--text-muted)] opacity-60">
            Built by{" "}
            <a
              href="https://ftrobotics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100 hover:text-[var(--text-secondary)] transition-all"
            >
              First Try #21364
            </a>
          </p>
        )}
      </div>

      {showTeamPrompt && <TeamPromptModal />}
      {showMigrationPrompt && !showTeamPrompt && <MigrationPromptModal />}
    </>
  );
}

// ── Exported Sidebar ──────────────────────────────────────────────────────────

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w >= 768 && w < 1024) setCollapsed(true);
      else if (w >= 1024) setCollapsed(false);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex sticky top-0 h-screen flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] transition-[width] duration-200 shrink-0 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border-subtle)]">
          {!collapsed && <Wordmark />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
        <SidebarContent collapsed={collapsed} isMobile={false} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <aside className="fixed inset-y-0 left-0 z-[60] w-72 flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border)] shadow-2xl md:hidden">
          <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border-subtle)]">
            <Wordmark />
            <button
              onClick={onMobileClose}
              aria-label="Close menu"
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarContent collapsed={false} onNavClick={onMobileClose} isMobile={true} />
        </aside>
      )}
    </>
  );
}
