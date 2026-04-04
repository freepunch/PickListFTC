"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  onComplete: () => void;
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: (
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
      </svg>
    ),
    title: "Find Your Event",
    text: "Search for any FTC event by name or paste an event code. If the event hasn't started yet, prescout mode kicks in with season-wide data.",
  },
  {
    icon: (
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Leaderboard",
    text: "Every team ranked by OPR with tabs for Auto, Driver-Controlled, and Advanced stats. Click any column to sort. Click a row to see match details.",
  },
  {
    icon: (
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Partner Finder",
    text: "Select your team and see every other team ranked by compatibility. Switch between Balanced, OPR, Auto Priority, DC Priority, and Consistency modes.",
  },
  {
    icon: (
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: "Compare Teams",
    text: "Pick two or three teams for a side-by-side breakdown with radar charts and a complementarity score.",
  },
  {
    icon: (
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    title: "Pick List",
    text: "Drag and drop to rank teams for alliance selection. Add notes, mark teams as taken, and export a printable list. Each event gets its own list.",
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="currentColor">
        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    title: "You're Ready",
    text: "Star events to watch them, press ⌘K to quick-switch, and check team reports for full-season scouting summaries. Good luck out there.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function Tutorial({ onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  // Overlay fade: 0 = invisible, 1 = visible
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  // Card content opacity for crossfade between steps
  const [cardOpacity, setCardOpacity] = useState(1);

  // Fade in on mount
  useEffect(() => {
    setMounted(true);
    // Allow the browser to paint the opacity-0 state before animating in
    const t = setTimeout(() => setOverlayOpacity(1), 20);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setOverlayOpacity(0);
    setTimeout(onComplete, 200);
  };

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = () => {
    if (step >= STEPS.length - 1) {
      dismiss();
      return;
    }
    // Crossfade: fade out → swap content → fade in
    setCardOpacity(0);
    setTimeout(() => {
      setStep((s) => s + 1);
      setCardOpacity(1);
    }, 120);
  };

  if (!mounted) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        backgroundColor: `rgba(0,0,0,${overlayOpacity * 0.82})`,
        transition: "background-color 200ms ease",
      }}
    >
      {/* Card */}
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          opacity: overlayOpacity,
          transform: overlayOpacity === 1 ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 200ms ease, transform 200ms ease",
        }}
      >
        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-800">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Step counter */}
          <p className="text-xs font-medium text-zinc-500 mb-6 tracking-wider uppercase">
            {step + 1} of {STEPS.length}
          </p>

          {/* Icon + content — crossfade together */}
          <div
            style={{
              opacity: cardOpacity,
              transition: "opacity 120ms ease",
            }}
          >
            {/* Icon */}
            <div className="text-[var(--accent)] mb-5">
              {current.icon}
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-3 leading-snug">
              {current.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-zinc-400 leading-relaxed">
              {current.text}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={dismiss}
              className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Skip
            </button>

            <div className="flex items-center gap-3">
              {/* Dot indicators */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`rounded-full transition-all duration-200 ${
                      i === step
                        ? "w-4 h-1.5 bg-[var(--accent)]"
                        : "w-1.5 h-1.5 bg-zinc-700"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={advance}
                className="px-5 py-2 text-sm font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
              >
                {isLast ? "Get Started" : "Next →"}
              </button>
            </div>
          </div>

          {/* Esc hint */}
          <p className="text-[10px] text-zinc-600 mt-4 text-right">Esc to exit</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
