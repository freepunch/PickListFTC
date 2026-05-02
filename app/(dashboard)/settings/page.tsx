"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { useNotes } from "@/context/NotesContext";

const APP_VERSION = "1.0";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-[var(--accent)]" : "bg-zinc-700"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-zinc-300">{description}</span>
      <kbd className="font-mono text-xs px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 shrink-0">
        {keys}
      </kbd>
    </div>
  );
}

export default function SettingsPage() {
  const { highContrast, setHighContrast } = useEvent();
  const { user, profile, updateProfile } = useAuth();
  const { exportNotes, importNotes } = useNotes();

  const [teamInput, setTeamInput] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamDirty, setTeamDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  // Sync team field from profile
  useEffect(() => {
    if (profile) setTeamInput(profile.team_number ? String(profile.team_number) : "");
  }, [profile]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    toastTimer.current = setTimeout(() => setToast(null), 2500);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  async function saveTeam() {
    if (!user || teamSaving) return;
    setTeamSaving(true);
    const trimmed = teamInput.trim();
    const num = trimmed ? parseInt(trimmed, 10) : null;
    if (trimmed && (isNaN(num!) || num! < 1 || num! > 99999)) {
      setToast("Invalid team number");
      setTeamSaving(false);
      return;
    }
    try {
      await updateProfile({ team_number: num });
      setTeamDirty(false);
      setToast("Saved");
    } catch {
      setToast("Failed to save");
    } finally {
      setTeamSaving(false);
    }
  }

  function clearLocalCache() {
    if (typeof window === "undefined") return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("plftc:")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setShowClearConfirm(false);
    setToast(`Cleared ${keys.length} cached item${keys.length === 1 ? "" : "s"}`);
  }

  function replayTutorial() {
    window.dispatchEvent(new CustomEvent("plftc:startTutorial"));
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-3 shadow-2xl text-sm text-zinc-200">
              {toast}
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Preferences, shortcuts, and account utilities.</p>
        </div>

        {/* Display */}
        <SectionCard title="Display">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">High contrast</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Increase text contrast and border visibility for bright environments
              </p>
            </div>
            <Toggle
              checked={highContrast}
              onChange={setHighContrast}
              label="High contrast"
            />
          </div>

          <div className="border-t border-zinc-800/60 pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">Theme</p>
              <p className="text-xs text-zinc-500 mt-0.5">Light theme coming soon</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0">
              Dark
            </span>
          </div>

          <div className="border-t border-zinc-800/60 pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">Replay tutorial</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Walk through the app&apos;s features again
              </p>
            </div>
            <button
              type="button"
              onClick={replayTutorial}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0"
            >
              Replay
            </button>
          </div>
        </SectionCard>

        {/* Keyboard Shortcuts */}
        <SectionCard title="Keyboard Shortcuts">
          <ShortcutRow keys="/" description="Focus search" />
          <ShortcutRow keys="Esc" description="Clear selection" />
          <ShortcutRow keys="1 – 4" description="Switch leaderboard tabs" />
          <ShortcutRow keys={isMac ? "⌘K" : "Ctrl+K"} description="Quick event switcher" />
        </SectionCard>

        {/* Your Team */}
        <SectionCard title="Your Team">
          {user ? (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Team number</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamInput}
                  onChange={(e) => {
                    setTeamInput(e.target.value.replace(/\D/g, ""));
                    setTeamDirty(true);
                  }}
                  placeholder="e.g. 21364"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={saveTeam}
                  disabled={!teamDirty || teamSaving}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {teamSaving ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Pre-fills your team in pick lists, schedules, and partner finder. Synced to your{" "}
                <Link href="/profile" className="text-[var(--accent)] hover:underline">
                  profile
                </Link>
                .
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Sign in to save your team number across devices.
            </p>
          )}
        </SectionCard>

        {/* Data */}
        <SectionCard title="Data">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">Clear cached data</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Clears all local cache for this app. Cloud data is unaffected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors shrink-0"
            >
              Clear cache
            </button>
          </div>

          <div className="border-t border-zinc-800/60 pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">Export all notes</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Download your scout notes as a JSON file
              </p>
            </div>
            <button
              type="button"
              onClick={exportNotes}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0"
            >
              Export
            </button>
          </div>

          <div className="border-t border-zinc-800/60 pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">Import notes</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Restore notes from a previously exported JSON file
              </p>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (typeof ev.target?.result === "string") {
                    importNotes(ev.target.result);
                    setToast("Notes imported");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors shrink-0"
            >
              Import
            </button>
          </div>
        </SectionCard>

        {/* About */}
        <SectionCard title="About">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">PickListFTC</span>
            <span className="text-xs font-mono text-zinc-500">v{APP_VERSION}</span>
          </div>
          <p className="text-sm text-zinc-400">
            Built by{" "}
            <a
              href="https://ftrobotics.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              First Try #21364
            </a>
          </p>
          <p className="text-sm text-zinc-400">
            Data from{" "}
            <a
              href="https://ftcscout.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline"
            >
              FTC Scout
            </a>
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/docs"
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="/donate"
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-colors"
            >
              Support PickListFTC
            </Link>
          </div>
        </SectionCard>
      </div>

      {/* Clear-cache confirmation modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Clear cached data?</h3>
            <p className="text-sm text-zinc-400 mb-5">
              This will clear your local cache. Your cloud data (if signed in) won&apos;t be affected.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearLocalCache}
                className="px-4 py-1.5 text-sm bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 rounded-lg transition-colors"
              >
                Clear cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
