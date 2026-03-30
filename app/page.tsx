"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const FEATURES = [
  {
    title: "Live Leaderboard",
    description:
      "Sortable team rankings by OPR, auto, driver-controlled, and advanced stats for any DECODE event.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    title: "Team Reports",
    description:
      "Full-season scouting summaries with OPR trends, event history, and strengths breakdown.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    title: "Partner Finder",
    description:
      "Ranked alliance partner recommendations scored by OPR, complementarity, and consistency.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
  {
    title: "Head-to-Head Compare",
    description:
      "Radar charts and stat breakdowns for side-by-side team comparison and alliance selection.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
    ),
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name =
          session.user.user_metadata?.full_name ??
          session.user.user_metadata?.name ??
          session.user.email?.split("@")[0] ??
          "you";
        setToast(`Welcome back, ${name}`);
        setTimeout(() => router.replace("/dashboard"), 600);
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSignIn = async () => {
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setSigningIn(false);
    }
  };

  // Show nothing while checking session (prevents flash)
  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        {/* JSON-LD still renders for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "PickListFTC",
              description:
                "Free scouting dashboard for FIRST Tech Challenge alliance selection",
              url: "https://picklistftc.com",
              applicationCategory: "Sports",
              operatingSystem: "Web",
            }),
          }}
        />

        {/* Toast overlay */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-2.5">
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-zinc-200">{toast}</span>
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-center">
            <span className="text-white">PickList</span>
            <span className="text-[var(--accent)]">FTC</span>
          </h1>
          <div className="mt-8 w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "PickListFTC",
            description:
              "Free scouting dashboard for FIRST Tech Challenge alliance selection",
            url: "https://picklistftc.com",
            applicationCategory: "Sports",
            operatingSystem: "Web",
          }),
        }}
      />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-center">
          <span className="text-white">PickList</span>
          <span className="text-[var(--accent)]">FTC</span>
        </h1>

        <p className="mt-4 text-lg sm:text-xl text-zinc-400 text-center max-w-lg">
          Smarter alliance selection for FIRST Tech Challenge
        </p>

        <p className="mt-3 text-sm text-zinc-500 text-center max-w-md">
          Live OPR, team scouting reports, partner finder, and head-to-head
          comparison &mdash; powered by FTC Scout data.
        </p>

        {/* Two entry paths */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-lg">
          {/* Sign in & Launch */}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex-1 group relative bg-zinc-900 border border-zinc-800 rounded-xl p-5
              hover:border-zinc-600 transition-all duration-150 active:scale-[0.98]
              text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3 mb-3">
              {/* Google logo */}
              <div className="w-9 h-9 rounded-lg bg-zinc-800 group-hover:bg-zinc-750 flex items-center justify-center shrink-0 transition-colors">
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  {signingIn ? "Redirecting..." : "Sign in & Launch"}
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Sync your scouting across devices.
            </p>
            {signingIn && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-xl">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
              </div>
            )}
          </button>

          {/* Continue without account */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 group bg-zinc-900 border border-zinc-800 rounded-xl p-5
              hover:border-zinc-600 transition-all duration-150 active:scale-[0.98]
              text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 group-hover:bg-zinc-750 flex items-center justify-center shrink-0 transition-colors">
                <svg
                  className="w-[18px] h-[18px] text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                  Continue without account
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              All features available, data saved locally.
            </p>
          </button>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-[var(--accent)] mb-3">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                {f.title}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <p>
            Built by{" "}
            <a
              href="https://ftrobotics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors"
            >
              First Try #21364
            </a>
          </p>
          <p>DECODE 2025-2026 season</p>
          <p>
            Data from{" "}
            <a
              href="https://ftcscout.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors"
            >
              FTC Scout
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
