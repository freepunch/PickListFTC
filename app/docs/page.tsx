"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const SECTIONS = [
  {
    id: "signing-in",
    title: "Signing In",
    start: 19,
    description:
      "Sign in with Google to sync your scouting data across devices. All features work without an account, but signing in saves your watched events, pick lists, and notes to the cloud.",
  },
  {
    id: "finding-your-event",
    title: "Finding Your Event",
    start: 30,
    description:
      "Search for any FTC event by name, city, or event code. Use the filter chips to browse events in your region, happening this week, or coming up next. Star events to save them to your sidebar for quick switching.",
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    start: 48,
    description:
      "The Leaderboard ranks every team at the loaded event. Switch between Overview, Auto, Driver-Controlled, and Advanced tabs to see different stat breakdowns. Click any column header to sort. Click a team row to expand their match-by-match details.",
  },
  {
    id: "pick-list-builder",
    title: "Pick List Builder",
    start: 75,
    description:
      "Build your ranked alliance pick list by dragging teams from the available list. Add quick notes to each team, reorder by dragging, and use Quick Fill to auto-populate from Partner Finder scores. Each event gets its own separate pick list.",
  },
  {
    id: "team-notes",
    title: "Team Notes",
    start: 100,
    description:
      "Attach observations to any team — things stats can't capture, like cycle speed, driver skill, or penalty tendencies. Choose from predefined tags or write your own. Notes are visible on leaderboard rows and in team reports.",
  },
  {
    id: "comparison-tool",
    title: "Comparison Tool",
    start: 130,
    description:
      "Select two or three teams to compare side by side. A radar chart overlays their stat profiles, and a complementarity score tells you how well they cover each other's weaknesses. Use this to evaluate alliance pairings.",
  },
  {
    id: "partner-finder",
    title: "Partner Finder",
    start: 161,
    description:
      "Select your team and see every other team ranked by compatibility. Switch between five priority modes: Balanced, Raw OPR, Auto Priority, DC Priority, and Consistency. Each mode reranks the list instantly so you can evaluate partners from different angles.",
  },
  {
    id: "alliance-selection",
    title: "Using the Pick List During Selection",
    start: 200,
    description:
      "During alliance selection, use your pick list to track which teams are available and which have been taken. Click 'Picked' to mark a team as selected by another alliance. Your list stays organized so you always know your next best option.",
  },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (!el) return;
      sectionRefs.current[section.id] = el;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(section.id);
        },
        { threshold: 0.25, rootMargin: "-80px 0px -55% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col text-zinc-300">
      {/* Top nav */}
      <nav className="sticky top-0 z-30 flex items-center px-6 py-4 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span className="text-white">Pick</span>
          <span className="text-[var(--accent)]">List</span>
          <span className="text-white">FTC</span>
        </Link>
      </nav>

      {/* Mobile TOC — horizontal chips, sticky below nav */}
      <div className="md:hidden sticky top-[57px] z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800/50 px-4 py-2.5 overflow-x-auto flex gap-2 scrollbar-none">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
              activeId === s.id
                ? "bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent)]"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="flex flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-10 gap-10">
        {/* Desktop TOC sidebar */}
        <aside className="hidden md:block w-48 shrink-0">
          <div className="sticky top-24 space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600 mb-3 px-2">
              Sections
            </p>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                  activeId === s.id
                    ? "text-[var(--accent)] bg-[var(--accent)]/10"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              How to Use PickListFTC
            </h1>
            <p className="text-zinc-400 text-base mb-4">
              A walkthrough of every feature, with video guides.
            </p>
            <a
              href="https://youtu.be/v-YYb7e474Y"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
            >
              Watch the full tutorial
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          {/* Sections */}
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 scroll-mt-28"
            >
              <h2 className="text-lg font-semibold text-white mb-4">{section.title}</h2>
              <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800">
                <iframe
                  width="100%"
                  style={{ aspectRatio: "16/9", maxWidth: "720px", display: "block" }}
                  src={`https://www.youtube.com/embed/v-YYb7e474Y?start=${section.start}`}
                  title={section.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{section.description}</p>
            </section>
          ))}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6 mt-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-600">
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
          <Link href="/" className="hover:text-zinc-400 transition-colors">
            ← Back to PickListFTC
          </Link>
        </div>
      </footer>
    </div>
  );
}
