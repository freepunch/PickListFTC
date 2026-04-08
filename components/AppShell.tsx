"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { QuickSwitcher } from "@/components/QuickSwitcher";
import { Tutorial } from "@/components/Tutorial";
import { isTutorialComplete, setTutorialComplete, clearTutorialComplete } from "@/lib/storage";

const REDIRECT_KEY = "plftc:redirectAfterAuth";
const SESSION_EXPIRED_KEY = "plftc:sessionExpired";

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-white">PickList</span>
          <span className="text-[var(--accent)]">FTC</span>
        </h1>
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { highContrast, event, eventCode, loadEvent, setEventCode } = useEvent();
  const { user, loading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialCheckedRef = useRef(false);
  const restoredRef = useRef(false);
  const prevUserRef = useRef<typeof user | undefined>(undefined);

  // ── Auth gate ────────────────────────────────────────────────────────────────
  // Redirect unauthenticated users to the landing page.
  // Save the current URL first so we can restore it after sign-in.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const url = window.location.href;
      const origin = window.location.origin;
      // Only save deep links (not root/dashboard — those aren't worth restoring)
      if (url !== `${origin}/` && url !== `${origin}/dashboard`) {
        sessionStorage.setItem(REDIRECT_KEY, url);
      }
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // ── Session expiry detection ─────────────────────────────────────────────────
  // If the user was previously logged in and now isn't, the session expired.
  // Flag it so the landing page can show a toast.
  useEffect(() => {
    if (authLoading) return;
    if (prevUserRef.current != null && user === null) {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
    }
    prevUserRef.current = user;
  }, [user, authLoading]);

  // ── Redirect-after-auth ───────────────────────────────────────────────────────
  // After the user signs in, restore their original deep link if one was saved.
  useEffect(() => {
    if (!user || authLoading || restoredRef.current) return;
    restoredRef.current = true;
    const saved = sessionStorage.getItem(REDIRECT_KEY);
    if (saved) {
      sessionStorage.removeItem(REDIRECT_KEY);
      router.replace(saved);
    }
  }, [user, authLoading, router]);

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

  // Keep ?event= URL param in sync with current event so the address bar is always shareable.
  useEffect(() => {
    if (!eventCode) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("event") === eventCode) return;
    params.set("event", eventCode);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [eventCode]);

  // Launch tutorial on first event load.
  useEffect(() => {
    if (!event || authLoading || tutorialCheckedRef.current || !user) return;
    tutorialCheckedRef.current = true;
    if (!isTutorialComplete(user.id)) {
      setShowTutorial(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, user, authLoading]);

  // Listen for replay-tutorial events dispatched from sidebar
  useEffect(() => {
    function handleReplay() {
      if (user?.id) clearTutorialComplete(user.id);
      setShowTutorial(true);
    }
    window.addEventListener("plftc:startTutorial", handleReplay);
    return () => window.removeEventListener("plftc:startTutorial", handleReplay);
  }, [user]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    if (user?.id) setTutorialComplete(user.id);
  };

  // Block rendering until auth is confirmed — prevents flashing the app for signed-out users
  if (authLoading || !user) {
    return <AuthLoadingScreen />;
  }

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
        <Tutorial onComplete={handleTutorialComplete} />
      )}
    </div>
  );
}
