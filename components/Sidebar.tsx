"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";

// ── Season-level nav (always accessible) ──

const SEASON_NAV = [
  {
    href: "/season",
    label: "My Season",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/watched",
    label: "Watched Teams",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    href: "/picklists",
    label: "All Pick Lists",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
];

// ── Event-level nav (requires an event to be loaded) ──

const EVENT_NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/compare",
    label: "Compare",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    href: "/partners",
    label: "Partner Finder",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/picklist",
    label: "Pick List",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/report",
    label: "Team Report",
    isReport: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ── Event status helpers ──

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
  live: "bg-green-400",
  upcoming: "bg-amber-400",
  finished: "bg-zinc-600",
};

// ── Team number prompt modal ──

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
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">Welcome!</h3>
        <p className="text-sm text-zinc-400 mb-4">
          What&apos;s your FTC team number? This is optional and helps with team sharing features.
        </p>
        <input
          type="text"
          value={teamNum}
          onChange={(e) => setTeamNum(e.target.value)}
          placeholder="e.g. 21364"
          autoFocus
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
            font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)] mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={dismissTeamPrompt} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">Skip</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Migration prompt modal ──

function MigrationPromptModal() {
  const { acceptMigration, dismissMigration } = useAuth();

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">Sync Local Data?</h3>
        <p className="text-sm text-zinc-400 mb-4">
          You have existing scouting data saved in this browser. Would you like to sync it to your account so it&apos;s available on all your devices?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={dismissMigration} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">Keep Local Only</button>
          <button onClick={acceptMigration} className="px-4 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors">Sync to Account</button>
        </div>
      </div>
    </div>
  );
}

// ── User avatar menu ──

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
        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm hover:bg-zinc-800 transition-colors min-h-[40px] ${collapsed ? "justify-center" : ""}`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {displayName[0].toUpperCase()}
          </div>
        )}
        {!collapsed && <span className="text-zinc-300 truncate text-xs">{displayName}</span>}
      </button>

      {open && (
        <div className={`absolute ${collapsed ? "left-full ml-2" : "left-0 right-0"} bottom-full mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden min-w-[160px]`}>
          <button
            onClick={() => { setOpen(false); router.push("/profile"); }}
            className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            My Profile
          </button>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="w-full text-left px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-red-400 transition-colors flex items-center gap-2 border-t border-zinc-700"
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

// ── Sign in button ──

function SignInButton({ collapsed }: { collapsed: boolean }) {
  const { signInWithGoogle, loading } = useAuth();
  if (loading) return null;

  return (
    <button
      onClick={signInWithGoogle}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors min-h-[40px] ${collapsed ? "justify-center w-full" : "w-full"}`}
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

// ── My Events sidebar section ──

