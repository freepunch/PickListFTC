import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Teams | PickListFTC",
  description:
    "Head-to-head FTC team comparison with radar charts, stat breakdowns, and complementarity analysis for alliance selection.",
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
