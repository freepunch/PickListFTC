"use client";

import { useEffect, useState } from "react";
import { useEvent } from "@/context/EventContext";

interface ToastDetail {
  code: string;
  name: string;
}

export function EventLoadingToast() {
  const [pending, setPending] = useState<ToastDetail | null>(null);
  const { event, loading } = useEvent();

  useEffect(() => {
    function handleEventLoading(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (detail?.code) setPending(detail);
    }
    window.addEventListener("plftc:eventLoading", handleEventLoading);
    return () => window.removeEventListener("plftc:eventLoading", handleEventLoading);
  }, []);

  // Clear when the requested event has loaded (or after a generous timeout)
  useEffect(() => {
    if (!pending) return;
    if (event?.code === pending.code && !loading) {
      const t = setTimeout(() => setPending(null), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPending(null), 8000);
    return () => clearTimeout(t);
  }, [pending, event, loading]);

  if (!pending) return null;

  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] pointer-events-none animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 shadow-2xl text-sm text-zinc-200 max-w-[calc(100vw-2rem)]">
        <svg className="w-4 h-4 animate-spin text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="truncate">Loading {pending.name}…</span>
      </div>
    </div>
  );
}
