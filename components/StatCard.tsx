interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  mono?: boolean;
}

export function StatCard({
  label,
  value,
  subtitle,
  trend,
  mono = true,
}: StatCardProps) {
  const trendColor =
    trend === "up"
      ? "text-[var(--success)]"
      : trend === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--text-muted)]";

  return (
    <div
      className="group rounded-xl p-5 bg-[var(--bg-card)] border border-transparent
        hover:border-[var(--border)] transition-all duration-200
        hover:scale-[1.005]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold text-[var(--text-primary)] tracking-tight ${
          mono ? "font-mono" : "font-display"
        }`}
      >
        {value}
      </p>
      {subtitle && (
        <p className={`mt-2 text-xs ${trendColor}`}>{subtitle}</p>
      )}
    </div>
  );
}
