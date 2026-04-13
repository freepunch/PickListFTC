"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEventData } from "@/lib/api";
import { track } from "@vercel/analytics";

// ── Showcase event for the live preview ─────────────────────────────────────
const SHOWCASE_EVENT_CODE = "USNCWI";

const SESSION_EXPIRED_KEY = "plftc:sessionExpired";

// ── Types ────────────────────────────────────────────────────────────────────

interface PreviewTeam {
  rank: number;
  teamNumber: number;
  teamName: string;
  opr: number;
  wins: number;
  losses: number;
  ties: number;
}

interface PreviewData {
  eventName: string;
  teamCount: number;
  matchCount: number;
  topOpr: number;
  teams: PreviewTeam[];
}

// ── FAQ accordion data ───────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    q: "How do I get started?",
    a: "Sign in with Google, then search for your event by name or code. All features — live OPR, team scouting, pick lists — are available immediately.",
  },
  {
    q: "What is the Leaderboard?",
    a: "The Leaderboard ranks every team at your event by OPR (Offensive Power Rating), auto score, driver-controlled score, and consistency. Click any column header to sort. Use Prescout mode before matches start to rank teams by season-wide data.",
  },
  {
    q: "How does the Match Schedule work?",
    a: "The Schedule tab lists all qualification matches with win probability predictions based on alliance OPR. Expand any match row to see per-team breakdowns. A 'Now' indicator tracks the current match in real time.",
  },
  {
    q: "What does the Pick List do?",
    a: "The Pick List builder lets you rank teams with drag-and-drop reordering. Mark teams as picked to hide them, attach penalty badges, and compare across events. Your list syncs to the cloud automatically.",
  },
  {
    q: "How do I compare teams head-to-head?",
    a: "Open the Compare tab and add up to 3 teams by number. You'll get a radar chart overlaying their scoring profiles and a side-by-side stat table — useful for evaluating alliance picks.",
  },
  {
    q: "What is the Partner Finder?",
    a: "Partner Finder scores every team at the event on how well they complement a chosen robot. It factors in OPR, auto/endgame coverage, and consistency to surface the best alliance combinations.",
  },
  {
    q: "How do Scout Notes work?",
    a: "On any Team Report page, attach freeform notes and predefined tags (Fast Cycle, Penalty Prone, Consistent, etc.) to any team. Notes are saved to your account and can be shared with teammates.",
  },
];

