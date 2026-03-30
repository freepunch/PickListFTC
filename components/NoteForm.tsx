"use client";

import { useState } from "react";
import { PREDEFINED_TAGS, tagColorClass } from "@/lib/notes";
import { useNotes } from "@/context/NotesContext";

interface NoteFormProps {
  teamNumber: number;
  onClose: () => void;
}

export function NoteForm({ teamNumber, onClose }: NoteFormProps) {
  const { addNote } = useNotes();
  const [text, setText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");

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
    onClose();
  };

  const customTags = selectedTags.filter(
    (t) => !PREDEFINED_TAGS.some((p) => p.label === t)
  );

  const canSave = text.trim().length > 0 || selectedTags.length > 0;

  return (
    <div
      className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 space-y-2.5"
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
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
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
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-300"
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
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <button
          type="button"
          onClick={commitCustomTag}
          disabled={!customInput.trim()}
          className="px-2.5 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
