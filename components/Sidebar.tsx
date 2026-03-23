"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useEvent } from "@/context/EventContext";

const NAV_ITEMS = [
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
    href: "/report",
    label: "Team Report",
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { event, teams, lastUpdated, loading, refreshEvent, highContrast, setHighContrast } = useEvent();
  const [collapsed, setCollapsed] = useState(false);
  const [showReportSearch, setShowReportSearch] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [, setTick] = useState(0);

  // Auto-collapse below 1024px
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Tick every 30s to update "last updated" display
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
    }
  };

  return (
    <aside
      className={`sticky top-0 h-screen flex flex-col bg-zinc-900 border-r border-[var(--border)] transition-[width] duration-200 shrink-0 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header */}
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
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isReport = item.href === "/report";
          const isActive = isReport
            ? pathname.startsWith("/report")
            : item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          if (isReport) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => {
                    if (collapsed) {
                      const num = prompt("Enter team number:");
                      if (num) router.push(`/report/${num}`);
                    } else {
                      setShowReportSearch(!showReportSearch);
                    }
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
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
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleReportSubmit();
                      }}
                      className="flex gap-1"
                    >
                      <input
                        type="text"
                        value={reportQuery}
                        onChange={(e) => setReportQuery(e.target.value)}
                        placeholder="Team #"
                        autoFocus
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white
                          font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)] w-full"
                      />
                      <button
                        type="submit"
                        className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-zinc-400
                          hover:text-white hover:border-zinc-600 transition-colors"
                      >
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
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* High-contrast toggle */}
      <div className={`px-3 ${collapsed ? "flex justify-center" : ""}`}>
        <button
          onClick={() => setHighContrast(!highContrast)}
          title="Toggle high contrast"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
            highContrast
              ? "bg-amber-500/15 text-amber-400"
              : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
          } ${collapsed ? "justify-center" : "w-full"}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
          {!collapsed && <span>{highContrast ? "High Contrast" : "Contrast"}</span>}
        </button>
      </div>

      {/* Footer — event info */}
      <div className="p-3 border-t border-[var(--border)]">
        {event ? (
          <div className={`${collapsed ? "text-center" : ""}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <span className="font-mono text-xs text-zinc-400" title={event.name}>
                  {teams.length}
                </span>
                <button
                  onClick={refreshEvent}
                  disabled={loading}
                  title="Refresh data"
                  className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40"
                >
                  <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-200 truncate flex-1 mr-2">
                    {event.name}
                  </p>
                  <button
                    onClick={refreshEvent}
                    disabled={loading}
                    title="Refresh data"
                    className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 shrink-0"
                  >
                    <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-zinc-500">
                    {teams.length} teams
                  </p>
                  {lastUpdated && (
                    <span className="text-xs text-zinc-600">
                      &middot; {formatTimeAgo(lastUpdated)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          !collapsed && (
            <p className="text-xs text-zinc-600">No event loaded</p>
          )
        )}
        {!collapsed && (
          <p className="text-xs text-zinc-500 mt-3">
            Built by{" "}
            <a
              href="https://ftrobotics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors"
            >
              First Try #21364
            </a>
          </p>
        )}
      </div>
    </aside>
  );
}