const FEATURES = [
  {
    title: "Live Leaderboard",
    description: "Sortable team rankings by OPR, auto, driver-controlled, and advanced stats for any DECODE event.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "Team Reports",
    description: "Full-season scouting summaries with OPR trends, event history, and strengths breakdown.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "Partner Finder",
    description: "Ranked alliance partner recommendations scored by OPR, complementarity, and consistency.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: "Head-to-Head Compare",
    description: "Radar charts and stat breakdowns for side-by-side team comparison and alliance selection.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
];

// ── Showcase Preview ─────────────────────────────────────────────────────────

function PreviewSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <div className="skeleton h-4 w-56" />
      </div>
      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center gap-4">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-28" />
      </div>
      <div className="divide-y divide-zinc-800/40">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-2.5">
            <div className="skeleton h-3 w-5 shrink-0" />
            <div className="skeleton h-3 w-12 shrink-0" />
            <div className="skeleton h-3 flex-1" />
            <div className="skeleton h-3 w-14 shrink-0" />
            <div className="skeleton h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcasePreview() {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setFailed(true), 5000);

    getEventData(SHOWCASE_EVENT_CODE)
      .then((event) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const playedMatches = event.matches.filter((m) => m.hasBeenPlayed);
        if (playedMatches.length === 0 || !event.teams?.length) {
          setFailed(true);
          return;
        }

        const teams: PreviewTeam[] = event.teams
          .filter((tep) => tep.stats !== null)
          .map((tep) => ({
            rank: (tep.stats as { rank: number }).rank,
            teamNumber: tep.teamNumber,
            teamName: tep.team.name,
            opr: (tep.stats as { opr: { totalPointsNp: number } }).opr.totalPointsNp,
            wins: (tep.stats as { wins: number }).wins,
            losses: (tep.stats as { losses: number }).losses,
            ties: (tep.stats as { ties: number }).ties,
          }))
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 10);

        if (teams.length === 0) { setFailed(true); return; }

        setPreview({
          eventName: event.name,
          teamCount: event.teams.length,
          matchCount: playedMatches.length,
          topOpr: teams[0].opr,
          teams,
        });

        track("landing_preview_shown", { event: SHOWCASE_EVENT_CODE });
      })
      .catch(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setFailed(true);
      });

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  if (failed) return null;
  if (!preview) return <PreviewSkeleton />;

  return (
    <div className="w-full max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-sm font-semibold text-zinc-200 truncate">{preview.eventName}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 ml-2">
          LIVE DATA
        </span>
      </div>

      <div className="px-5 py-2.5 border-b border-zinc-800/60 flex items-center gap-5 text-xs text-zinc-500 flex-wrap">
        <span><span className="text-zinc-300 font-mono font-medium">{preview.teamCount}</span> teams</span>
        <span><span className="text-zinc-300 font-mono font-medium">{preview.matchCount}</span> matches played</span>
        <span>Top OPR: <span className="text-[var(--accent)] font-mono font-semibold">{preview.topOpr.toFixed(1)}</span></span>
      </div>

      <div className="grid grid-cols-[2rem_4rem_1fr_5rem_5rem] gap-x-2 px-5 py-2 border-b border-zinc-800/40 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
        <span className="text-right">#</span>
        <span>Team</span>
        <span>Name</span>
        <span className="text-right">OPR</span>
        <span className="text-right">W-L-T</span>
      </div>

      <div className="divide-y divide-zinc-800/30">
        {preview.teams.map((team, i) => (
          <div
            key={team.teamNumber}
            className={`grid grid-cols-[2rem_4rem_1fr_5rem_5rem] gap-x-2 px-5 py-2 items-center ${
              i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-900/60"
            } ${i === 0 ? "bg-[var(--accent)]/5" : ""}`}
          >
            <span className="text-right text-xs text-zinc-500 font-mono">{team.rank}</span>
            <span className="font-mono text-white font-medium text-xs">{team.teamNumber}</span>
            <span className="text-zinc-400 text-xs truncate">{team.teamName}</span>
            <span className="text-right font-mono text-zinc-200 text-xs">{team.opr.toFixed(1)}</span>
            <span className="text-right font-mono text-zinc-500 text-xs">
              {team.wins}-{team.losses}-{team.ties}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-2.5 border-t border-zinc-800/60 text-[10px] text-zinc-600 text-center">
        Showing top 10 of {preview.teamCount} teams by OPR &middot; Powered by FTC Scout
      </div>
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Check existing session and handle error/expiry flags
  useEffect(() => {
    // Session expired flag set by AppShell when auth state transitions to signed-out
    const expired = sessionStorage.getItem(SESSION_EXPIRED_KEY);
    if (expired) {
      sessionStorage.removeItem(SESSION_EXPIRED_KEY);
      setToast("Your session expired. Please sign in again.");
      setToastIsError(true);
    }

    // Auth error from OAuth callback (?auth_error=1 in URL)
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      setToast("Sign in failed — please try again.");
      setToastIsError(true);
      window.history.replaceState(null, "", "/");
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Already signed in — redirect to dashboard
        if (!expired && !params.get("auth_error")) {
          const name =
            session.user.user_metadata?.full_name ??
            session.user.user_metadata?.name ??
            session.user.email?.split("@")[0] ??
            "you";
          setToast(`Welcome back, ${name}`);
          setToastIsError(false);
        }
        setTimeout(() => router.replace("/dashboard"), 600);
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSignIn = async () => {
    track("landing_signin_clicked");
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setSigningIn(false);
  };

  function ToastBanner() {
    if (!toast) return null;
    return (
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
        <div className={`border rounded-xl px-5 py-3 shadow-2xl flex items-center gap-2.5 ${
          toastIsError
            ? "bg-red-950/90 border-red-800 text-red-200"
            : "bg-zinc-800 border-zinc-700 text-zinc-200"
        }`}>
          {toastIsError ? (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-sm">{toast}</span>
        </div>
      </div>
    );
  }

  // Loading screen while checking auth
  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <ToastBanner />
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "PickListFTC",
            description: "Free scouting dashboard for FIRST Tech Challenge alliance selection",
            url: "https://picklistftc.com",
            applicationCategory: "Sports",
            operatingSystem: "Web",
          }),
        }}
      />

      <ToastBanner />

      {/* Nav — branding only */}
      <nav className="flex items-center px-6 py-4 border-b border-zinc-800/60">
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-white">PickList</span>
          <span className="text-[var(--accent)]">FTC</span>
        </span>
      </nav>

      <main className="flex-1 flex flex-col items-center px-6 pt-12 pb-8">
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8">

          {/* Hero headline */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              <span className="text-white">Smarter alliance selection</span>
              <br />
              <span className="text-[var(--accent)]">for FIRST Tech Challenge</span>
            </h1>
            <p className="text-base text-zinc-400 max-w-md mx-auto">
              Live OPR, team scouting reports, partner finder, and head-to-head comparison — all in one place.
            </p>
          </div>

          {/* Live preview */}
          <ShowcasePreview />

          {/* Primary CTA */}
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-900 font-semibold rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingIn ? (
                <svg className="w-5 h-5 animate-spin text-zinc-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {signingIn ? "Signing in…" : "Sign in with Google"}
            </button>
            <p className="text-xs text-zinc-600 text-center">
              Free to use. Sign in to get started.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-[var(--accent)] mb-3">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </main>

      {/* How It Works */}
      <section id="how-it-works" className="w-full max-w-2xl mx-auto px-6 pb-20 pt-4">
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">How It Works</h2>
        <div className="space-y-1">
          {HOW_IT_WORKS.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={i}
                className={`bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${
                  isOpen ? "border-zinc-600" : "border-zinc-800"
                }`}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className={`text-sm font-medium transition-colors ${isOpen ? "text-white" : "text-zinc-300"}`}>
                    {item.q}
                  </span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 shrink-0 ml-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{ maxHeight: isOpen ? "500px" : "0px" }}
                >
                  <p className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-3">
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <p>
            Built by{" "}
            <a href="https://ftrobotics.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
              First Try #21364
            </a>
          </p>
          <p>DECODE 2025-2026 season</p>
          <div className="flex items-center gap-4">
            <a href="/donate" className="hover:text-zinc-400 transition-colors flex items-center gap-1">
              <svg className="w-3 h-3 text-rose-400/70" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
              Support PickListFTC
            </a>
            <p>
              Data from{" "}
              <a href="https://ftcscout.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
                FTC Scout
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
