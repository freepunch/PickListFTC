import Link from "next/link";

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

        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)]
            text-white font-semibold rounded-xl transition-all duration-150 active:scale-[0.97]
            shadow-lg shadow-blue-500/20"
        >
          Launch App
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </Link>

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
