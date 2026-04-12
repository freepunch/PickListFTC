"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  FormEvent,
  useMemo,
} from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { searchEvents } from "@/lib/api";
import { EventSearchResult } from "@/lib/types";
import { ShareButton } from "@/components/SharePopover";
import { recentEventsKey } from "@/lib/storage";

// ── Global focus ───────────────────────────────────────────────────────────────
let globalFocusInput: (() => void) | null = null;
export function focusEventInput() {
  globalFocusInput?.();
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface RecentEvent {
  code: string;
  name: string;
  timestamp: number;
}

type ChipId =
  | "region"
  | "this-week"
  | "upcoming"
  | "qualifiers"
  | "championships";

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;
const CHIP_CACHE_TTL = 5 * 60 * 1000;

// ── Module-level caches (survive re-renders, cleared on page refresh) ──────────
const chipCache = new Map<ChipId, { results: EventSearchResult[]; ts: number }>();
let defaultCache: { events: EventSearchResult[]; label: string; ts: number } | null = null;

// ── Timezone → US state for "My Region" chip ───────────────────────────────────
const TZ_TO_STATE: Record<string, string> = {
  "America/New_York": "New York",
  "America/Chicago": "Illinois",
  "America/Denver": "Colorado",
  "America/Los_Angeles": "California",
  "America/Phoenix": "Arizona",
  "America/Detroit": "Michigan",
  "America/Indiana/Indianapolis": "Indiana",
  "America/Kentucky/Louisville": "Kentucky",
  "America/Boise": "Idaho",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

function getRegionState(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_TO_STATE[tz] ?? null;
  } catch {
    return null;
  }
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function getRecentEvents(userId?: string | null): RecentEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(recentEventsKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function saveRecentEvent(
  entry: Omit<RecentEvent, "timestamp">,
  userId?: string | null
) {
  try {
    const existing = getRecentEvents(userId).filter(
      (e) => e.code !== entry.code
    );
    const updated = [
      { ...entry, timestamp: Date.now() },
      ...existing,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(recentEventsKey(userId), JSON.stringify(updated));
  } catch {
    /* quota exceeded or private mode */
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function isEventCode(text: string): boolean {
  const trimmed = text.trim();
  return /^[A-Z0-9]+$/.test(trimmed) && !trimmed.includes(" ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getEventStatus(
  start: string,
  end?: string
): "live" | "upcoming" | "completed" {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(start);
  endDate.setHours(23, 59, 59, 999);
  if (now < startDate) return "upcoming";
  if (now > endDate) return "completed";
  return "live";
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-zinc-500 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function StatusDot({ status }: { status: "live" | "upcoming" | "completed" }) {
  const cls = {
    live: "bg-green-500",
    upcoming: "bg-yellow-400",
    completed: "bg-zinc-600",
  }[status];
  return (
    <span
      title={status}
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls}`}
    />
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="6" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function EventResultRow({
  result,
  highlighted,
  onClick,
}: {
  result: EventSearchResult;
  highlighted: boolean;
  onClick: () => void;
}) {
  const status = getEventStatus(result.start, result.end);
  const location = [result.location?.city, result.location?.state]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-start gap-2.5 transition-colors ${
        highlighted ? "bg-zinc-800" : "hover:bg-zinc-800/60"
      }`}
    >
      <span className="mt-[5px] shrink-0">
        <StatusDot status={status} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-white font-medium truncate leading-snug">
            {result.name}
          </span>
          <span className="font-mono text-[11px] text-zinc-500 shrink-0">
            {result.code}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-zinc-400">{formatDate(result.start)}</span>
          {location && (
            <span className="text-xs text-zinc-500">{location}</span>
          )}
          {result.type && (
            <span className="text-[10px] font-medium text-zinc-600 bg-zinc-900 rounded px-1.5 py-0.5 border border-zinc-800">
              {result.type}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function EventLoader({ bare = false }: { bare?: boolean } = {}) {
  const { loadEvent, loading, error, event, eventCode, setEventCode } =
    useEvent();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [showDropdown, setShowDropdown] = useState(false);
  const [mode, setMode] = useState<"empty" | "search">("empty");

  const [recent, setRecent] = useState<RecentEvent[]>([]);

  const [defaultEvents, setDefaultEvents] = useState<{
    events: EventSearchResult[];
    label: string;
  } | null>(null);
  const [defaultLoading, setDefaultLoading] = useState(false);

  const [activeChip, setActiveChip] = useState<ChipId | null>(null);
  const [chipResults, setChipResults] = useState<EventSearchResult[]>([]);
  const [chipLoading, setChipLoading] = useState(false);

  const [searchResults, setSearchResults] = useState<EventSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const regionState = useMemo(() => getRegionState(), []);

  const chips = useMemo(() => {
    const list: { id: ChipId; label: string }[] = [];
    if (regionState) list.push({ id: "region", label: "My Region" });
    list.push(
      { id: "this-week", label: "This Week" },
      { id: "upcoming", label: "Upcoming" },
      { id: "qualifiers", label: "Qualifiers" },
      { id: "championships", label: "Championships" }
    );
    return list;
  }, [regionState]);

  // Register global focus
  useEffect(() => {
    globalFocusInput = () => inputRef.current?.focus();
    return () => {
      globalFocusInput = null;
    };
  }, []);

  // Auto-load from ?event= URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("event");
    if (code && !event) {
      setEventCode(code.toUpperCase());
      loadEvent(code.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load recent events
  useEffect(() => {
    setRecent(getRecentEvents(userId));
  }, [userId]);

  useEffect(() => {
    if (event) {
      saveRecentEvent({ code: eventCode, name: event.name }, userId);
      setRecent(getRecentEvents(userId));
    }
  }, [event, eventCode, userId]);

  // Click-outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Fetch "Happening Now" default events ────────────────────────────────────
  const fetchDefaultEvents = useCallback(async () => {
    if (defaultCache && Date.now() - defaultCache.ts < CHIP_CACHE_TTL) {
      setDefaultEvents({ events: defaultCache.events, label: defaultCache.label });
      return;
    }
    setDefaultLoading(true);
    try {
      const all = await searchEvents("");
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const thisWeek = all
        .filter((e) => {
          const s = new Date(e.start);
          const end = e.end ? new Date(e.end) : s;
          end.setHours(23, 59, 59, 999);
          return s <= weekEnd && end >= now;
        })
        .slice(0, 5);

      let events: EventSearchResult[];
      let label: string;

      if (thisWeek.length > 0) {
        events = thisWeek;
        label = "Happening Now";
      } else {
        events = all
          .filter((e) => new Date(e.start) > now)
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 5);
        label = "Coming Up";
      }

      defaultCache = { events, label, ts: Date.now() };
      setDefaultEvents({ events, label });
    } catch {
      // Section silently absent on error
    } finally {
      setDefaultLoading(false);
    }
  }, []);

  // ── Fetch chip results ──────────────────────────────────────────────────────
  const fetchChipResults = useCallback(
    async (chip: ChipId) => {
      const cached = chipCache.get(chip);
      if (cached && Date.now() - cached.ts < CHIP_CACHE_TTL) {
        setChipResults(cached.results);
        return;
      }

      setChipLoading(true);
      setChipResults([]);

      try {
        const now = new Date();
        let results: EventSearchResult[] = [];

        switch (chip) {
          case "this-week": {
            const all = await searchEvents("");
            const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            results = all.filter((e) => {
              const s = new Date(e.start);
              const end = e.end ? new Date(e.end) : s;
              end.setHours(23, 59, 59, 999);
              return s <= weekEnd && end >= now;
            });
            break;
          }
          case "upcoming": {
            const all = await searchEvents("");
            results = all
              .filter((e) => new Date(e.start) > now)
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .slice(0, 10);
            break;
          }
          case "qualifiers":
            results = await searchEvents("qualifier");
            break;
          case "championships":
            results = await searchEvents("championship");
            break;
          case "region":
            if (regionState) results = await searchEvents(regionState);
            break;
        }

        chipCache.set(chip, { results, ts: Date.now() });
        setChipResults(results);
      } catch {
        setChipResults([]);
      } finally {
        setChipLoading(false);
      }
    },
    [regionState]
  );

  // ── Chip toggle ─────────────────────────────────────────────────────────────
  const handleChipClick = useCallback(
    (chip: ChipId) => {
      if (activeChip === chip) {
        setActiveChip(null);
        setChipResults([]);
        setHighlightIdx(-1);
      } else {
        setActiveChip(chip);
        setHighlightIdx(-1);
        fetchChipResults(chip);
      }
    },
    [activeChip, fetchChipResults]
  );

  // ── Debounced search ────────────────────────────────────────────────────────
  const triggerSearch = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (!trimmed || isEventCode(trimmed)) {
      setSearchResults([]);
      setMode("empty");
      return;
    }

    setMode("search");
    setSearching(true);
    setShowDropdown(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchEvents(trimmed);
        setSearchResults(results);
        setHighlightIdx(results.length > 0 ? 0 : -1);
      } catch {
        setSearchResults([]);
        setHighlightIdx(-1);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const handleInputChange = (value: string) => {
    setEventCode(value);
    if (!value.trim()) {
      // User cleared input — revert to empty mode
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchResults([]);
      setSearching(false);
      setMode("empty");
      // Keep dropdown open showing empty-mode content
    } else {
      triggerSearch(value);
    }
  };

  const handleFocus = () => {
    const trimmed = eventCode.trim();
    if (!trimmed) {
      setMode("empty");
      setShowDropdown(true);
      if (!defaultCache || Date.now() - defaultCache.ts >= CHIP_CACHE_TTL) {
        fetchDefaultEvents();
      } else if (!defaultEvents) {
        setDefaultEvents({ events: defaultCache.events, label: defaultCache.label });
      }
    } else if (!isEventCode(trimmed) && searchResults.length > 0) {
      setMode("search");
      setShowDropdown(true);
    }
  };

  // ── Select event ────────────────────────────────────────────────────────────
  const selectEvent = useCallback(
    (code: string) => {
      setEventCode(code);
      setShowDropdown(false);
      setHighlightIdx(-1);
      loadEvent(code);
    },
    [setEventCode, loadEvent]
  );

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = eventCode.trim();
    if (!trimmed) return;

    if (isEventCode(trimmed)) {
      setShowDropdown(false);
      loadEvent(trimmed);
    } else if (searchResults.length > 0) {
      selectEvent(searchResults[highlightIdx >= 0 ? highlightIdx : 0].code);
    }
  };

  // ── Flat nav list for keyboard navigation ───────────────────────────────────
  // Order: in empty mode (no chip) → recent then default; in chip/search mode → those results
  const navItems = useMemo((): { code: string }[] => {
    if (mode === "search") return searchResults;
    if (activeChip) return chipResults;
    return [
      ...recent.map((r) => ({ code: r.code })),
      ...(defaultEvents?.events ?? []),
    ];
  }, [mode, searchResults, activeChip, chipResults, recent, defaultEvents]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightIdx(-1);
      return;
    }
    if (!showDropdown || navItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % navItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) =>
        prev <= 0 ? navItems.length - 1 : prev - 1
      );
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      selectEvent(navItems[highlightIdx].code);
    }
  };

  // ── Derived display flags ───────────────────────────────────────────────────
  const showEmptyDropdown = showDropdown && mode === "empty";
  const showSearchDropdown = showDropdown && mode === "search";

  // In empty mode w/ no chip, default events start after recent in the nav list
  const defaultNavOffset = recent.length;

  return (
    <div
      data-tutorial="event-loader"
      className={
        bare ? "" : "bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 py-4"
      }
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-2 sm:gap-3"
      >
        <div className="relative flex-1 min-w-0" ref={containerRef}>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            Event Code or Name
          </label>

          {/* Input */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={eventCode}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder="Search events by name, city, or code..."
              maxLength={100}
              className="bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-9 py-2 text-sm text-white
                placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]
                focus:ring-1 focus:ring-[var(--accent)]/30 w-full transition-colors"
            />
            {/* Right adornment */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {searching ? (
                <Spinner />
              ) : mode === "empty" && !eventCode.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    if (showDropdown) {
                      setShowDropdown(false);
                    } else {
                      inputRef.current?.focus();
                    }
                  }}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-150 ${
                      showDropdown ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          {/* ── Dropdown panel ── */}
          {(showEmptyDropdown || showSearchDropdown) && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">

              {/* ── Empty mode ── */}
              {showEmptyDropdown && (
                <>
                  {/* Filter chips — horizontally scrollable */}
                  <div className="px-3 pt-3 pb-2.5 border-b border-zinc-800 overflow-x-auto">
                    <div className="flex items-center gap-1.5 min-w-max">
                      {chips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => handleChipClick(chip.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            activeChip === chip.id
                              ? "bg-[var(--accent)] text-white shadow-sm"
                              : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white"
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content area */}
                  <div className="max-h-[320px] overflow-y-auto">
                    {activeChip ? (
                      // Chip results
                      chipLoading ? (
                        <div className="flex flex-col items-center gap-2 py-8">
                          <Spinner className="w-5 h-5" />
                          <p className="text-xs text-zinc-500">Loading events…</p>
                        </div>
                      ) : chipResults.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-sm text-zinc-400">No events found for this filter.</p>
                        </div>
                      ) : (
                        chipResults.map((result, idx) => (
                          <EventResultRow
                            key={result.code}
                            result={result}
                            highlighted={highlightIdx === idx}
                            onClick={() => selectEvent(result.code)}
                          />
                        ))
                      )
                    ) : (
                      // Default: recent + happening now
                      <>
                        {recent.length > 0 && (
                          <div>
                            <SectionLabel>Recent</SectionLabel>
                            {recent.map((entry, idx) => (
                              <button
                                key={entry.code}
                                type="button"
                                onClick={() => selectEvent(entry.code)}
                                className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-center justify-between gap-2 transition-colors ${
                                  highlightIdx === idx
                                    ? "bg-zinc-800"
                                    : "hover:bg-zinc-800/60"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="font-mono text-sm text-white leading-snug">
                                    {entry.code}
                                  </p>
                                  <p className="text-xs text-zinc-500 truncate">
                                    {entry.name}
                                  </p>
                                </div>
                                <svg
                                  className="w-3.5 h-3.5 text-zinc-600 shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                  />
                                </svg>
                              </button>
                            ))}
                          </div>
                        )}

                        {defaultLoading ? (
                          <div className="flex items-center gap-2 px-3 py-4">
                            <Spinner className="w-4 h-4" />
                            <p className="text-xs text-zinc-500">Loading events…</p>
                          </div>
                        ) : defaultEvents && defaultEvents.events.length > 0 ? (
                          <div className={recent.length > 0 ? "border-t border-zinc-800" : ""}>
                            <SectionLabel>{defaultEvents.label}</SectionLabel>
                            {defaultEvents.events.map((result, idx) => (
                              <EventResultRow
                                key={result.code}
                                result={result}
                                highlighted={
                                  highlightIdx === defaultNavOffset + idx
                                }
                                onClick={() => selectEvent(result.code)}
                              />
                            ))}
                          </div>
                        ) : null}

                        {/* Fallback empty state */}
                        {recent.length === 0 &&
                          !defaultLoading &&
                          (!defaultEvents || defaultEvents.events.length === 0) && (
                            <div className="py-8 text-center">
                              <p className="text-xs text-zinc-500">
                                Search for an event by name, city, or code.
                              </p>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                </>
              )}

              {/* ── Search mode ── */}
              {showSearchDropdown && (
                <div className="max-h-[320px] overflow-y-auto">
                  {searching && searchResults.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Spinner className="w-5 h-5" />
                      <p className="text-xs text-zinc-500">Searching events…</p>
                    </div>
                  ) : !searching && searchResults.length === 0 ? (
                    <div className="py-8 text-center px-4">
                      <p className="text-sm text-zinc-300">No events found.</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Try a different name or check the event code.
                      </p>
                    </div>
                  ) : (
                    <>
                      {searchResults.length > 0 && (
                        <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                          {searchResults.length}{" "}
                          {searchResults.length === 1 ? "result" : "results"}
                        </p>
                      )}
                      {searchResults.map((result, idx) => (
                        <EventResultRow
                          key={result.code}
                          result={result}
                          highlighted={highlightIdx === idx}
                          onClick={() => selectEvent(result.code)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Load Event button */}
        <button
          type="submit"
          disabled={loading || !eventCode.trim()}
          className="px-5 py-2 min-h-[42px] shrink-0 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40
            disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all
            duration-150 active:scale-[0.97] self-end"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner className="w-4 h-4" />
              Loading
            </span>
          ) : (
            "Load Event"
          )}
        </button>

        <ShareButton />

        {error && (
          <div className="flex items-center gap-2 text-sm text-[var(--danger)] self-center ml-2">
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
      {children}
    </p>
  );
}
