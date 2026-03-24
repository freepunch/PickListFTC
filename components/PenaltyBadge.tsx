"use client";

interface PenaltyBadgeProps {
  /** The team's avg penalty points committed per match at this event */
  avg: number;
  /** 75th-percentile threshold for the event (from penaltyP75()). Pass Infinity to suppress. */
  threshold: number;
}

/**
 * Small yellow warning badge shown next to teams whose avg penalty rate is
 * in the top 25% of the event field. Only renders when the threshold is
 * meaningful (> 0) and the team's avg exceeds both the threshold and 2 pts.
 */
export function PenaltyBadge({ avg, threshold }: PenaltyBadgeProps) {
  if (threshold === Infinity || avg < 2 || avg < threshold) return null;

  return (
    <span
      title={`High penalty rate — avg ${avg.toFixed(1)} pts/match committed`}
      className="inline-flex items-center shrink-0 text-yellow-500/70 hover:text-yellow-400 transition-colors cursor-default"
    >
      {/* Minimal triangle warning icon */}
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25L1.5 20.75h21L12 2.25zm0 3.5l8.25 14.25H3.75L12 5.75zM11 10v4.5h2V10h-2zm0 6v2h2v-2h-2z" />
      </svg>
    </span>
  );
}
