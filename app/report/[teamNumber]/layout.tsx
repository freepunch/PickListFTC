import type { Metadata } from "next";

interface Props {
  params: { teamNumber: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const num = params.teamNumber;
  return {
    title: `Team ${num} Report | PickListFTC`,
    description: `Full-season scouting report for FTC Team ${num} — OPR trend, event history, strengths, and alliance recommendation.`,
  };
}

export default function TeamReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
