export interface ScoutNote {
  id: string;
  teamNumber: number;
  text: string;
  tags: string[];
  timestamp: string; // ISO string
}

export type TagCategory = "positive" | "negative" | "neutral";

export interface TagDef {
  label: string;
  category: TagCategory;
}

export const PREDEFINED_TAGS: TagDef[] = [
  { label: "Fast Cycle",      category: "positive" },
  { label: "Consistent",      category: "positive" },
  { label: "Good Driver",     category: "positive" },
  { label: "Strong Auto",     category: "positive" },
  { label: "Strong Endgame",  category: "positive" },
  { label: "Good Defense",    category: "positive" },
  { label: "Slow Cycle",      category: "negative" },
  { label: "Inconsistent",    category: "negative" },
  { label: "Penalty Prone",   category: "negative" },
  { label: "Weak Auto",       category: "negative" },
  { label: "Drops Samples",   category: "negative" },
  { label: "Breaks Down",     category: "negative" },
  { label: "Watch Closely",   category: "neutral"  },
];

const TAG_COLOR_MAP: Record<TagCategory, string> = {
  positive: "bg-green-500/15 text-green-400 border border-green-500/20",
  negative: "bg-red-500/15 text-red-400 border border-red-500/20",
  neutral:  "bg-blue-500/15 text-blue-400 border border-blue-500/20",
};

export function getTagCategory(label: string): TagCategory {
  return PREDEFINED_TAGS.find((t) => t.label === label)?.category ?? "neutral";
}

export function tagColorClass(label: string): string {
  return TAG_COLOR_MAP[getTagCategory(label)];
}

// ── Storage ──

function storageKey(eventCode: string): string {
  return `picklistftc_notes_${eventCode}`;
}

export function loadNotes(eventCode: string): ScoutNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(eventCode));
    return raw ? (JSON.parse(raw) as ScoutNote[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(eventCode: string, notes: ScoutNote[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(eventCode), JSON.stringify(notes));
}
