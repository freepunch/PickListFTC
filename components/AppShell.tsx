"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { QuickSwitcher } from "@/components/QuickSwitcher";
import { Tutorial, TutorialStep } from "@/components/Tutorial";
import { isTutorialComplete, setTutorialComplete, clearTutorialComplete } from "@/lib/storage";

const DEMO_EVENT_CODE = "USTXDAQ1";

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    route: "/dashboard",
    targetSelector: "[data-tutorial='event-loader']",
    title: "Load Any Event",
    text: "Search for any FTC event by name or paste an event code. Your data loads instantly — no account needed.",
    position: "bottom",
  },
  {
    route: "/leaderboard",
    targetSelector: "[data-tutorial='stat-tabs']",
    title: "Leaderboard",
    text: "The Leaderboard ranks every team. Switch tabs for Auto, Driver-Controlled, and Advanced stats. Click any column header to sort.",
    position: "bottom",
  },
  {
    route: "/partners",
    targetSelector: "[data-tutorial='partner-search']",
    title: "Partner Finder",
    text: "Partner Finder ranks the best alliance picks for your team. Switch modes to prioritize OPR, auto, consistency, or balanced fit.",
    position: "bottom",
  },
  {
    route: "/compare",
    targetSelector: "[data-tutorial='compare-inputs']",
    title: "Compare Teams",
    text: "Compare puts two or three teams side by side with radar charts and stat breakdowns.",
    position: "bottom",
  },
  {
    route: "/picklist",
    targetSelector: "[data-tutorial='picklist-area']",
    title: "Pick List Builder",
    text: "Build your alliance pick list here. Drag to rank teams, add notes, and mark teams as taken during alliance selection.",
    position: "top",
  },
  {
    route: "/schedule",
    targetSelector: "[data-tutorial='match-table']",
    title: "Match Schedule",
    text: "View the match schedule with predictions for upcoming matches. Highlight your team to find your games instantly.",
    position: "top",
  },
  {
    route: "/dashboard",
    targetSelector: "a[href='/season']",
    title: "Season Dashboard",
    text: "Star events to track them across the season. Your Season Dashboard shows countdowns, pick list stats, and your top-scouted teams.",
    position: "right",
  },
  {
    route: "/dashboard",
    targetSelector: "[data-tutorial='sidebar-footer']",
    title: "You're Ready to Scout",
    text: "Sign in with Google to sync your data across devices and share scout notes with teammates. Good luck out there.",
    position: "top",
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { highContrast, event, loadEvent, setEventCode } = useEvent();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const tutorialCheckedRef = useRef(false);
  // Keep a ref to event so startTutorial always sees the current value regardless of closure age
  const eventRef = useRef(event);
  useEffect(() => { eventRef.current = event; }, [event]);

  // Auto-load event from ?event= URL param on mount (for pages without EventLoader)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("event");
    if (code && !event) {
      const upper = code.toUpperCase();
      setEventCode(upper);
      loadEvent(upper);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Launch tutorial on first event load
  useEffect(() => {
    if (!event || tutorialCheckedRef.current) return;
    tutorialCheckedRef.current = true;
    const userId = user?.id ?? null;
    if (!isTutorialComplete(userId)) {
      startTutorial(userId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, user]);

  const startTutorial = async (userId: string | null) => {
    // Use ref so we always read the current event, not a stale closure value
    const needsDemo = !eventRef.current;
    if (needsDemo) {
      setDemoLoading(true);
      setShowTutorial(true);
      try {
        setEventCode(DEMO_EVENT_CODE);
        await loadEvent(DEMO_EVENT_CODE);
      } catch {
        // Fall through — tutorial will show with empty state
      } finally {
        setDemoLoading(false);
      }
    } else {
      setShowTutorial(true);
    }
  };

  // Listen for replay-tutorial events dispatched from sidebar
  useEffect(() => {
    function handleReplay() {
      const userId = user?.id ?? null;
      clearTutorialComplete(userId);
      startTutorial(userId);
    }
    window.addEventListener("plftc:startTutorial", handleReplay);
    return () => window.removeEventListener("plftc:startTutorial", handleReplay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    setTutorialComplete(user?.id ?? null);
  };

  return (
    <div className={`flex min-h-screen bg-[var(--bg)] ${highContrast ? "high-contrast" : ""}`}>
      {/* Mobile top bar — visible only on <768px */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 bg-zinc-900 border-b border-[var(--border)] md:hidden">
        <h1 className="text-lg font-bold text-white tracking-tight">
          PickList<span className="text-[var(--accent)]">FTC</span>
        </h1>
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* Dim backdrop for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <main className="flex-1 min-w-0 overflow-x-hidden pt-14 md:pt-0">
        {children}
      </main>

      <QuickSwitcher />

      {showTutorial && (
        <Tutorial
          steps={TUTORIAL_STEPS}
          loading={demoLoading}
          onComplete={handleTutorialComplete}
        />
      )}
    </div>
  );
}
