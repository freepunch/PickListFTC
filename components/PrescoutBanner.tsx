"use client";

import { useEffect } from "react";
import { useEvent } from "@/context/EventContext";

export function PrescoutBanner() {
  const { isPrescout, showLiveToast, dismissLiveToast } = useEvent();

  // Auto-dismiss live toast after 5 seconds
  useEffect(() => {
    if (showLiveToast) {
      const t = setTimeout(dismissLiveToast, 5000);
      return () => clearTimeout(t);
    }
  }, [showLiveToast, dismissLiveToast]);

  // Live-data-now-available toast: keep as a small floating chip near the top
  if (showLiveToast) {
    return (
      <div className="px-4 sm:px-6 pt-2 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
          Live data now available
          <button
            onClick={dismissLiveToast}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (!isPrescout) return null;

  // Prescout mode: thin accent strip at top of content
  return (
    <div className="px-4 sm:px-6">
      <div className="h-7 -mb-px flex items-center justify-between gap-3 px-3 rounded-md bg-[var(--accent-subtle)] border border-transparent">
        <div className="flex items-center gap-2 text-[11px] text-[var(--accent)] font-medium tracking-wide">
          <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
          Prescout · season data
        </div>
        <span className="text-[10px] text-[var(--accent)]/70 hidden sm:inline">
          Event hasn&apos;t started — rankings use season performance
        </span>
      </div>
    </div>
  );
}
