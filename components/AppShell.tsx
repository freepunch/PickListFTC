"use client";

import { ReactNode, useEffect, useState } from "react";
import { useEvent } from "@/context/EventContext";
import { Sidebar } from "@/components/Sidebar";
import { QuickSwitcher } from "@/components/QuickSwitcher";

export function AppShell({ children }: { children: ReactNode }) {
  const { highContrast, event, loadEvent, setEventCode } = useEvent();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    </div>
  );
}
