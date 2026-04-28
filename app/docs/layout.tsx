import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation | PickListFTC",
  description:
    "Learn how to use PickListFTC for FTC scouting and alliance selection. Video tutorials for every feature.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
