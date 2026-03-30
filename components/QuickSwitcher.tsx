"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useEvent } from "@/context/EventContext";
import { useFavorites } from "@/context/FavoritesContext";
import { searchEvents } from "@/lib/api";
import { EventSearchResult } from "@/lib/types";

const DEBOUNCE_MS = 250;

export function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { loadEvent, setEventCode } = useEvent();
  const { favoriteEvents } = useFavorites();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchEvents(trimmed);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Filtered watched events
  const filteredWatched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return favoriteEvents;
    return favoriteEvents.filter(
      (e) =>
        e.event_code.toLowerCase().includes(q) ||
        (e.event_name?.toLowerCase().includes(q) ?? false)
    );
  }, [favoriteEvents, query]);

  // Filter search results to exclude already-shown watched events
  const watchedCodes = useMemo(
    () => new Set(favoriteEvents.map((e) => e.event_code)),
    [favoriteEvents]
  );
  const filteredResults = useMemo(
    () => results.filter((r) => !watchedCodes.has(r.code)),
    [results, watchedCodes]
  );

  // Total items for keyboard navigation
  const allItems = useMemo(() => {
    const items: { code: string; name: string; isWatched: boolean }[] = [];
    for (const e of filteredWatched) {
      items.push({ code: e.event_code, name: e.event_name ?? e.event_code, isWatched: true });
    }
    for (const r of filteredResults) {
      items.push({ code: r.code, name: r.name, isWatched: false });
    }
    return items;
  }, [filteredWatched, filteredResults]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIdx(0);
  }, [allItems.length]);

  const selectItem = useCallback(
    (code: string) => {
      setEventCode(code);
      loadEvent(code);
      setOpen(false);
    },
    [loadEvent, setEventCode]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems.length > 0) {
      e.preventDefault();
      selectItem(allItems[selectedIdx]?.code ?? allItems[0].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search events..."
            maxLength={100}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="text-[10px] text-zinc-600 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {/* Watched events */}
          {filteredWatched.length > 0 && (
            <>
              <p className="px-4 py-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                My Events
              </p>
              {filteredWatched.map((ev, i) => {
                const idx = i;
                return (
                  <button
                    key={ev.event_code}
                    data-idx={idx}
                    onClick={() => selectItem(ev.event_code)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      selectedIdx === idx ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">
                        {ev.event_name ?? ev.event_code}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono">{ev.event_code}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Search results */}
          {filteredResults.length > 0 && (
            <>
              <p className="px-4 py-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider border-t border-zinc-800">
                Search Results
              </p>
              {filteredResults.map((r, i) => {
                const idx = filteredWatched.length + i;
                return (
                  <button
                    key={r.code}
                    data-idx={idx}
                    onClick={() => selectItem(r.code)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      selectedIdx === idx ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{r.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--accent)] font-mono">{r.code}</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(r.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Empty states */}
          {query.trim() && !searching && filteredWatched.length === 0 && filteredResults.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">No events found</p>
            </div>
          )}

          {searching && filteredWatched.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-zinc-500">Searching...</p>
            </div>
          )}

          {!query.trim() && filteredWatched.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">Type to search events</p>
              <p className="text-xs text-zinc-600 mt-1">Star events to see them here</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-3 text-[10px] text-zinc-600">
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 font-mono">↵</kbd> select</span>
          <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
