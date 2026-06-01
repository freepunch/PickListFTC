import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EventProvider } from "@/context/EventContext";
import { NotesProvider } from "@/context/NotesContext";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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
      <head>
        {/* Prevent flash of wrong theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var keys=Object.keys(localStorage);var k=keys.find(function(k){return k.includes(':theme')});var t=k?localStorage.getItem(k):'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(t||'dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <WorkspaceProvider>
                <FavoritesProvider>
                  <EventProvider>
                    <NotesProvider>{children}</NotesProvider>
                  </EventProvider>
                </FavoritesProvider>
              </WorkspaceProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
