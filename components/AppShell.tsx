"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { QuickSwitcher } from "@/components/QuickSwitcher";
import { Tutorial, TutorialStep } from "@/components/Tutorial";
import { isTutorialComplete, setTutorialComplete, clearTutorialComplete } from "@/lib/storage";

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    targetSelector: "[data-tutorial='event-loader']",
    title: "Load an Event",
    text: "Enter any FTC DECODE event code (e.g. USTXCMP) or search by name to pull live team data. You can switch events at any time.",
    position: "bottom",
  },
  {
    targetSelector: "[data-tutorial='sidebar-nav']",
    title: "Navigate the App",
    text: "Use the sidebar to switch between views. Season-level tools are always accessible; event tools activate once an event is loaded.",
    position: "right",
  },
  {
    targetSelector: "a[href='/leaderboard']",
    title: "Leaderboard",
    text: "Sort all teams by OPR, auto score, driver-controlled, endgame, or consistency to identify the top performers at your event.",
    position: "right",
  },
  {
    targetSelector: "a[href='/schedule']",
    title: "Match Schedule",
    text: "Browse the full match list with win probability predictions and per-alliance OPR breakdowns for every match.",
    position: "right",
  },
  {
    targetSelector: "a[href='/picklist']",
    title: "Pick List",
    text: "Build your alliance pick list with drag-and-drop reordering, picked/available badges, and automatic cloud sync.",
    position: "right",
  },
  {
    targetSelector: "a[href='/compare']",
    title: "Compare Teams",
    text: "Select up to 3 teams to compare side-by-side with a radar chart and detailed stat breakdown table.",
    position: "right",
  },
  {
    targetSelector: "a[href='/partners']",
    title: "Partner Finder",
    text: "Select your team and get a ranked list of the best alliance partners, scored by complementarity and consistency.",
    position: "right",
  },
  {
    targetSelector: "a[href='/season']",
    title: "Season Dashboard",
    text: "Star events to watch them across the season. Your Season Dashboard shows stats, countdowns, and notes for all watched events.",
    position: "right",
  },
  {
    targetSelector: "[data-tutorial='sidebar-footer']",
    title: "Sync Across Devices",
    text: "Sign in with Google to sync your pick lists and scout notes across all your devices and share with teammates.",
    position: "top",
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { highContrast, event, loadEvent, setEventCode } = useEvent();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialCheckedRef = useRef(false);

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
      const t = setTimeout(() => setShowTutorial(true), 600);
      return () => clearTimeout(t);
    }
  }, [event, user]);

  // Listen for replay-tutorial events dispatched from sidebar
  useEffect(() => {
    function handleReplay() {
      clearTutorialComplete(user?.id ?? null);
      setShowTutorial(true);
    }
    window.addEventListener("plftc:startTutorial", handleReplay);
    return () => window.removeEventListener("plftc:startTutorial", handleReplay);
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
        <Tutorial steps={TUTORIAL_STEPS} onComplete={handleTutorialComplete} />
      )}
    </div>
  );
}
