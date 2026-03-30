"use client";

import { useState, useEffect, useRef, useCallback, FormEvent, useMemo } from "react";
import { useEvent } from "@/context/EventContext";
import { searchEvents } from "@/lib/api";
import { EventSearchResult } from "@/lib/types";
import { ShareButton } from "@/components/SharePopover";

// Expose the input ref for global keyboard shortcut
let globalFocusInput: (() => void) | null = null;
export function focusEventInput() {
  globalFocusInput?.();
}

interface RecentEvent {
  code: string;
  name: string;
  timestamp: number;
}

const STORAGE_KEY = "picklistftc_recent_events";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;

function getRecentEvents(): RecentEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentEvent(entry: Omit<RecentEvent, "timestamp">) {
  try {
    const existing = getRecentEvents().filter(
      (e) => e.code !== entry.code
    );
    const updated = [{ ...entry, timestamp: Date.now() }, ...existing].slice(
      0,
      MAX_RECENT
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* quota exceeded or private mode */ }
}

function isEventCode(text: string): boolean {
  const trimmed = text.trim();
  return /^[A-Z0-9]+$/.test(trimmed) && !trimmed.includes(" ");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EventLoader({ bare = false }: { bare?: boolean } = {}) {
  const { loadEvent, loading, error, event, eventCode, setEventCode } =
    useEvent();
  const [showDropdown, setShowDropdown] = useState(false);
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [searchResults, setSearchResults] = useState<EventSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [mode, setMode] = useState<"recent" | "search">("recent");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register global focus function
  useEffect(() => {
    globalFocusInput = () => inputRef.current?.focus();
    return () => { globalFocusInput = null; };
  }, []);

  // Auto-load event from ?event= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("event");
    if (code && !event) {
      setEventCode(code.toUpperCase());
      loadEvent(code.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load recent events on mount & after loading
  useEffect(() => {
    setRecent(getRecentEvents());
  }, []);

  useEffect(() => {
    if (event) {
      saveRecentEvent({ code: eventCode, name: event.name });
      setRecent(getRecentEvents());
    }
  }, [event, eventCode]);

  // Click-outside to close dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  const triggerSearch = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const trimmed = text.trim();
      if (!trimmed || isEventCode(trimmed)) {
        setSearchResults([]);
        setMode("recent");
        return;
      }

      setMode("search");
      setSearching(true);

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await searchEvents(trimmed);
          setSearchResults(results);
          setHighlightIdx(-1);
          setShowDropdown(true);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      }, DEBOUNCE_MS);
    },
    []
  );

  const handleInputChange = (value: string) => {
    setEventCode(value);
    triggerSearch(value);
  };

  const handleFocus = () => {
    const trimmed = eventCode.trim();
    if (!trimmed && recent.length > 0) {
      setMode("recent");
      setShowDropdown(true);
    } else if (trimmed && !isEventCode(trimmed) && searchResults.length > 0) {
      setShowDropdown(true);
    }
  };

  const selectEvent = (code: string) => {
    setEventCode(code);
    setShowDropdown(false);
    setHighlightIdx(-1);
    loadEvent(code);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = eventCode.trim();
    if (!trimmed) return;

    if (isEventCode(trimmed)) {
      setShowDropdown(false);
      loadEvent(trimmed);
    } else if (searchResults.length > 0) {
      const idx = highlightIdx >= 0 ? highlightIdx : 0;
      selectEvent(searchResults[idx].code);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    const items =
      mode === "search" ? searchResults : recent;
    const count = items.length;
    if (count === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev <= 0 ? count - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      if (mode === "search") {
        selectEvent(searchResults[highlightIdx].code);
      } else {
        const entry = recent[highlightIdx];
        selectEvent(entry.code);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightIdx(-1);
    }
  };

  const dropdownItems = mode === "search" ? searchResults : [];
  const showRecentDropdown = mode === "recent" && showDropdown && recent.length > 0;
  const showSearchDropdown = mode === "search" && showDropdown && (searching || searchResults.length > 0);

  return (
    <div className={bare ? "" : "bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4"}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0" ref={containerRef}>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Event Code or Name
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={eventCode}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder="e.g. USTXCMP or Texas"
              maxLength={100}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
                placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]
                focus:ring-1 focus:ring-[var(--accent)]/30 w-full sm:w-64 font-mono transition-colors"
            />
            {searching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 animate-spin text-zinc-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            {!searching && recent.length > 0 && !eventCode.trim() && (
              <button
                type="button"
                onClick={() => {
                  setMode("recent");
                  setShowDropdown(!showDropdown);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
          </div>

          {/* Recent events dropdown */}
          {showRecentDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 w-full sm:w-80 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
              <p className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-700">
                Recent Events
              </p>
              {recent.map((entry, idx) => (
                <button
                  key={entry.code}
                  type="button"
                  onClick={() => selectEvent(entry.code)}
                  className={`w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between group ${
                    highlightIdx === idx ? "bg-zinc-700/70" : "hover:bg-zinc-700/50"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-white">{entry.code}</span>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{entry.name}</p>
                  </div>
                  <svg
                    className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 ml-2 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Search results dropdown */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 w-full sm:w-96 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              {searching && searchResults.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <svg className="w-5 h-5 animate-spin text-zinc-500 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-xs text-zinc-500">Searching events...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-zinc-500">No events found</p>
                </div>
              ) : (
                <>
                  <p className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-700">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                  </p>
                  {searchResults.map((result, idx) => (
                    <button
                      key={result.code}
                      type="button"
                      onClick={() => selectEvent(result.code)}
                      className={`w-full text-left px-3 py-2.5 transition-colors group ${
                        highlightIdx === idx ? "bg-zinc-700/70" : "hover:bg-zinc-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{result.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-[var(--accent)]">{result.code}</span>
                            <span className="text-xs text-zinc-500">{formatDate(result.start)}</span>
                          </div>
                          {result.location && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">
                              {[result.location.city, result.location.state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>
                        {result.type && (
                          <span className="text-[10px] font-medium text-zinc-500 bg-zinc-900 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                            {result.type}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !eventCode.trim()}
          className="px-5 py-2 min-h-[42px] shrink-0 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40
            disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all
            duration-150 active:scale-[0.97] self-end"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading
            </span>
          ) : (
            "Load Event"
          )}
        </button>

        <ShareButton />

        {error && (
          <div className="flex items-center gap-2 text-sm text-[var(--danger)] self-center ml-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="truncate max-w-xs">{error}</span>
            <button
              type="button"
              onClick={() => {
                const trimmed = eventCode.trim();
                if (trimmed) loadEvent(trimmed);
              }}
              className="text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 border border-zinc-700
                rounded-md px-2 py-1 transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