function MyEventsPanel({ collapsed, onSelectEvent }: { collapsed: boolean; onSelectEvent?: () => void }) {
  const { favoriteEvents, toggleEventFav } = useFavorites();
  const { loadEvent, setEventCode, event: activeEvent } = useEvent();
  const [expanded, setExpanded] = useState(true);

  if (favoriteEvents.length === 0 || collapsed) return null;

  return (
    <div className="border-t border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <span className="uppercase tracking-wider">My Events</span>
        <svg className={`w-3 h-3 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5 max-h-[200px] overflow-y-auto">
          {favoriteEvents.map((ev) => {
            const status = getEventStatus(ev.start);
            const isActive = activeEvent?.code === ev.event_code;

            return (
              <div
                key={ev.event_code}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                  isActive ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
                onClick={() => { setEventCode(ev.event_code); loadEvent(ev.event_code); onSelectEvent?.(); }}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                <span className="flex-1 truncate min-w-0">{ev.event_name ?? ev.event_code}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleEventFav(ev); }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all shrink-0 p-0.5"
                  title="Unwatch event"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Nav link renderer ──

function NavLink({
  href,
  label,
  icon,
  isActive,
  collapsed,
  disabled,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  collapsed: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const cls = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 min-h-[40px] ${
    isActive
      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
      : disabled
        ? "text-zinc-700 cursor-not-allowed"
        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
  } ${collapsed ? "justify-center" : ""}`;

  if (disabled) {
    return (
      <div className={cls} title="Load an event first">
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span>{label}</span>}
      </div>
    );
  }

  return (
    <Link href={href} onClick={onClick} title={collapsed ? label : undefined} className={cls}>
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

// ── Shared sidebar content ──

function SidebarContent({ collapsed, onNavClick }: { collapsed: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { event, teams, lastUpdated, loading, refreshEvent, highContrast, setHighContrast } = useEvent();
  const { user, showTeamPrompt, showMigrationPrompt } = useAuth();
  const { isEventFavorited, toggleEventFav } = useFavorites();
  const [showReportSearch, setShowReportSearch] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [, setTick] = useState(0);

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

  return (
    <>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {/* Season-level nav — always accessible */}
        {SEASON_NAV.map((item) => {
          const isActive = item.href === "/season"
            ? pathname === "/season"
            : item.href === "/picklists"
              ? pathname === "/picklists"
              : pathname.startsWith(item.href);

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

        {/* Divider with event label */}
        {!collapsed && (
          <div className="flex items-center gap-2 pt-3 pb-1 px-1">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider shrink-0">
              {hasEvent ? event.name.length > 18 ? event.name.slice(0, 18) + "..." : event.name : "Event"}
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
        )}
        {collapsed && <div className="h-px bg-zinc-800 my-2" />}

        {/* Event-level nav — dimmed when no event */}
        {EVENT_NAV.map((item) => {
          const isReport = "isReport" in item && item.isReport;
          const isActive = isReport
            ? pathname.startsWith("/report")
            : item.href === "/picklist"
              ? pathname === "/picklist"
              : item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

          // Report is special — it has inline search
          if (isReport) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => {
                    if (collapsed) {
                      const num = prompt("Enter team number:");
                      if (num) { router.push(`/report/${num}`); onNavClick?.(); }
                    } else {
                      setShowReportSearch(!showReportSearch);
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 min-h-[40px] ${
                    isActive
                      ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
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
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)] w-full"
                      />
                      <button type="submit" className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          }

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
      </nav>

      {/* My Events panel */}
      <MyEventsPanel collapsed={collapsed} onSelectEvent={onNavClick} />

      {/* High-contrast + Cmd+K hint */}
      <div className={`px-3 ${collapsed ? "flex justify-center" : ""}`}>
        <button
          onClick={() => setHighContrast(!highContrast)}
          title="Toggle high contrast"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors min-h-[40px] ${
            highContrast ? "bg-amber-500/15 text-amber-400" : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
          } ${collapsed ? "justify-center" : "w-full"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
          {!collapsed && <span>{highContrast ? "High Contrast" : "Contrast"}</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-1">
          <p className="text-[10px] text-zinc-700 flex items-center gap-1.5">
            <kbd className="bg-zinc-800 border border-zinc-700/50 rounded px-1 py-0.5 font-mono text-zinc-600">
              {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318K" : "Ctrl+K"}
            </kbd>
            <span>Quick switch</span>
          </p>
        </div>
      )}

      {/* Footer — event info */}
      <div className="p-3 border-t border-[var(--border)]">
        {event ? (
          <div className={`${collapsed ? "text-center" : ""}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <span className="font-mono text-xs text-zinc-400" title={event.name}>{teams.length}</span>
                <button onClick={refreshEvent} disabled={loading} title="Refresh data" className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40">
                  <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-200 truncate flex-1 mr-2">{event.name}</p>
                  <button
                    onClick={() => toggleEventFav({ event_code: event.code, event_name: event.name, season: event.season, start: event.start })}
                    title={isEventFavorited(event.code) ? "Unwatch event" : "Watch event"}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 transition-all ${
                      isEventFavorited(event.code)
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-zinc-400 bg-zinc-800 hover:bg-amber-500/10 hover:text-amber-400 border border-zinc-700 hover:border-amber-500/30"
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 ${isEventFavorited(event.code) ? "fill-amber-400" : ""}`}
                      fill={isEventFavorited(event.code) ? "currentColor" : "none"}
                      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    {isEventFavorited(event.code) ? "Watching" : "Watch"}
                  </button>
                  <button onClick={refreshEvent} disabled={loading} title="Refresh data" className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 shrink-0">
                    <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-zinc-500">{teams.length} teams</p>
                  {lastUpdated && <span className="text-xs text-zinc-600">&middot; {formatTimeAgo(lastUpdated)}</span>}
                </div>
              </>
            )}
          </div>
        ) : (
          !collapsed && <p className="text-xs text-zinc-600">No event loaded</p>
        )}

        <div className="mt-3">
          {user ? <UserMenu collapsed={collapsed} /> : <SignInButton collapsed={collapsed} />}
        </div>

        {!collapsed && (
          <p className="text-xs text-zinc-500 mt-3">
            Built by{" "}
            <a href="https://ftrobotics.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
              First Try #21364
            </a>
          </p>
        )}
      </div>

      {/* Modals */}
      {showTeamPrompt && <TeamPromptModal />}
      {showMigrationPrompt && !showTeamPrompt && <MigrationPromptModal />}
    </>
  );
}

// ── Exported Sidebar ──

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
      <aside className={`hidden md:flex sticky top-0 h-screen flex-col bg-zinc-900 border-r border-[var(--border)] transition-[width] duration-200 shrink-0 ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          {!collapsed && (
            <h1 className="text-lg font-bold text-white tracking-tight">
              PickList<span className="text-[var(--accent)]">FTC</span>
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <aside className="fixed inset-y-0 left-0 z-[60] w-72 flex flex-col bg-zinc-900 border-r border-[var(--border)] shadow-2xl md:hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <h1 className="text-lg font-bold text-white tracking-tight">
              PickList<span className="text-[var(--accent)]">FTC</span>
            </h1>
            <button onClick={onMobileClose} aria-label="Close menu" className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarContent collapsed={false} onNavClick={onMobileClose} />
        </aside>
      )}
    </>
  );
}
