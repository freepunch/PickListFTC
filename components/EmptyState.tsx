import type { ReactNode } from "react";

/**
 * Premium empty state: typography-first, no large icons.
 *
 * Usage:
 *   <EmptyState
 *     title="Find your ideal alliance partner"
 *     description="Search for your team above to see ranked compatibility scores across every team at this event."
 *     action={<button>Load an event</button>}
 *   />
 */
export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-24 px-6 ${className}`}
    >
      <h2 className="font-display text-lg font-medium text-[var(--text-primary)] tracking-tight max-w-md">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
