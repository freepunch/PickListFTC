import type { Metadata } from "next";
import "./globals.css";
import { EventProvider } from "@/context/EventContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "PickListFTC",
  description: "FTC Scouting Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <EventProvider>
          <AppShell>{children}</AppShell>
        </EventProvider>
      </body>
    </html>
  );
}
