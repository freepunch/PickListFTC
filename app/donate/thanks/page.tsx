import Link from "next/link";

export default function DonateThanksPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center px-6 py-4 border-b border-zinc-800/60">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span className="text-white">PickList</span>
          <span className="text-[var(--accent)]">FTC</span>
        </Link>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          {/* Checkmark */}
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            Thank you for your support!
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Your donation helps keep PickListFTC free for the FTC community.
          </p>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
          >
            Back to App
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-5">
        <p className="text-center text-xs text-zinc-600">
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
      </footer>
    </div>
  );
}
