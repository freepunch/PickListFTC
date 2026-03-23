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
      ? "text-emerald-400"
      : trend === "down"
        ? "text-red-400"
        : "text-zinc-500";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors duration-150">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p
        className={`text-2xl font-semibold text-white ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className={`text-xs mt-1.5 ${trendColor}`}>{subtitle}</p>
      )}
    </div>
  );
}
