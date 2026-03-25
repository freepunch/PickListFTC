"use client";

import { ReactNode, useEffect } from "react";
import { useEvent } from "@/context/EventContext";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { highContrast, event, loadEvent, setEventCode } = useEvent();

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
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
