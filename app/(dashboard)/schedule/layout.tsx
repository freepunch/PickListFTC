import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule | PickListFTC",
  description: "Match schedule with score predictions and alliance OPR breakdowns for FTC DECODE events.",
};

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
