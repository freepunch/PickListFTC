import type { Metadata } from "next";
import "./globals.css";
import { EventProvider } from "@/context/EventContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://picklistftc.com"),
  title: "PickListFTC — FTC Scouting & Alliance Selection Tool",
  description:
    "Free scouting dashboard for FIRST Tech Challenge. Live OPR, team stats, alliance partner finder, and head-to-head comparison for DECODE 2025-2026 events.",
  openGraph: {
    title: "PickListFTC — FTC Scouting & Alliance Selection Tool",
    description:
      "Free scouting dashboard for FIRST Tech Challenge. Live OPR, stats, and alliance tools for DECODE 2025-2026.",
    url: "https://picklistftc.com",
    siteName: "PickListFTC",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PickListFTC scouting dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PickListFTC — FTC Scouting & Alliance Selection Tool",
    description: "Free scouting dashboard for FIRST Tech Challenge.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <EventProvider>{children}</EventProvider>
      </body>
    </html>
  );
}
