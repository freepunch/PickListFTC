"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useNotes } from "@/context/NotesContext";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { NOTIF_PREF_KEYS, getPref } from "@/hooks/useMatchNotifications";

const APP_VERSION = "1.0";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-[var(--foreground-muted)]">{description}</span>
      <kbd className="font-mono text-xs px-2 py-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded text-[var(--foreground-muted)] shrink-0">
        {keys}
      </kbd>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
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

  // Notification preferences
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifMyMatches, setNotifMyMatches] = useState(true);
  const [notifPickList, setNotifPickList] = useState(true);
  const [notifUpsets, setNotifUpsets] = useState(false);

  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC"));
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
    setNotifMyMatches(getPref(NOTIF_PREF_KEYS.myMatches, true));
    setNotifPickList(getPref(NOTIF_PREF_KEYS.pickListMatches, true));
    setNotifUpsets(getPref(NOTIF_PREF_KEYS.upsetAlerts, false));
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
    <div className="min-h-screen p-4 sm:p-6 pb-24 animate-page-fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-5 py-3 shadow-2xl text-sm text-[var(--text-primary)]">
              {toast}
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text-primary)] tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Preferences, shortcuts, and account utilities.</p>
        </div>

        {/* Appearance */}
        <SectionCard title="Appearance">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Theme</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex items-center gap-0.5 p-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-xl shrink-0">
              {(["dark", "light", "system"] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    theme === t
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)]"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0 border border-zinc-600 inline-block"
                    style={{
                      background:
                        t === "dark"
                          ? "#09090b"
                          : t === "light"
                            ? "#ffffff"
                            : "linear-gradient(135deg, #09090b 50%, #ffffff 50%)",
                    }}
                  />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Replay tutorial</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Walk through the app&apos;s features again
              </p>
            </div>
            <button
              type="button"
              onClick={replayTutorial}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--border)] transition-colors shrink-0"
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
                  className="flex-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--foreground)] font-mono placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--accent)]"
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

        {/* Notifications */}
        <SectionCard title="Notifications">
          {/* Permission row */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Browser notifications</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {notifPermission === "granted"
                  ? "Notifications are enabled"
                  : notifPermission === "denied"
                  ? "Notifications blocked — update in browser settings"
                  : "Allow PickListFTC to send match alerts"}
              </p>
            </div>
            {notifPermission !== "granted" && notifPermission !== "denied" && (
              <button
                type="button"
                onClick={async () => {
                  if (typeof Notification === "undefined") return;
                  const result = await Notification.requestPermission();
                  setNotifPermission(result);
                  if (result === "granted") setToast("Notifications enabled");
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors shrink-0"
              >
                Enable
              </button>
            )}
            {notifPermission === "granted" && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0 pt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                On
              </span>
            )}
            {notifPermission === "denied" && (
              <span className="text-xs text-red-400 shrink-0 pt-0.5">Blocked</span>
            )}
          </div>

          {/* Toggles */}
          {(
            [
              {
                key: NOTIF_PREF_KEYS.myMatches,
                label: "My match results",
                description: "Alert when your team completes a match",
                value: notifMyMatches,
                set: setNotifMyMatches,
                defaultVal: true,
              },
              {
                key: NOTIF_PREF_KEYS.pickListMatches,
                label: "Pick list team results",
                description: "Alert when a team on your pick list plays",
                value: notifPickList,
                set: setNotifPickList,
                defaultVal: true,
              },
              {
                key: NOTIF_PREF_KEYS.upsetAlerts,
                label: "Upset alerts",
                description: "Alert when a large scoring upset occurs",
                value: notifUpsets,
                set: setNotifUpsets,
                defaultVal: false,
              },
            ] as {
              key: string;
              label: string;
              description: string;
              value: boolean;
              set: (v: boolean) => void;
              defaultVal: boolean;
            }[]
          ).map((pref) => (
            <div key={pref.key} className="border-t border-[var(--border)] pt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">{pref.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{pref.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pref.value}
                onClick={() => {
                  const next = !pref.value;
                  pref.set(next);
                  localStorage.setItem(pref.key, String(next));
                }}
                disabled={notifPermission !== "granted"}
                className={`relative shrink-0 w-10 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed ${
                  pref.value ? "bg-[var(--accent)]" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    pref.value ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </SectionCard>

        {/* Data */}
        <SectionCard title="Data">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Clear cached data</p>
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

          <div className="border-t border-[var(--border)] pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Export all notes</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Download your scout notes as a JSON file
              </p>
            </div>
            <button
              type="button"
              onClick={exportNotes}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--border)] transition-colors shrink-0"
            >
              Export
            </button>
          </div>

          <div className="border-t border-[var(--border)] pt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Import notes</p>
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
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--border)] transition-colors shrink-0"
            >
              Import
            </button>
          </div>
        </SectionCard>

        {/* About */}
        <SectionCard title="About">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--foreground)]">PickListFTC</span>
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
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--border)] transition-colors"
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
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Clear cached data?</h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-5">
              This will clear your local cache. Your cloud data (if signed in) won&apos;t be affected.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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
