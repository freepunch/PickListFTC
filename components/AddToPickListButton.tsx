"use client";

import { useState, useCallback } from "react";
import { usePickListActions, PickListTeam } from "@/hooks/usePickListActions";

interface Props {
  team: PickListTeam;
  /** Size variant. Defaults to "sm". */
  size?: "sm" | "xs";
}

/**
 * A small icon button that adds/removes a team from the current event's pick list.
 * Shows a brief "Added!" toast on success. Self-contained — no props needed beyond team info.
 */
export function AddToPickListButton({ team, size = "sm" }: Props) {
  const { addTeam, removeTeam, isOnPickList, hasEvent } = usePickListActions();
  const [toast, setToast] = useState<"added" | "removed" | null>(null);

  // Recompute on each render so it reflects changes made in this session.
  // isOnPickList reads localStorage synchronously — cheap.
  const onList = hasEvent ? isOnPickList(team.teamNumber) : false;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (onList) {
        removeTeam(team.teamNumber);
        setToast("removed");
      } else {
        addTeam(team);
        setToast("added");
      }

      setTimeout(() => setToast(null), 1800);
    },
    [onList, team, addTeam, removeTeam]
  );

  if (!hasEvent) return null;

  const iconSize = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "xs" ? "w-5 h-5" : "w-6 h-6";

  return (
    <div className="relative inline-flex">
      <button
        onClick={handleClick}
        title={onList ? `Remove ${team.teamNumber} from pick list` : `Add ${team.teamNumber} to pick list`}
        className={`${btnSize} rounded-md flex items-center justify-center transition-all duration-150 ${
          onList
            ? "bg-[var(--accent)] text-white"
            : "bg-zinc-800 border border-zinc-700 text-zinc-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {onList ? (
          // Checkmark icon
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          // Plus icon
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        )}
      </button>

      {/* Mini toast */}
      {toast && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 pointer-events-none z-50">
          {toast === "added" ? "Added!" : "Removed"}
        </span>
      )}
    </div>
  );
}
