/**
 * User-scoped localStorage key utility.
 *
 * All user-specific localStorage keys MUST go through this module
 * to prevent data leaking between accounts on the same browser.
 *
 * Pattern: "plftc:{userId}:{key}" — login is required; userId is always set.
 */

function scopedKey(key: string, userId?: string | null): string {
  // userId should always be present (login is required). The fallback
  // "plftc:__loading__" is a safety net that should never be reached in practice.
  const prefix = userId ? `plftc:${userId}` : "plftc:__loading__";
  return `${prefix}:${key}`;
}

// ── Favorites keys ──

export function favEventsKey(userId?: string | null): string {
  return scopedKey("watchedEvents", userId);
}

export function favTeamsKey(userId?: string | null): string {
  return scopedKey("watchedTeams", userId);
}

// ── Notes keys ──

export function notesKey(eventCode: string, userId?: string | null): string {
  return scopedKey(`notes:${eventCode}`, userId);
}

// ── Pick list keys ──

export function picklistKey(eventCode: string, userId?: string | null): string {
  return scopedKey(`picklist:${eventCode}`, userId);
}

// ── Recent events key ──

export function recentEventsKey(userId?: string | null): string {
  return scopedKey("recentEvents", userId);
}

// ── Helpers for iterating scoped keys ──

/** Returns all localStorage keys matching the given scoped prefix for a user. */
export function findScopedKeys(
  keyType: "notes" | "picklist",
  userId?: string | null
): { key: string; eventCode: string }[] {
  if (typeof window === "undefined") return [];
  const prefix = userId ? `plftc:${userId}:${keyType}:` : `plftc:__loading__:${keyType}:`;
  const results: { key: string; eventCode: string }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      results.push({ key, eventCode: key.slice(prefix.length) });
    }
  }
  return results;
}

// ── Migration from unscoped keys ──

const OLD_KEYS = {
  favEvents: "plftc:watchedEvents",
  favTeams: "plftc:watchedTeams",
  legacyFavEvents: "picklistftc_fav_events",
  legacyFavTeams: "picklistftc_fav_teams",
  recentEvents: "picklistftc_recent_events",
};

/**
 * Migrate unscoped localStorage keys to user-scoped keys.
 * Call once after login or on app init for anonymous users.
 * Safe to call multiple times — only migrates if old keys exist and new keys don't.
 */
export function migrateUnscopedKeys(userId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    // Migrate favorite events
    for (const oldKey of [OLD_KEYS.favEvents, OLD_KEYS.legacyFavEvents]) {
      const old = localStorage.getItem(oldKey);
      if (old) {
        const newKey = favEventsKey(userId);
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, old);
        }
        localStorage.removeItem(oldKey);
      }
    }

    // Migrate favorite teams
    for (const oldKey of [OLD_KEYS.favTeams, OLD_KEYS.legacyFavTeams]) {
      const old = localStorage.getItem(oldKey);
      if (old) {
        const newKey = favTeamsKey(userId);
        if (!localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, old);
        }
        localStorage.removeItem(oldKey);
      }
    }

    // Migrate recent events
    const oldRecent = localStorage.getItem(OLD_KEYS.recentEvents);
    if (oldRecent) {
      const newKey = recentEventsKey(userId);
      if (!localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, oldRecent);
      }
      localStorage.removeItem(OLD_KEYS.recentEvents);
    }

    // Migrate notes: picklistftc_notes_{eventCode} → scoped
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith("picklistftc_notes_")) continue;
      const eventCode = key.replace("picklistftc_notes_", "");
      const newKey = notesKey(eventCode, userId);
      if (!localStorage.getItem(newKey)) {
        const val = localStorage.getItem(key);
        if (val) localStorage.setItem(newKey, val);
      }
      localStorage.removeItem(key);
    }

    // Migrate picklists: picklistftc_picklist_{eventCode} → scoped
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith("picklistftc_picklist_")) continue;
      const eventCode = key.replace("picklistftc_picklist_", "");
      const newKey = picklistKey(eventCode, userId);
      if (!localStorage.getItem(newKey)) {
        const val = localStorage.getItem(key);
        if (val) localStorage.setItem(newKey, val);
      }
      localStorage.removeItem(key);
    }
  } catch {
    // Best-effort migration — don't crash the app
  }
}

// ── Tutorial key ──

export function tutorialKey(userId?: string | null): string {
  return scopedKey("tutorialComplete", userId);
}

export function isTutorialComplete(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  return !!localStorage.getItem(tutorialKey(userId));
}

export function setTutorialComplete(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(tutorialKey(userId), "1"); } catch {}
}

export function clearTutorialComplete(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(tutorialKey(userId)); } catch {}
}

/**
 * Check if there are any unscoped legacy keys that need migration.
 */
export function hasUnscopedData(): boolean {
  if (typeof window === "undefined") return false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key === OLD_KEYS.favEvents ||
      key === OLD_KEYS.favTeams ||
      key === OLD_KEYS.legacyFavEvents ||
      key === OLD_KEYS.legacyFavTeams ||
      key === OLD_KEYS.recentEvents ||
      key.startsWith("picklistftc_notes_") ||
      key.startsWith("picklistftc_picklist_")
    ) {
      const val = localStorage.getItem(key);
      if (val && val !== "[]" && val !== "null") return true;
    }
  }
  return false;
}
