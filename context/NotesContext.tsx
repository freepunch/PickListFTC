"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import {
  ScoutNote,
  loadNotes,
  saveNotes,
  loadCloudNotes,
  saveCloudNote,
  deleteCloudNote,
  updateCloudNoteShared,
  mergeNotes,
  loadTeamSharedNotes,
} from "@/lib/notes";

interface NotesContextValue {
  notes: ScoutNote[];
  sharedNotes: ScoutNote[];
  notesForTeam: (teamNumber: number) => ScoutNote[];
  sharedNotesForTeam: (teamNumber: number) => ScoutNote[];
  teamHasNotes: (teamNumber: number) => boolean;
  addNote: (teamNumber: number, text: string, tags: string[]) => void;
  deleteNote: (id: string) => void;
  toggleNoteShared: (id: string) => void;
  exportNotes: () => void;
  importNotes: (json: string) => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { eventCode } = useEvent();
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<ScoutNote[]>([]);
  const [sharedNotes, setSharedNotes] = useState<ScoutNote[]>([]);
  // Track compound "eventCode:userId" so that signing in mid-session
  // correctly re-runs the load (cloud notes are fetched for the logged-in user).
  const [loadedKey, setLoadedKey] = useState<string>("");
  const syncingRef = useRef(false);

  const userId = user?.id ?? null;

  // Load & merge notes when event code or auth state changes.
  // Using a compound key "eventCode:userId" ensures that signing in while
  // an event is already loaded correctly triggers a cloud sync for the
  // logged-in user (the old guard `eventCode === loadedCode` would skip it).
  useEffect(() => {
    const key = eventCode ? `${eventCode}:${userId ?? ""}` : "";
    if (!eventCode || key === loadedKey) return;

    // Auth is required — userId should always be set by the time this runs.
    if (!userId) {
      setNotes([]);
      setSharedNotes([]);
      setLoadedKey(key);
      return;
    }

    const localNotes = loadNotes(eventCode, userId);

    // Merge local + cloud
    syncingRef.current = true;
    loadCloudNotes(userId, eventCode).then((cloudNotes) => {
      const merged = mergeNotes(localNotes, cloudNotes);
      setNotes(merged);
      saveNotes(eventCode, merged, userId);

      // Push any local-only notes to cloud
      const cloudIds = new Set(cloudNotes.map((n) => n.id));
      const localOnly = merged.filter((n) => !cloudIds.has(n.id));
      for (const note of localOnly) {
        saveCloudNote(userId, eventCode, note);
      }

      syncingRef.current = false;
    });

    // Load shared team notes
    if (profile?.team_number) {
      loadTeamSharedNotes(profile.team_number, eventCode, userId).then(
        setSharedNotes
      );
    } else {
      setSharedNotes([]);
    }

    setLoadedKey(key);
  }, [eventCode, loadedKey, userId, profile?.team_number]);

  // Persist to localStorage whenever notes change (only after load)
  useEffect(() => {
    const key = eventCode ? `${eventCode}:${userId ?? ""}` : "";
    if (!eventCode || loadedKey !== key || syncingRef.current) return;
    saveNotes(eventCode, notes, userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, userId]);

  const notesForTeam = useCallback(
    (teamNumber: number) => notes.filter((n) => n.teamNumber === teamNumber),
    [notes]
  );

  const sharedNotesForTeam = useCallback(
    (teamNumber: number) =>
      sharedNotes.filter((n) => n.teamNumber === teamNumber),
    [sharedNotes]
  );

  const teamHasNotes = useCallback(
    (teamNumber: number) =>
      notes.some((n) => n.teamNumber === teamNumber) ||
      sharedNotes.some((n) => n.teamNumber === teamNumber),
    [notes, sharedNotes]
  );

  const addNote = useCallback(
    (teamNumber: number, text: string, tags: string[]) => {
      const note: ScoutNote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        teamNumber,
        text: text.trim(),
        tags,
        timestamp: new Date().toISOString(),
      };
      setNotes((prev) => [...prev, note]);

      // Cloud sync
      if (userId && eventCode) {
        saveCloudNote(userId, eventCode, note);
      }
    },
    [userId, eventCode]
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (userId) {
        deleteCloudNote(userId, id);
      }
    },
    [userId]
  );

  const toggleNoteShared = useCallback(
    (id: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, shared: !n.shared } : n
        )
      );
      if (userId) {
        const note = notes.find((n) => n.id === id);
        if (note) {
          updateCloudNoteShared(userId, id, !note.shared);
        }
      }
    },
    [userId, notes]
  );

  const exportNotes = useCallback(() => {
    if (!eventCode) return;
    const data = JSON.stringify({ eventCode, notes }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes_${eventCode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [eventCode, notes]);

  const importNotes = useCallback(
    (json: string) => {
      try {
        const parsed: unknown = JSON.parse(json);
        const imported: ScoutNote[] = Array.isArray(parsed)
          ? (parsed as ScoutNote[])
          : ((parsed as { notes?: ScoutNote[] }).notes ?? []);
        if (!Array.isArray(imported)) return;
        setNotes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newNotes = imported.filter((n) => !existingIds.has(n.id));

          // Cloud sync new imports
          if (userId && eventCode) {
            for (const note of newNotes) {
              saveCloudNote(userId, eventCode, note);
            }
          }

          return [...prev, ...newNotes];
        });
      } catch {
        // ignore bad JSON
      }
    },
    [userId, eventCode]
  );

  return (
    <NotesContext.Provider
      value={{
        notes,
        sharedNotes,
        notesForTeam,
        sharedNotesForTeam,
        teamHasNotes,
        addNote,
        deleteNote,
        toggleNoteShared,
        exportNotes,
        importNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}
