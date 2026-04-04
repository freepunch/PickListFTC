"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
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
  loading?: boolean;
  onComplete: () => void;
}

const SPOT_PAD = 8;    // padding around the highlighted element
const TIP_OFFSET = 14; // gap between spotlight edge and tooltip
const MARGIN = 16;     // minimum distance from viewport edge

// ── Positioning ──────────────────────────────────────────────────────────────

function computeTooltipPos(
  preferred: TutorialStep["position"],
  spotX: number, spotY: number, spotW: number, spotH: number,
  tipW: number, tipH: number,
  vw: number, vh: number,
): { left: number; top: number } {
  // Flip if the preferred side doesn't have room (more than 50% would be hidden)
  let pos = preferred;
  if (pos === "right" && spotX + spotW + TIP_OFFSET + tipW > vw - MARGIN) pos = "left";
  if (pos === "left"  && spotX - TIP_OFFSET - tipW < MARGIN)              pos = "right";
  if (pos === "bottom" && spotY + spotH + TIP_OFFSET + tipH > vh - MARGIN) pos = "top";
  if (pos === "top"   && spotY - TIP_OFFSET - tipH < MARGIN)              pos = "bottom";

  let left = 0, top = 0;
  switch (pos) {
    case "bottom":
      left = spotX + spotW / 2 - tipW / 2;
      top  = spotY + spotH + TIP_OFFSET;
      break;
    case "top":
      left = spotX + spotW / 2 - tipW / 2;
      top  = spotY - TIP_OFFSET - tipH;
      break;
    case "right":
      left = spotX + spotW + TIP_OFFSET;
      top  = spotY + spotH / 2 - tipH / 2;
      break;
    case "left":
      left = spotX - TIP_OFFSET - tipW;
      top  = spotY + spotH / 2 - tipH / 2;
      break;
  }

  // Clamp to viewport with MARGIN padding on all sides
  left = Math.max(MARGIN, Math.min(left, vw - tipW - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  vh - tipH - MARGIN));
  return { left, top };
}

// ── Component ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 100;
const POLL_TIMEOUT  = 3000;

