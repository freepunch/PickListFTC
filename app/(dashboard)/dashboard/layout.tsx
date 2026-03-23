import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | PickListFTC",
  description:
    "Live FTC event dashboard with OPR leaderboards, score distributions, and team stats for DECODE 2025-2026.",
};

export default function DashboardRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
