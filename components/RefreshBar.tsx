"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thin, non-blocking progress bar pinned to the top of the content area,
 * NProgress-style: quick start, slow creep toward 90%, snap to 100% on finish.
 * Show it whenever a background API call is in flight (`active`).
 */
export function RefreshBar({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const creepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null; }
    };

    if (active) {
      clearTimers();
      setVisible(true);
      setProgress(8);
      // Slow creep that decelerates as it approaches 90%.
      creepRef.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(0.5, (90 - p) * 0.08)));
      }, 200);
    } else if (visible) {
      // Finish: snap to 100, then fade out and reset.
      clearTimers();
      setProgress(100);
      hideRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[90] h-0.5 pointer-events-none"
      role="progressbar"
      aria-hidden="true"
    >
      <div
        className="h-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
