"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";

export interface TutorialStep {
  route?: string;
  targetSelector: string;
  title: string;
  text: string;
  position: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: TutorialStep[];
  loading?: boolean; // true while demo event is loading
  onComplete: () => void;
}

const PAD = 8;
const TOOLTIP_W = 280;
const TOOLTIP_OFFSET = 14;
const POLL_INTERVAL = 100;
const POLL_TIMEOUT = 3000;

export function Tutorial({ steps, loading = false, onComplete }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const step = steps[stepIndex];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Stop polling helper
  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll for target element then set rect
  const startPoll = useCallback((selector: string) => {
    stopPoll();
    setRect(null);
    pollStartRef.current = Date.now();

    pollRef.current = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        setRect(el.getBoundingClientRect());
        setNavigating(false);
        stopPoll();
        return;
      }
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT) {
        // Timed out — show tooltip without spotlight
        setRect(null);
        setNavigating(false);
        stopPoll();
      }
    }, POLL_INTERVAL);
  }, [stopPoll]);

  // On step change: navigate if needed, then poll for element
  useEffect(() => {
    if (!mounted || loading) return;

    const target = step.route;
    if (target && pathname !== target) {
      setNavigating(true);
      router.push(target);
      // Polling will start after pathname changes
    } else {
      startPoll(step.targetSelector);
    }

    return () => stopPoll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, mounted, loading]);

  // After navigation completes (pathname matches), start polling
  useEffect(() => {
    if (!mounted || loading || !navigating) return;
    if (step.route && pathname === step.route) {
      startPoll(step.targetSelector);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navigating]);

  // Update rect on resize/scroll
  const updateRect = useCallback(() => {
    const el = document.querySelector(step.targetSelector);
    if (el) setRect(el.getBoundingClientRect());
  }, [step.targetSelector]);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect, mounted]);

  // Cleanup on unmount
  useEffect(() => () => stopPoll(), [stopPoll]);

  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete();
    }
  };

  if (!mounted) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spotX = rect ? rect.left - PAD : vw / 2 - 120;
  const spotY = rect ? rect.top - PAD : vh / 2 - 60;
  const spotW = rect ? rect.width + PAD * 2 : 240;
  const spotH = rect ? rect.height + PAD * 2 : 120;

  let tooltipStyle: React.CSSProperties = {};
  switch (step.position) {
    case "bottom":
      tooltipStyle = {
        top: rect ? spotY + spotH + TOOLTIP_OFFSET : vh / 2 + 40,
        left: Math.max(8, Math.min(spotX + spotW / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8)),
        width: TOOLTIP_W,
      };
      break;
    case "top":
      tooltipStyle = {
        bottom: rect ? vh - spotY + TOOLTIP_OFFSET : vh / 2 + 40,
        left: Math.max(8, Math.min(spotX + spotW / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8)),
        width: TOOLTIP_W,
      };
      break;
    case "right":
      tooltipStyle = {
        top: Math.max(8, Math.min(spotY + spotH / 2 - 80, vh - 220)),
        left: rect ? Math.min(spotX + spotW + TOOLTIP_OFFSET, vw - TOOLTIP_W - 8) : vw / 2 - TOOLTIP_W / 2,
        width: TOOLTIP_W,
      };
      break;
    case "left":
      tooltipStyle = {
        top: Math.max(8, Math.min(spotY + spotH / 2 - 80, vh - 220)),
        right: rect ? vw - spotX + TOOLTIP_OFFSET : vw / 2 - TOOLTIP_W / 2,
        width: TOOLTIP_W,
      };
      break;
  }

  // Loading card — shown while demo event is fetching
  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-[200] bg-black/75 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3 w-64">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-sm text-zinc-300 font-medium">Loading demo event…</p>
          <p className="text-xs text-zinc-500 text-center">Pulling live FTC data so you can see the app with real teams.</p>
        </div>
      </div>,
      document.body
    );
  }

  // Navigating overlay — brief dim while route changes
  if (navigating) {
    return createPortal(
      <div className="fixed inset-0 z-[200] bg-black/60" />,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Spotlight cutout */}
      <div className="fixed bg-black/75" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotY) }} />
      <div className="fixed bg-black/75" style={{ top: Math.max(0, spotY + spotH), left: 0, right: 0, bottom: 0 }} />
      <div className="fixed bg-black/75" style={{ top: spotY, left: 0, width: Math.max(0, spotX), height: spotH }} />
      <div className="fixed bg-black/75" style={{ top: spotY, left: spotX + spotW, right: 0, height: spotH }} />

      {/* Highlight ring */}
      {rect && (
        <div
          className="fixed rounded-lg border-2 border-[var(--accent)] pointer-events-none"
          style={{ top: spotY, left: spotX, width: spotW, height: spotH }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 z-[201]"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium text-[var(--accent)]">
            {stepIndex + 1} / {steps.length}
          </span>
          <button
            onClick={onComplete}
            className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs"
          >
            Skip
          </button>
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">{step.text}</p>
        <button
          onClick={goNext}
          className="w-full py-2 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
        >
          {stepIndex < steps.length - 1 ? "Next →" : "Get Started"}
        </button>
      </div>
    </div>,
    document.body
  );
}
