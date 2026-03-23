import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Finder | PickListFTC",
  description:
    "Find your ideal FTC alliance partner. Ranked by OPR, complementarity, auto priority, or consistency.",
};

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
