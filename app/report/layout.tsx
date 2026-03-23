import { AppShell } from "@/components/AppShell";

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
