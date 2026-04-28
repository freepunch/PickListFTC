"use client";

import { useState } from "react";
import Link from "next/link";

const PRESETS = [3, 5, 10];

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function DonatePage() {
  const [selected, setSelected] = useState<number>(5);
  const [custom, setCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount = custom
    ? parseFloat(customValue) || 0
    : selected;

  const handleDonate = async () => {
    setError(null);

    if (!effectiveAmount || effectiveAmount < 1 || effectiveAmount > 100) {
      setError("Please enter an amount between $1 and $100.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: effectiveAmount }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Something went wrong");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleCustomToggle = () => {
    setCustom(true);
    setCustomValue("");
  };

  const handlePresetClick = (amount: number) => {
    setCustom(false);
    setSelected(amount);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center px-6 py-4 border-b border-zinc-800/60">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          <span className="text-white">Pick</span>
          <span className="text-[var(--accent)]">List</span>
          <span className="text-white">FTC</span>
        </Link>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-6 pt-16 pb-16">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Support PickListFTC</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              PickListFTC is free for every team. Donations help cover hosting and keep the tool running for the FTC community.
            </p>
          </div>

          {/* Amount selection */}
          <div className="mb-6">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Choose an amount
            </p>

            {/* Preset cards */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handlePresetClick(amount)}
                  className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                    !custom && selected === amount
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white"
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Custom amount toggle + input */}
            {custom ? (
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={customValue}
                  onChange={(e) => {
                    setCustomValue(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter amount"
                  autoFocus
                  className="w-full pl-7 pr-3 py-3 bg-zinc-900 border border-[var(--accent)] rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCustomToggle}
                className="w-full mt-2 py-2.5 rounded-xl border border-zinc-800 text-xs text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
              >
                Custom amount
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 mb-4">{error}</p>
          )}

          {/* Donate button */}
          <button
            type="button"
            onClick={handleDonate}
            disabled={loading || effectiveAmount < 1}
            className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
          >
            {loading ? (
              <>
                <Spinner />
                Redirecting to Stripe…
              </>
            ) : (
              <>
                Donate {effectiveAmount >= 1 ? `$${effectiveAmount}` : ""}
              </>
            )}
          </button>

          {/* Trust line */}
          <p className="text-center text-xs text-zinc-600">
            Powered by Stripe — we never see your card details.
          </p>
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
