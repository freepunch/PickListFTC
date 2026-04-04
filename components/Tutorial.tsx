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

const SPOT_PAD = 8;
const TIP_OFFSET = 14;
const MARGIN = 16;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if the element has non-zero layout (not display:none or hidden via breakpoint). */
function isLayoutVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Wait for ANY element matching `selector` that is also layout-visible.
 * Uses MutationObserver so it fires as soon as the element appears in the DOM,
 * rather than burning CPU with setInterval.
 * Uses querySelectorAll so it finds the first *visible* match even when there
 * are mobile/desktop duplicates with the same attribute.
 */
function waitForVisible(selector: string, timeout = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const check = (): Element | null => {
      const els = document.querySelectorAll(selector);
      for (const el of Array.from(els)) {
        if (isLayoutVisible(el)) return el;
      }
      return null;
    };

    const immediate = check();
    if (immediate) { resolve(immediate); return; }

    const observer = new MutationObserver(() => {
      const el = check();
      if (el) { observer.disconnect(); clearTimeout(timer); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(check()); // one last attempt before giving up
    }, timeout);
  });
}

// ── Positioning ───────────────────────────────────────────────────────────────

function computeTooltipPos(
  preferred: TutorialStep["position"],
  spotX: number, spotY: number, spotW: number, spotH: number,
  tipW: number, tipH: number,
  vw: number, vh: number,
): { left: number; top: number } {
  // Flip to opposite side if preferred side doesn't have enough room
  let pos = preferred;
  if (pos === "right"  && spotX + spotW + TIP_OFFSET + tipW > vw - MARGIN) pos = "left";
  if (pos === "left"   && spotX - TIP_OFFSET - tipW < MARGIN)              pos = "right";
  if (pos === "bottom" && spotY + spotH + TIP_OFFSET + tipH > vh - MARGIN) pos = "top";
  if (pos === "top"    && spotY - TIP_OFFSET - tipH < MARGIN)              pos = "bottom";

  let left = 0, top = 0;
  switch (pos) {
    case "bottom": left = spotX + spotW / 2 - tipW / 2; top = spotY + spotH + TIP_OFFSET; break;
    case "top":    left = spotX + spotW / 2 - tipW / 2; top = spotY - TIP_OFFSET - tipH;  break;
    case "right":  left = spotX + spotW + TIP_OFFSET;    top = spotY + spotH / 2 - tipH / 2; break;
    case "left":   left = spotX - TIP_OFFSET - tipW;     top = spotY + spotH / 2 - tipH / 2; break;
  }

  // Clamp — tooltip must stay at least MARGIN px from every edge
  left = Math.max(MARGIN, Math.min(left, vw - tipW - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  vh - tipH - MARGIN));
  return { left, top };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Tutorial({ steps, loading = false, onComplete }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [stepIndex,  setStepIndex]  = useState(0);
  const [spotRect,   setSpotRect]   = useState<DOMRect | null>(null);
  const [mounted,    setMounted]    = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Two-pass positioning: null = measuring pass (tooltip off-screen), object = final position
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const tooltipPosRef = useRef<{ left: number; top: number } | null>(null);
  const tooltipRef    = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];

  const updateTooltipPos = useCallback((pos: { left: number; top: number } | null) => {
    tooltipPosRef.current = pos;
    setTooltipPos(pos);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // ── Escape key ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mounted) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onComplete(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [mounted, onComplete]);

  // ── Step activation ───────────────────────────────────────────────────────────
  //
  // Runs whenever stepIndex, pathname, mounted, or loading changes.
  // - If the step's route differs from the current pathname: push to it and return.
  //   The effect re-runs automatically when pathname changes (navigation complete).
  // - Once on the correct route: wait for the target element via MutationObserver,
  //   scroll it into view, then set its DOMRect to trigger the spotlight.

  useEffect(() => {
    if (!mounted || loading) return;

    updateTooltipPos(null);
    setSpotRect(null);

    const target = step.route;
    if (target && pathname !== target) {
      console.log(`[Tutorial] step ${stepIndex + 1}: navigating ${pathname} → ${target}`);
      setNavigating(true);
      router.push(target);
      return; // re-runs when pathname changes to target
    }

    setNavigating(false);

    let cancelled = false;

    (async () => {
      console.log(`[Tutorial] step ${stepIndex + 1}: waiting for "${step.targetSelector}"`);

      const el = await waitForVisible(step.targetSelector);
      if (cancelled) return;

      if (!el) {
        console.warn(`[Tutorial] step ${stepIndex + 1}: "${step.targetSelector}" not found — centering tooltip`);
        setSpotRect(null);
        return;
      }

      console.log(`[Tutorial] step ${stepIndex + 1}: found <${el.tagName.toLowerCase()}> class="${el.className.toString().slice(0, 80)}"`);

      // Scroll into view so the element is on screen before we measure it
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      await new Promise(r => setTimeout(r, 300));
      if (cancelled) return;

      setSpotRect(el.getBoundingClientRect());
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, mounted, loading, pathname]);

  // ── Reset tooltip position when step or spotlight changes ─────────────────

  useEffect(() => {
    updateTooltipPos(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, spotRect]);

  // ── Two-pass positioning (runs after every render, bails if already placed) ──

  useLayoutEffect(() => {
    if (loading || navigating) return;
    if (tooltipPosRef.current !== null) return; // already positioned
    const el = tooltipRef.current;
    if (!el) return;
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    if (tipW === 0 || tipH === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!spotRect) {
      // No spotlight — center the tooltip
      updateTooltipPos({
        left: Math.max(MARGIN, Math.min(vw / 2 - tipW / 2, vw - tipW - MARGIN)),
        top:  Math.max(MARGIN, Math.min(vh / 2 - tipH / 2, vh - tipH - MARGIN)),
      });
      return;
    }

    const spotX = spotRect.left  - SPOT_PAD;
    const spotY = spotRect.top   - SPOT_PAD;
    const spotW = spotRect.width  + SPOT_PAD * 2;
    const spotH = spotRect.height + SPOT_PAD * 2;
    updateTooltipPos(computeTooltipPos(step.position, spotX, spotY, spotW, spotH, tipW, tipH, vw, vh));
  }); // no deps — intentional; bails via ref check after first placement

  // ── Refresh spotlight on resize / scroll ──────────────────────────────────

  const refreshSpotRect = useCallback(() => {
    const els = document.querySelectorAll(step.targetSelector);
    for (const el of Array.from(els)) {
      if (isLayoutVisible(el)) {
        setSpotRect(el.getBoundingClientRect());
        return;
      }
    }
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

  // ── Navigation ────────────────────────────────────────────────────────────

  const goNext = () => {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
    else onComplete();
  };

  if (!mounted) return null;

  // ── Loading card (demo event fetching) ───────────────────────────────────

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-[200] bg-black/75 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3 w-64">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-sm text-zinc-300 font-medium">Loading demo event…</p>
          <p className="text-xs text-zinc-500 text-center">
            Pulling live FTC data so you can see the app with real teams.
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // ── Navigating overlay (route transition in progress) ────────────────────

  if (navigating) {
    return createPortal(
      <div className="fixed inset-0 z-[200] bg-black/60" />,
      document.body
    );
  }

  // ── Spotlight geometry ────────────────────────────────────────────────────

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spotX = spotRect ? spotRect.left  - SPOT_PAD : vw / 2 - 100;
  const spotY = spotRect ? spotRect.top   - SPOT_PAD : vh / 2 - 50;
  const spotW = spotRect ? spotRect.width  + SPOT_PAD * 2 : 200;
  const spotH = spotRect ? spotRect.height + SPOT_PAD * 2 : 100;

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    maxWidth: `min(400px, calc(100vw - ${MARGIN * 2}px))`,
    ...(tooltipPos
      ? { left: tooltipPos.left, top: tooltipPos.top, opacity: 1 }
      : { left: -9999, top: -9999, opacity: 0 }), // hidden during measurement pass
  };

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Spotlight cutout — 4 overlay rects that leave a transparent window */}
      <div className="fixed bg-black/75" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotY) }} />
      <div className="fixed bg-black/75" style={{ top: Math.max(0, spotY + spotH), left: 0, right: 0, bottom: 0 }} />
      <div className="fixed bg-black/75" style={{ top: spotY, left: 0, width: Math.max(0, spotX), height: spotH }} />
      <div className="fixed bg-black/75" style={{ top: spotY, left: spotX + spotW, right: 0, height: spotH }} />

      {/* Accent ring around highlighted element */}
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

        <p className="text-[10px] text-zinc-600 mt-2.5 text-right">Esc to exit</p>
      </div>
    </div>,
    document.body
  );
}
