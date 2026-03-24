"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useEvent } from "@/context/EventContext";
import { ScoutNote, loadNotes, saveNotes } from "@/lib/notes";

interface NotesContextValue {
  notes: ScoutNote[];
  notesForTeam: (teamNumber: number) => ScoutNote[];
  teamHasNotes: (teamNumber: number) => boolean;
  addNote: (teamNumber: number, text: string, tags: string[]) => void;
  deleteNote: (id: string) => void;
  exportNotes: () => void;
  importNotes: (json: string) => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { eventCode } = useEvent();
  const [notes, setNotes] = useState<ScoutNote[]>([]);
  const [loadedCode, setLoadedCode] = useState<string>("");

  // Load notes when event code changes
  useEffect(() => {
    if (!eventCode || eventCode === loadedCode) return;
    setNotes(loadNotes(eventCode));
    setLoadedCode(eventCode);
  }, [eventCode, loadedCode]);

  // Persist whenever notes change (only after load)
  useEffect(() => {
    if (!eventCode || loadedCode !== eventCode) return;
    saveNotes(eventCode, notes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const notesForTeam = useCallback(
    (teamNumber: number) => notes.filter((n) => n.teamNumber === teamNumber),
    [notes]
  );

  const teamHasNotes = useCallback(
    (teamNumber: number) => notes.some((n) => n.teamNumber === teamNumber),
    [notes]
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
    },
    []
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

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

  const importNotes = useCallback((json: string) => {
    try {
      const parsed: unknown = JSON.parse(json);
      const imported: ScoutNote[] = Array.isArray(parsed)
        ? (parsed as ScoutNote[])
        : ((parsed as { notes?: ScoutNote[] }).notes ?? []);
      if (!Array.isArray(imported)) return;
      setNotes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newNotes = imported.filter((n) => !existingIds.has(n.id));
        return [...prev, ...newNotes];
      });
    } catch {
      // ignore bad JSON
    }
  }, []);

  return (
    <NotesContext.Provider
      value={{ notes, notesForTeam, teamHasNotes, addNote, deleteNote, exportNotes, importNotes }}
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
