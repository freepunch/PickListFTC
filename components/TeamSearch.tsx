"use client";

import { useState, useMemo, useEffect, useRef, ReactNode } from "react";

export interface TeamSearchOption {
  teamNumber: number;
  teamName: string;
  rank?: number;
}

interface Props {
  teams: TeamSearchOption[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelect: (team: TeamSearchOption) => void;
  /** Called when user clears the input via the X button. */
  onClear?: () => void;
  placeholder?: string;
  /** Outer wrapper class. */
  className?: string;
  /** Limit of dropdown results. Default 8. */
  limit?: number;
  /** Show team rank in dropdown rows when available. Default false. */
  showRank?: boolean;
  /** Show the magnifying-glass icon at the start of the input. Default true. */
  showSearchIcon?: boolean;
  /** Show the X clear button when input has content. Default true. */
  showClearButton?: boolean;
  /** When the input is a numeric exact match for a team, pressing Enter selects it. Default false. */
  enterToSelect?: boolean;
  /** Custom content rendered inside the input wrapper before the input (e.g., a slot indicator dot). */
  prefix?: ReactNode;
  /** Optional id passed to the input — useful for label/aria-controls. */
  inputId?: string;
  /** data-* attribute (used for tutorial/E2E hooks). */
  dataTutorial?: string;
}

export function TeamSearch({
  teams,
  inputValue,
  onInputChange,
  onSelect,
  onClear,
  placeholder = "Search team # or name…",
  className = "",
  limit = 8,
  showRank = false,
  showSearchIcon = true,
  showClearButton = true,
  enterToSelect = false,
  prefix,
  inputId,
  dataTutorial,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return [];
    return teams
      .filter(
        (t) =>
          String(t.teamNumber).includes(q) ||
          t.teamName.toLowerCase().includes(q)
      )
      .slice(0, limit);
  }, [inputValue, teams, limit]);

  function handleSelect(team: TeamSearchOption) {
    onSelect(team);
    setOpen(false);
  }

  return (
    <div
      ref={wrapperRef}
      data-tutorial={dataTutorial}
      className={`relative ${className}`}
    >
      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 transition-all focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-0 focus-within:border-[var(--accent)]">
        {prefix}
        {showSearchIcon && (
          <svg
            className="w-4 h-4 text-zinc-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        )}
        <input
          id={inputId}
          type="text"
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
              return;
            }
            if (e.key === "Enter" && enterToSelect) {
              const trimmed = inputValue.trim();
              const num = parseInt(trimmed, 10);
              if (!isNaN(num) && String(num) === trimmed) {
                const exact = teams.find((t) => t.teamNumber === num);
                if (exact) {
                  e.preventDefault();
                  handleSelect(exact);
                }
              }
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none min-w-0"
        />
        {showClearButton && inputValue && (
          <button
            type="button"
            onClick={() => {
              onInputChange("");
              onClear?.();
              setOpen(false);
            }}
            aria-label="Clear search"
            className="text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
          {results.map((t) => (
            <button
              key={t.teamNumber}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(t)}
              className="w-full text-left px-3 py-3 min-h-[44px] hover:bg-zinc-700/50 active:bg-zinc-700 transition-colors flex items-center gap-3"
            >
              <span className="font-mono text-sm font-semibold text-white shrink-0">
                {t.teamNumber}
              </span>
              <span className="text-sm text-zinc-300 truncate flex-1">
                {t.teamName}
              </span>
              {showRank && t.rank !== undefined && (
                <span className="text-xs text-zinc-600 shrink-0">
                  #{t.rank}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
