"use client";

import { useEffect, useState } from "react";
import { PREDEFINED_TAGS, tagColorClass } from "@/lib/notes";
import { useNotes } from "@/context/NotesContext";
import { useAuth } from "@/context/AuthContext";
import { useEvent } from "@/context/EventContext";
import { useWorkspaceOptional } from "@/context/WorkspaceContext";
import { addWorkspaceNote } from "@/lib/workspace";

interface NoteFormProps {
  teamNumber: number;
  onClose: () => void;
}

const SHARE_PREF_KEY = "plftc:noteForm:shareToWorkspace";

export function NoteForm({ teamNumber, onClose }: NoteFormProps) {
  const { addNote } = useNotes();
  const { user } = useAuth();
  const { eventCode } = useEvent();
  const ws = useWorkspaceOptional();
  const [text, setText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [shareToWorkspace, setShareToWorkspace] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SHARE_PREF_KEY);
      if (v === "1") setShareToWorkspace(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SHARE_PREF_KEY, shareToWorkspace ? "1" : "0");
    } catch {}
  }, [shareToWorkspace]);

  const toggleTag = (label: string) => {
    setSelectedTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  const commitCustomTag = () => {
    const tag = customInput.trim().replace(/<[^>]*>/g, "");
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setCustomInput("");
  };

  const handleSave = () => {
    if (!text.trim() && selectedTags.length === 0) return;
    addNote(teamNumber, text, selectedTags);
    if (shareToWorkspace && ws?.workspace && user && eventCode) {
      addWorkspaceNote(
        ws.workspace.id,
        user.id,
        eventCode,
        teamNumber,
        text.trim(),
        selectedTags
      ).then(() => ws.refreshNotes());
    }
    onClose();
  };

  const canShareToWorkspace = !!ws?.workspace && !!user && !!eventCode;

  const customTags = selectedTags.filter(
    (t) => !PREDEFINED_TAGS.some((p) => p.label === t)
  );

  const canSave = text.trim().length > 0 || selectedTags.length > 0;

  return (
    <div
      className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-xl p-3 space-y-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Text input */}
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        maxLength={1000}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
        }}
        placeholder="Observation about this team…"
        rows={2}
        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--border-hover)] resize-none"
      />

      {/* Predefined tag chips */}
      <div className="flex flex-wrap gap-1">
        {PREDEFINED_TAGS.map((tag) => {
          const active = selectedTags.includes(tag.label);
          return (
            <button
              key={tag.label}
              type="button"
              onClick={() => toggleTag(tag.label)}
              className={`px-2 py-0.5 rounded-full text-xs transition-all ${
                active
                  ? tagColorClass(tag.label)
                  : "bg-[var(--bg-card-hover)] text-[var(--foreground-dim)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--foreground-muted)]"
              }`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>

      {/* Custom tag input */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value.slice(0, 50))}
          maxLength={50}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitCustomTag();
            }
          }}
          placeholder="Custom tag (Enter to add)…"
          className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-dim)] focus:outline-none focus:border-[var(--border-hover)]"
        />
        <button
          type="button"
          onClick={commitCustomTag}
          disabled={!customInput.trim()}
          className="px-2.5 py-1 text-xs bg-[var(--bg-card-hover)] text-[var(--foreground-muted)] rounded hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {/* Custom tags display */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {customTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="text-blue-400/60 hover:text-blue-300 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Workspace share toggle */}
      {canShareToWorkspace && (
        <label className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={shareToWorkspace}
            onChange={(e) => setShareToWorkspace(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span>
            Share to workspace
            <span className="text-[var(--foreground-dim)]"> · {ws!.workspace!.name}</span>
          </span>
        </label>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-3 py-1 text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Note
        </button>
      </div>
    </div>
  );
}
