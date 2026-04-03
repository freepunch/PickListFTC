"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface TutorialStep {
  targetSelector: string;
  title: string;
  text: string;
  position: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: TutorialStep[];
  onComplete: () => void;
}

const PAD = 8;
const TOOLTIP_W = 272;
const TOOLTIP_OFFSET = 14;

export function Tutorial({ steps, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const step = steps[stepIndex];

  const updateRect = useCallback(() => {
    const el = document.querySelector(step.targetSelector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect, mounted]);

  const handleNext = () => {
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
        top: spotY + spotH + TOOLTIP_OFFSET,
        left: Math.max(8, Math.min(spotX + spotW / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8)),
        width: TOOLTIP_W,
      };
      break;
    case "top":
      tooltipStyle = {
        bottom: vh - spotY + TOOLTIP_OFFSET,
        left: Math.max(8, Math.min(spotX + spotW / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8)),
        width: TOOLTIP_W,
      };
      break;
    case "right":
      tooltipStyle = {
        top: Math.max(8, Math.min(spotY + spotH / 2 - 80, vh - 220)),
        left: Math.min(spotX + spotW + TOOLTIP_OFFSET, vw - TOOLTIP_W - 8),
        width: TOOLTIP_W,
      };
      break;
    case "left":
      tooltipStyle = {
        top: Math.max(8, Math.min(spotY + spotH / 2 - 80, vh - 220)),
        right: vw - spotX + TOOLTIP_OFFSET,
        width: TOOLTIP_W,
      };
      break;
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* Overlay cutout */}
      {/* Top */}
      <div
        className="fixed bg-black/75"
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, spotY) }}
      />
      {/* Bottom */}
      <div
        className="fixed bg-black/75"
        style={{ top: Math.max(0, spotY + spotH), left: 0, right: 0, bottom: 0 }}
      />
      {/* Left */}
      <div
        className="fixed bg-black/75"
        style={{ top: spotY, left: 0, width: Math.max(0, spotX), height: spotH }}
      />
      {/* Right */}
      <div
        className="fixed bg-black/75"
        style={{ top: spotY, left: spotX + spotW, right: 0, height: spotH }}
      />

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
            Skip tour
          </button>
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">{step.text}</p>
        <button
          onClick={handleNext}
          className="w-full py-2 text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
        >
          {stepIndex < steps.length - 1 ? "Next →" : "Get Started"}
        </button>
      </div>
    </div>,
    document.body
  );
}
