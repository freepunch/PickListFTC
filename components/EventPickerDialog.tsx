"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchEvents } from "@/lib/api";
import { EventSearchResult } from "@/lib/types";

interface Props {
  onSelect: (result: EventSearchResult) => void;
  onClose: () => void;
}

function getStatus(start: string, end?: string): "live" | "upcoming" | "completed" {
  const now = new Date();
  const s = new Date(start);
  const e = end ? new Date(end) : new Date(start);
  e.setHours(23, 59, 59, 999);
  if (now < s) return "upcoming";
  if (now > e) return "completed";
  return "live";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventPickerDialog({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchEvents(q);
      setResults(res);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, doSearch]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <svg
            className="w-4 h-4 text-zinc-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="6" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events by name or code…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          {loading && (
            <svg className="w-4 h-4 animate-spin text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {query.trim().length < 2 && (
            <p className="px-4 py-6 text-xs text-zinc-600 text-center">
              Type at least 2 characters to search
            </p>
          )}
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">No events found.</p>
          )}
          {results.map((r) => {
            const loc = [r.location?.city, r.location?.state].filter(Boolean).join(", ");
            const status = getStatus(r.start, r.end);
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => {
                  onSelect(r);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors flex items-start gap-3 border-b border-zinc-800/50 last:border-0"
              >
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    status === "live"
                      ? "bg-green-500"
                      : status === "upcoming"
                      ? "bg-yellow-400"
                      : "bg-zinc-600"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-white font-medium truncate">{r.name}</span>
                    <span className="font-mono text-[11px] text-zinc-500 shrink-0">{r.code}</span>
                  </div>
                  <div className="flex gap-2 mt-0.5 text-xs text-zinc-500">
                    <span>{formatDate(r.start)}</span>
                    {loc && <span>{loc}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
