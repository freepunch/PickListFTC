import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard | PickListFTC",
  description:
    "Sortable team rankings by OPR, auto, driver-controlled, and advanced stats for any FTC DECODE event.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
