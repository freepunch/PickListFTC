"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNotes } from "@/context/NotesContext";
import { useAuth } from "@/context/AuthContext";
import { tagColorClass } from "@/lib/notes";

interface NotesBadgeProps {
  teamNumber: number;
  /** If true, also shows a delete button on each note in the popover */
  allowDelete?: boolean;
}

export function NotesBadge({ teamNumber, allowDelete = true }: NotesBadgeProps) {
  const { notesForTeam, sharedNotesForTeam, deleteNote, toggleNoteShared } = useNotes();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const teamNotes = notesForTeam(teamNumber);
  const shared = sharedNotesForTeam(teamNumber);
  const allNotes = [...teamNotes, ...shared];
  const isLoggedIn = !!user;
  const hasTeam = !!profile?.team_number;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 296);
      setPos({ top: rect.bottom + 6, left });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (allNotes.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="inline-flex items-center gap-0.5 text-[var(--accent)] hover:opacity-70 transition-opacity shrink-0"
        title={`${allNotes.length} scout note${allNotes.length !== 1 ? "s" : ""}`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2 5.5A2.5 2.5 0 014.5 3h15A2.5 2.5 0 0122 5.5v10A2.5 2.5 0 0119.5 18H13l-4 3v-3H4.5A2.5 2.5 0 012 15.5v-10z" />
        </svg>
        <span className="text-[10px] font-bold tabular-nums leading-none">
          {allNotes.length}
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">
                Scout Notes
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {/* Own notes */}
              {teamNotes.map((note) => (
                <div
                  key={note.id}
                  className="px-3 py-2.5 border-b border-zinc-800/50 last:border-0 group/note"
                >
                  {note.text && (
                    <p className="text-xs text-zinc-200 mb-1.5 leading-relaxed">
                      {note.text}
                    </p>
                  )}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${tagColorClass(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-zinc-600">
                      {new Date(note.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      {/* Share toggle */}
                      {isLoggedIn && hasTeam && (
                        <button
                          onClick={() => toggleNoteShared(note.id)}
                          className={`text-[10px] transition-colors ${
                            note.shared
                              ? "text-purple-400 hover:text-purple-300"
                              : "text-zinc-700 hover:text-purple-400 opacity-0 group-hover/note:opacity-100"
                          }`}
                          title={note.shared ? "Shared with team" : "Share with my team"}
                        >
                          {note.shared ? "Shared" : "Share"}
                        </button>
                      )}
                      {allowDelete && (
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover/note:opacity-100 text-[10px]"
                          title="Delete note"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Shared teammate notes */}
              {shared.length > 0 && (
                <>
                  {teamNotes.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/30">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-[10px] text-purple-400/70 font-medium shrink-0">
                        Team Notes
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                  )}
                  {shared.map((note) => (
                    <div
                      key={note.id}
                      className="px-3 py-2.5 border-b border-zinc-800/50 last:border-0 bg-purple-500/5"
                    >
                      {note.text && (
                        <p className="text-xs text-zinc-200 mb-1.5 leading-relaxed">
                          {note.text}
                        </p>
                      )}
                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {note.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${tagColorClass(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-purple-400/70">
                          {note.authorName} &middot;{" "}
                          {new Date(note.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