export function Tutorial({ steps, loading = false, onComplete }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [stepIndex,  setStepIndex]  = useState(0);
  const [spotRect,   setSpotRect]   = useState<DOMRect | null>(null);
  const [mounted,    setMounted]    = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Two-pass positioning: null = measuring (tooltip hidden), set = show at position
  const [tooltipPos, setTooltipPos]     = useState<{ left: number; top: number } | null>(null);
  const tooltipPosRef = useRef<{ left: number; top: number } | null>(null);
  const tooltipRef    = useRef<HTMLDivElement>(null);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(0);

  const step = steps[stepIndex];

  // Helper: sync both ref and state for tooltipPos
  const updateTooltipPos = useCallback((pos: { left: number; top: number } | null) => {
    tooltipPosRef.current = pos;
    setTooltipPos(pos);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // ── Element polling ──────────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPoll = useCallback((selector: string) => {
    stopPoll();
    setSpotRect(null);
    updateTooltipPos(null);
    pollStartRef.current = Date.now();

    pollRef.current = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        setSpotRect(el.getBoundingClientRect());
        setNavigating(false);
        stopPoll();
        return;
      }
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT) {
        setSpotRect(null);
        setNavigating(false);
        stopPoll();
      }
    }, POLL_INTERVAL);
  }, [stopPoll, updateTooltipPos]);

  // ── Step change: navigate then poll ──────────────────────────────────────

  useEffect(() => {
    if (!mounted || loading) return;
    updateTooltipPos(null);

    const target = step.route;
    if (target && pathname !== target) {
      setNavigating(true);
      router.push(target);
    } else {
      startPoll(step.targetSelector);
    }
    return () => stopPoll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, mounted, loading]);

  // ── After navigation: start polling ──────────────────────────────────────

  useEffect(() => {
    if (!mounted || loading || !navigating) return;
    if (step.route && pathname === step.route) {
      startPoll(step.targetSelector);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navigating]);

  // ── Reset position when spotlight changes ────────────────────────────────

  useEffect(() => {
    updateTooltipPos(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, spotRect]);

  // ── Two-pass positioning: measure tooltip then place it ──────────────────

  useLayoutEffect(() => {
    if (loading || navigating) return;
    if (tooltipPosRef.current !== null) return; // already positioned for this state
    const el = tooltipRef.current;
    if (!el) return;

    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    if (tipW === 0 || tipH === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!spotRect) {
      // No spotlight — center the tooltip
      const left = Math.max(MARGIN, Math.min(vw / 2 - tipW / 2, vw - tipW - MARGIN));
      const top  = Math.max(MARGIN, Math.min(vh / 2 - tipH / 2, vh - tipH - MARGIN));
      updateTooltipPos({ left, top });
      return;
    }

    const spotX = spotRect.left - SPOT_PAD;
    const spotY = spotRect.top  - SPOT_PAD;
    const spotW = spotRect.width  + SPOT_PAD * 2;
    const spotH = spotRect.height + SPOT_PAD * 2;

    updateTooltipPos(
      computeTooltipPos(step.position, spotX, spotY, spotW, spotH, tipW, tipH, vw, vh)
    );
  }); // intentionally no deps — runs after every render, but bails immediately if already positioned

  // ── Update spotlight rect on resize/scroll ───────────────────────────────

  const refreshSpotRect = useCallback(() => {
    const el = document.querySelector(step.targetSelector);
    if (el) setSpotRect(el.getBoundingClientRect());
  }, [step.targetSelector]);

  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("resize", refreshSpotRect);
    window.addEventListener("scroll", refreshSpotRect, true);
    return () => {
      window.removeEventListener("resize", refreshSpotRect);
      window.removeEventListener("scroll", refreshSpotRect, true);
    };
  }, [refreshSpotRect, mounted]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  // ── Render ────────────────────────────────────────────────────────────────

  const goNext = () => {
    if (stepIndex < steps.length - 1) { setStepIndex(stepIndex + 1); }
    else { onComplete(); }
  };

  if (!mounted) return null;

  // Loading card
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

  // Navigating overlay
  if (navigating) {
    return createPortal(<div className="fixed inset-0 z-[200] bg-black/60" />, document.body);
  }

  // Spotlight geometry
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spotX = spotRect ? spotRect.left  - SPOT_PAD : vw / 2 - 100;
  const spotY = spotRect ? spotRect.top   - SPOT_PAD : vh / 2 - 50;
  const spotW = spotRect ? spotRect.width  + SPOT_PAD * 2 : 200;
  const spotH = spotRect ? spotRect.height + SPOT_PAD * 2 : 100;

  // Tooltip style — invisible during measurement pass (tooltipPos is null)
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    maxWidth: `min(400px, calc(100vw - ${MARGIN * 2}px))`,
    ...(tooltipPos
      ? { left: tooltipPos.left, top: tooltipPos.top, opacity: 1 }
      : { left: -9999, top: -9999, opacity: 0 }),
  };

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Spotlight cutout — 4 overlay rects */}
      <div className="fixed bg-black/75" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotY) }} />
      <div className="fixed bg-black/75" style={{ top: Math.max(0, spotY + spotH), left: 0, right: 0, bottom: 0 }} />
      <div className="fixed bg-black/75" style={{ top: spotY, left: 0, width: Math.max(0, spotX), height: spotH }} />
      <div className="fixed bg-black/75" style={{ top: spotY, left: spotX + spotW, right: 0, height: spotH }} />

      {/* Highlight ring */}
      {spotRect && (
        <div
          className="fixed rounded-lg border-2 border-[var(--accent)] pointer-events-none"
          style={{ top: spotY, left: spotX, width: spotW, height: spotH }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 z-[201]"
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
