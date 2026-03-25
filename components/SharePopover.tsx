"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEvent } from "@/context/EventContext";
import { createPortal } from "react-dom";

export function ShareButton() {
  const { eventCode, event, selectedTeams } = useEvent();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const buildShareUrl = useCallback(() => {
    if (typeof window === "undefined" || !eventCode) return "";
    const url = new URL(window.location.origin + pathname);
    url.searchParams.set("event", eventCode);
    if (pathname.includes("/compare") && selectedTeams.length > 0) {
      url.searchParams.set("teams", selectedTeams.join(","));
    }
    if (pathname.includes("/partners")) {
      const cur = new URLSearchParams(window.location.search);
      const team = cur.get("team");
      if (team) url.searchParams.set("team", team);
    }
    return url.toString();
  }, [pathname, eventCode, selectedTeams]);

  const openPopover = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 304),
    });
    setOpen(true);
    setCopied(false);
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  const url = open ? buildShareUrl() : "";

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API not available
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!event) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPopover}
        title="Share this view"
        className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors self-end"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[9999] w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">Share this view</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center mb-3 bg-zinc-950 rounded-lg p-3">
              <QRCodeSVG
                value={url || " "}
                size={180}
                bgColor="#09090b"
                fgColor="#3b82f6"
                level="M"
              />
            </div>

            <p className="text-[11px] text-zinc-400 font-mono break-all mb-3 bg-zinc-800 rounded-lg px-2.5 py-2 select-all leading-relaxed">
              {url}
            </p>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg transition-colors"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
