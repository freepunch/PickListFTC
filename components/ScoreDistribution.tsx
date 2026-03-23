"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Match } from "@/lib/types";

interface ScoreDistributionProps {
  matches: Match[];
}

function buildHistogram(matches: Match[]): { range: string; count: number }[] {
  const scores: number[] = [];
  for (const m of matches) {
    if (!m.hasBeenPlayed || !m.scores?.red || !m.scores?.blue) continue;
    scores.push(m.scores.red.totalPointsNp, m.scores.blue.totalPointsNp);
  }

  if (scores.length === 0) return [];

  const min = Math.floor(Math.min(...scores) / 10) * 10;
  const max = Math.ceil(Math.max(...scores) / 10) * 10;
  const buckets: Record<string, number> = {};

  for (let start = min; start < max; start += 10) {
    buckets[`${start}-${start + 9}`] = 0;
  }

  for (const s of scores) {
    const bucketStart = Math.floor(s / 10) * 10;
    const key = `${bucketStart}-${bucketStart + 9}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }

  return Object.entries(buckets).map(([range, count]) => ({ range, count }));
}

export function ScoreDistribution({ matches }: ScoreDistributionProps) {
  const data = buildHistogram(matches);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No match scores to display.</p>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="range"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={{ stroke: "#27272a" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#fafafa",
            }}
            cursor={{ fill: "rgba(59, 130, 246, 0.08)" }}
            formatter={(value) => [`${value} alliances`, "Count"]}
            labelFormatter={(label) => `Score range: ${label}`}
          />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
