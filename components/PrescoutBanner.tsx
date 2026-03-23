"use client";

import { useState, useEffect } from "react";
import { useEvent } from "@/context/EventContext";

export function PrescoutBanner() {
  const { isPrescout, showLiveToast, dismissLiveToast } = useEvent();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed when switching events
  useEffect(() => {
    setDismissed(false);
  }, [isPrescout]);

  // Auto-dismiss live toast after 5 seconds
  useEffect(() => {
    if (showLiveToast) {
      const t = setTimeout(dismissLiveToast, 5000);
      return () => clearTimeout(t);
    }
  }, [showLiveToast, dismissLiveToast]);

  if (showLiveToast) {
    return (
      <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-emerald-400 flex-1">
          Live data now available — switching to live mode.
        </p>
        <button
          onClick={dismissLiveToast}
          className="text-emerald-400/60 hover:text-emerald-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (!isPrescout || dismissed) return null;

  return (
    <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      <p className="text-sm text-blue-400 flex-1">
        <span className="font-semibold">Prescout Mode</span> — This event hasn&apos;t started yet. Rankings are based on season performance.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-blue-400/60 hover:text-blue-400 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
