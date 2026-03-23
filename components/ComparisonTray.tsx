"use client";

import Link from "next/link";
import { useEvent } from "@/context/EventContext";

export function ComparisonTray() {
  const { selectedTeams, teams, toggleTeamSelection, clearSelection } =
    useEvent();

  if (selectedTeams.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-3 z-50 shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider shrink-0">
            Compare ({selectedTeams.length})
          </span>
          <div className="flex gap-1.5">
            {selectedTeams.map((num) => {
              const team = teams.find((t) => t.teamNumber === num);
              return (
                <span
                  key={num}
                  className="inline-flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-white text-xs px-2.5 py-1 rounded-full shrink-0"
                >
                  <span className="font-mono">{num}</span>
                  {team && (
                    <span className="text-zinc-400 hidden sm:inline">
                      {team.teamName}
                    </span>
                  )}
                  <button
                    onClick={() => toggleTeamSelection(num)}
                    className="text-zinc-500 hover:text-red-400 transition-colors ml-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={clearSelection}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 transition-colors"
          >
            Clear all
          </button>
          {selectedTeams.length >= 2 && (
            <Link
              href="/compare"
              className="text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.97]"
            >
              Compare
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
