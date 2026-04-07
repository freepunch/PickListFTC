"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { rankPartners, penaltyP75 } from "@/lib/calculations";
import { PrescoutBanner } from "@/components/PrescoutBanner";
import { PenaltyBadge } from "@/components/PenaltyBadge";
import { exportPickListPDF } from "@/lib/pdf-export";
import { copyToClipboard } from "@/lib/clipboard";
import {
  StoredPickList,
  loadLocalPickList,
  saveLocalPickList,
  loadCloudPickList,
  saveCloudPickList,
} from "@/lib/picklist-sync";

// ── Types ──

interface PickListEntry {
  teamNumber: number;
  teamName: string;
  opr: number;
  notes: string;
  picked: boolean;
}

type DragSource =
  | { kind: "available"; teamNumber: number; teamName: string; opr: number }
  | { kind: "picklist"; fromIndex: number };

// ── Drag handle icon ──

function GripIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

// ── Main Page ──

export default function PickListPage() {
  const { event, teams, loading, isPrescout, prescoutRanking, prescoutLoading } =
    useEvent();
  const { user } = useAuth();

  const [entries, setEntries] = useState<PickListEntry[]>([]);
  const [myTeamInput, setMyTeamInput] = useState("");
  const [myTeamNumber, setMyTeamNumber] = useState<number | null>(null);
  const [myTeamOpen, setMyTeamOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced">("idle");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [availableSearch, setAvailableSearch] = useState("");
  const [mobileTab, setMobileTab] = useState<"available" | "picklist">("available");

  // Track which event code we've initialized for
  const loadedCodeRef = useRef<string | null>(null);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;

  // Unified team list with OPR values.
  // Uses event.teams as the base so ALL participants appear (not just those
  // with computed stats), then overlays OPR from the stats-bearing teams.
  const allTeamData = useMemo(() => {
    if (!event) return [];

    // Prescout: use prescoutRanking for real OPR once it has loaded
    if (isPrescout && prescoutRanking.length > 0) {
      return prescoutRanking.map((t) => ({
        teamNumber: t.teamNumber,
        teamName: t.teamName,
        opr: t.bestOpr,
      }));
    }

    // Live events (or prescout still loading): build from event.teams so every
    // registered team is visible, then fill OPR from the stats map where available.
    const oprMap = new Map(
      teams.map((t) => [t.teamNumber, t.stats.opr.totalPointsNp])
    );
    return event.teams
      .map((tep) => ({
        teamNumber: tep.teamNumber,
        teamName: tep.team.name,
        opr: oprMap.get(tep.teamNumber) ?? 0,
      }))
      .sort((a, b) => b.opr - a.opr);
  }, [event, teams, isPrescout, prescoutRanking]);

  // Load from localStorage + cloud once per event+user combination.
  // Using a compound key "eventCode:userId" ensures that signing in while an
  // event is already cached correctly triggers a cloud fetch for the logged-in
  // user (guarding on event.code alone would skip it).
  useEffect(() => {
    if (!event || loading) return;
    if (isPrescout && prescoutLoading) return;
    const loadKey = `${event.code}:${userId ?? "anon"}`;
    if (loadedCodeRef.current === loadKey) return;

    loadedCodeRef.current = loadKey;
    const saved = loadLocalPickList(event.code, userId);

    const applyData = (data: StoredPickList | null) => {
      if (data) {
        setEntries(data.entries ?? []);
        if (data.myTeamNumber) {
          setMyTeamNumber(data.myTeamNumber);
          setMyTeamInput(String(data.myTeamNumber));
        } else {
          setMyTeamNumber(null);
          setMyTeamInput("");
        }
      } else {
        setEntries([]);
        setMyTeamNumber(null);
        setMyTeamInput("");
      }
    };

    if (userId) {
      // Try cloud, use newer of local vs cloud
      loadCloudPickList(userId, event.code).then((cloud) => {
        if (!cloud) {
          applyData(saved);
          return;
        }
        const localTime = saved?.updatedAt ? new Date(saved.updatedAt).getTime() : 0;
        const cloudTime = new Date(cloud.updatedAt).getTime();

        if (cloudTime >= localTime) {
          applyData(cloud.data);
          saveLocalPickList(event.code, cloud.data, userId);
        } else {
          applyData(saved);
          // Push local to cloud since it's newer
          if (saved) saveCloudPickList(userId, event.code, saved);
        }
      });
    } else {
      applyData(saved);
    }
  }, [event?.code, loading, isPrescout, prescoutLoading, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage + debounced cloud save
  useEffect(() => {
    if (!event || loadedCodeRef.current !== event.code) return;
    const data: StoredPickList = { entries, myTeamNumber, updatedAt: new Date().toISOString() };
    saveLocalPickList(event.code, data, userId);

    // Debounced cloud sync (2 seconds)
    if (userId) {
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
      setSyncStatus("syncing");
      cloudSaveTimerRef.current = setTimeout(() => {
        saveCloudPickList(userId, event.code, data).then(() => {
          setSyncStatus("synced");
          setTimeout(() => setSyncStatus("idle"), 2000);
        });
      }, 2000);
    }
  }, [entries, myTeamNumber, event?.code, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Penalty data for badges
  const penaltyThreshold = useMemo(() => penaltyP75(teams), [teams]);
  const penaltyMap = useMemo(
    () => new Map(teams.map((t) => [t.teamNumber, t.stats.avg.penaltyPointsCommitted ?? 0])),
    [teams]
  );

  // Teams already in pick list
  const entryNumbers = useMemo(
    () => new Set(entries.map((e) => e.teamNumber)),
    [entries]
  );

  // Available = all event teams not yet in pick list, optionally filtered by search
  const availableTeams = useMemo(() => {
    const q = availableSearch.trim().toLowerCase();
    return allTeamData
      .filter((t) => !entryNumbers.has(t.teamNumber))
      .filter((t) => {
        if (!q) return true;
        return (
          String(t.teamNumber).includes(q) ||
          t.teamName.toLowerCase().includes(q)
        );
      });
  }, [allTeamData, entryNumbers, availableSearch]);

  // My team dropdown suggestions
  const myTeamSuggestions = useMemo(() => {
    const q = myTeamInput.trim().toLowerCase();
    if (!q) return allTeamData.slice(0, 10);
    return allTeamData
      .filter(
        (t) =>
          String(t.teamNumber).includes(q) ||
          t.teamName.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [myTeamInput, allTeamData]);

  // ── Mutations ──

  const addEntry = useCallback(
    (
      team: { teamNumber: number; teamName: string; opr: number },
      atIndex?: number
    ) => {
      const entry: PickListEntry = { ...team, notes: "", picked: false };
      setEntries((prev) => {
        if (atIndex !== undefined) {
          const next = [...prev];
          next.splice(atIndex, 0, entry);
          return next;
        }
        return [...prev, entry];
      });
    },
    []
  );

  const removeEntry = useCallback((teamNumber: number) => {
    setEntries((prev) => prev.filter((e) => e.teamNumber !== teamNumber));
  }, []);

  const togglePicked = useCallback((teamNumber: number) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.teamNumber === teamNumber ? { ...e, picked: !e.picked } : e
      )
    );
  }, []);

  const updateNotes = useCallback((teamNumber: number, notes: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.teamNumber === teamNumber ? { ...e, notes } : e
      )
    );
  }, []);

  const moveEntry = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setEntries((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  const quickFill = useCallback(() => {
    if (allTeamData.length === 0) return;
    const existingNums = new Set(entries.map((e) => e.teamNumber));

    let sorted: typeof allTeamData;
    if (!isPrescout && myTeamNumber) {
      const myTeam = teams.find((t) => t.teamNumber === myTeamNumber);
      if (myTeam) {
        const results = rankPartners(myTeam, teams, "balanced");
        sorted = results.map((r) => {
          const td = allTeamData.find((t) => t.teamNumber === r.teamNumber);
          return { teamNumber: r.teamNumber, teamName: r.teamName, opr: td?.opr ?? 0 };
        });
      } else {
        sorted = [...allTeamData].sort((a, b) => b.opr - a.opr);
      }
    } else {
      sorted = [...allTeamData].sort((a, b) => b.opr - a.opr);
    }

    const toAdd = sorted.filter(
      (t) => !existingNums.has(t.teamNumber) && t.teamNumber !== myTeamNumber
    );
    setEntries((prev) => [
      ...prev,
      ...toAdd.map((t) => ({ ...t, notes: "", picked: false })),
    ]);
  }, [allTeamData, entries, isPrescout, myTeamNumber, teams]);

  const clearList = useCallback(() => {
    setEntries([]);
    setShowClearConfirm(false);
  }, []);

  const exportPickList = useCallback(() => {
    if (!event) return;
    const active = entries.filter((e) => !e.picked);
    const taken = entries.filter((e) => e.picked);
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const tableRows = (list: PickListEntry[], showRank: boolean) =>
      list
        .map(
          (e, i) => `
        <tr>
          <td class="rank">${showRank ? `#${i + 1}` : "—"}</td>
          <td class="num">${e.teamNumber}</td>
          <td>${e.teamName.replace(/</g, "&lt;")}</td>
          <td class="opr">${e.opr.toFixed(1)}</td>
          <td class="notes">${e.notes ? `<em>${e.notes.replace(/</g, "&lt;")}</em>` : ""}</td>
        </tr>`
        )
        .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pick List — ${event.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; background: #fff; color: #111; }
  header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 12px; }
  h2 { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.08em; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #e5e7eb; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
  td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .rank { color: #9ca3af; width: 44px; font-size: 12px; }
  .num { font-weight: 700; font-family: monospace; width: 64px; }
  .opr { font-family: monospace; text-align: right; width: 60px; }
  .notes { color: #6b7280; }
  @media print { body { padding: 20px; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <header>
    <h1>${event.name.replace(/</g, "&lt;")}</h1>
    <p class="subtitle">Pick List &nbsp;·&nbsp; ${date}</p>
  </header>
  <table>
    <thead><tr>
      <th>Rank</th><th>Team #</th><th>Name</th>
      <th style="text-align:right">OPR</th><th>Notes</th>
    </tr></thead>
    <tbody>${tableRows(active, true)}</tbody>
  </table>
  ${
    taken.length > 0
      ? `<h2>Taken by Other Alliances</h2>
  <table>
    <thead><tr>
      <th></th><th>Team #</th><th>Name</th>
      <th style="text-align:right">OPR</th><th>Notes</th>
    </tr></thead>
    <tbody style="color:#9ca3af">${tableRows(taken, false)}</tbody>
  </table>`
      : ""
  }
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }, [event, entries]);

  const handleExportPDF = useCallback(async () => {
    if (!event || entries.length === 0) return;
    setPdfExporting(true);
    await new Promise((r) => setTimeout(r, 10)); // let UI update
    await exportPickListPDF(event.name, event.code, entries);
    setPdfExporting(false);
  }, [event, entries]);

  const handleCopyList = useCallback(async () => {
    if (entries.length === 0) return;
    const active = entries.filter((e) => !e.picked);
    const lines = active.map((e, i) => `${i + 1}. #${e.teamNumber} ${e.teamName}`);
    const text = `Pick List${event ? ` — ${event.name}` : ""}\n${lines.join("\n")}`;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  }, [entries, event]);

  // ── Drag handlers ──

  function handleAvailableDragStart(
    e: React.DragEvent,
    team: { teamNumber: number; teamName: string; opr: number }
  ) {
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ kind: "available", ...team });
  }

  function handlePickListDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ kind: "picklist", fromIndex: index });
  }

  function handleRowDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleRowDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragSource) return;
    if (dragSource.kind === "available") {
      addEntry(
        { teamNumber: dragSource.teamNumber, teamName: dragSource.teamName, opr: dragSource.opr },
        index
      );
    } else {
      moveEntry(dragSource.fromIndex, index);
    }
    setDragSource(null);
    setDragOverIndex(null);
  }

  function handleContainerDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(null);
  }

  function handleContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!dragSource) return;
    if (dragSource.kind === "available") {
      addEntry({ teamNumber: dragSource.teamNumber, teamName: dragSource.teamName, opr: dragSource.opr });
    } else {
      moveEntry(dragSource.fromIndex, entries.length - 1);
    }
    setDragSource(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragSource(null);
    setDragOverIndex(null);
  }

  // ── Derived display state ──

  const activeEntries = entries.filter((e) => !e.picked);
  const takenEntries = entries.filter((e) => e.picked);
  const takenCount = takenEntries.length;
  const isLoading = loading || (isPrescout && prescoutLoading);

  // ── Render ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-zinc-500">Loading event data…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <svg
          className="w-10 h-10 text-zinc-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        <p className="text-sm text-zinc-500">Load an event to build your pick list.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {isPrescout && <PrescoutBanner />}

      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Pick List Builder</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{event.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {userId && syncStatus !== "idle" && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              syncStatus === "syncing"
                ? "text-zinc-500 bg-zinc-800"
                : "text-green-400 bg-green-500/10"
            }`}>
              {syncStatus === "syncing" ? "Syncing..." : "Synced"}
            </span>
          )}
          {entries.length > 0 && (
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
              {takenCount} of {allTeamData.length} teams picked
            </span>
          )}
          <div className="relative">
            <button
              onClick={handleCopyList}
              disabled={entries.filter((e) => !e.picked).length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy List
            </button>
            {copyToast && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 pointer-events-none z-50">
                Copied!
              </span>
            )}
          </div>
          <button
            onClick={exportPickList}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export
          </button>
          <button
            onClick={handleExportPDF}
            disabled={entries.length === 0 || pdfExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700"
          >
            {pdfExporting ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {pdfExporting ? "Generating…" : "Export PDF"}
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={entries.length === 0}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear List
          </button>
        </div>
      </div>

      {/* Quick Fill bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--border)] bg-zinc-900/40 shrink-0">
        <span className="text-xs text-zinc-500 shrink-0">My Team</span>
        <div className="relative">
          <input
            type="text"
            value={myTeamInput}
            onChange={(e) => {
              setMyTeamInput(e.target.value);
              setMyTeamOpen(true);
              setMyTeamNumber(null);
            }}
            onFocus={() => setMyTeamOpen(true)}
            onBlur={() => setTimeout(() => setMyTeamOpen(false), 150)}
            placeholder="Team # or name…"
            className="w-52 bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]"
          />
          {myTeamOpen && myTeamSuggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 py-1 max-h-48 overflow-y-auto">
              {myTeamSuggestions.map((t) => (
                <button
                  key={t.teamNumber}
                  onMouseDown={() => {
                    setMyTeamNumber(t.teamNumber);
                    setMyTeamInput(String(t.teamNumber));
                    setMyTeamOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-800 text-left"
                >
                  <span className="font-mono font-semibold text-white w-10 shrink-0">
                    {t.teamNumber}
                  </span>
                  <span className="text-zinc-400 truncate">{t.teamName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={quickFill}
          disabled={allTeamData.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--accent)]/20"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Quick Fill
        </button>
        <span className="text-xs text-zinc-600">
          {myTeamNumber
            ? isPrescout
              ? "Fills by season OPR"
              : "Fills by partner compatibility score"
            : "Fills by OPR — select your team for smart ranking"}
        </span>
      </div>

      {/* Mobile tab bar */}
      <div className="sm:hidden flex border-b border-[var(--border)] shrink-0">
        {(["available", "picklist"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileTab === tab
                ? "text-white border-b-2 border-[var(--accent)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "available" ? `Available (${availableTeams.length})` : `My List (${entries.length})`}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div data-tutorial="picklist-area" className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Available Teams */}
        <div className={`sm:w-72 sm:shrink-0 sm:border-r sm:border-[var(--border)] flex flex-col min-h-0 ${mobileTab === "available" ? "flex w-full" : "hidden sm:flex"}`}>
          <div className="px-4 py-2.5 border-b border-[var(--border)] shrink-0">
            <p className="text-sm font-medium text-zinc-300">Available Teams</p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {availableTeams.length} of {allTeamData.length - entries.length} teams
              {availableSearch ? " matched" : " · sorted by OPR"}
            </p>
            <div className="relative mt-2">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
                />
              </svg>
              <input
                type="text"
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                placeholder="Filter by # or name…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-6 pr-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]"
              />
              {availableSearch && (
                <button
                  onClick={() => setAvailableSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {availableTeams.length === 0 ? (
              <div className="flex items-center justify-center h-16 text-xs text-zinc-600">
                {availableSearch ? "No teams match" : "All teams added"}
              </div>
            ) : (
              availableTeams.map((team) => (
                <div
                  key={team.teamNumber}
                  draggable
                  onDragStart={(e) => handleAvailableDragStart(e, team)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-800 select-none group border-b border-zinc-800/50 last:border-b-0"
                >
                  <span
                    className="text-zinc-700 group-hover:text-zinc-500 shrink-0 cursor-grab hidden sm:block"
                    onClick={() => addEntry(team)}
                  >
                    <GripIcon />
                  </span>
                  <span
                    className="font-mono text-sm font-semibold text-white w-12 shrink-0 cursor-pointer"
                    onClick={() => { addEntry(team); setMobileTab("picklist"); }}
                  >
                    {team.teamNumber}
                  </span>
                  <span
                    className="text-xs text-zinc-400 flex-1 truncate cursor-pointer"
                    onClick={() => { addEntry(team); setMobileTab("picklist"); }}
                  >
                    {team.teamName}
                  </span>
                  <span className="font-mono text-xs text-zinc-600 shrink-0 tabular-nums hidden sm:block">
                    {team.opr.toFixed(1)}
                  </span>
                  {/* Mobile add button */}
                  <button
                    className="sm:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-[var(--accent)] hover:bg-zinc-800 rounded-md transition-colors"
                    onClick={() => { addEntry(team); setMobileTab("picklist"); }}
                    title="Add to pick list"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: My Pick List */}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${mobileTab === "picklist" ? "flex" : "hidden sm:flex"}`}>
          <div className="px-4 py-2.5 border-b border-[var(--border)] shrink-0">
            <p className="text-sm font-medium text-zinc-300">My Pick List</p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {entries.length === 0
                ? "Drag or click teams from the left to add"
                : `${activeEntries.length} ranked · ${takenEntries.length} taken`}
            </p>
          </div>

          <div
            className="flex-1 overflow-y-auto"
            onDragOver={handleContainerDragOver}
            onDrop={handleContainerDrop}
          >
            {entries.length === 0 ? (
              <div
                className={`m-4 flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed transition-colors ${
                  dragSource?.kind === "available"
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                    : "border-zinc-800"
                }`}
              >
                <svg
                  className="w-7 h-7 text-zinc-700 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p className="text-xs text-zinc-600">Drag teams here or click to add</p>
              </div>
            ) : (
              <div className="pb-8">
                {/* Active (ranked) entries */}
                {activeEntries.map((entry) => {
                  const actualIndex = entries.indexOf(entry);
                  return (
                    <PickListRow
                      key={entry.teamNumber}
                      entry={entry}
                      rank={activeEntries.indexOf(entry) + 1}
                      isDragOver={dragOverIndex === actualIndex}
                      penaltyAvg={penaltyMap.get(entry.teamNumber) ?? 0}
                      penaltyThreshold={penaltyThreshold}
                      onDragStart={(e) => handlePickListDragStart(e, actualIndex)}
                      onDragOver={(e) => handleRowDragOver(e, actualIndex)}
                      onDrop={(e) => handleRowDrop(e, actualIndex)}
                      onDragEnd={handleDragEnd}
                      onRemove={() => removeEntry(entry.teamNumber)}
                      onTogglePicked={() => togglePicked(entry.teamNumber)}
                      onUpdateNotes={(notes) => updateNotes(entry.teamNumber, notes)}
                    />
                  );
                })}

                {/* Taken section */}
                {takenEntries.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 mt-1">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-xs text-zinc-600 font-medium shrink-0">
                        Taken by Other Alliances
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                    {takenEntries.map((entry) => {
                      const actualIndex = entries.indexOf(entry);
                      return (
                        <PickListRow
                          key={entry.teamNumber}
                          entry={entry}
                          rank={null}
                          isDragOver={dragOverIndex === actualIndex}
                          penaltyAvg={penaltyMap.get(entry.teamNumber) ?? 0}
                          penaltyThreshold={penaltyThreshold}
                          onDragStart={(e) =>
                            handlePickListDragStart(e, actualIndex)
                          }
                          onDragOver={(e) => handleRowDragOver(e, actualIndex)}
                          onDrop={(e) => handleRowDrop(e, actualIndex)}
                          onDragEnd={handleDragEnd}
                          onRemove={() => removeEntry(entry.teamNumber)}
                          onTogglePicked={() => togglePicked(entry.teamNumber)}
                          onUpdateNotes={(notes) =>
                            updateNotes(entry.teamNumber, notes)
                          }
                        />
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-white mb-2">
              Clear Pick List?
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              This will remove all {entries.length} team
              {entries.length !== 1 ? "s" : ""} from your pick list. This cannot
              be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={clearList}
                className="px-3 py-1.5 text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-md transition-colors"
              >
                Clear List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PickListRow component ──

interface PickListRowProps {
  entry: PickListEntry;
  rank: number | null;
  isDragOver: boolean;
  penaltyAvg: number;
  penaltyThreshold: number;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onTogglePicked: () => void;
  onUpdateNotes: (notes: string) => void;
}

function PickListRow({
  entry,
  rank,
  isDragOver,
  penaltyAvg,
  penaltyThreshold,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
  onTogglePicked,
  onUpdateNotes,
}: PickListRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 px-3 py-2 group select-none hover:bg-zinc-900/60 border-b border-zinc-800/40 last:border-b-0 transition-colors border-t-2 ${
        isDragOver ? "border-t-[var(--accent)]" : "border-t-transparent"
      } ${entry.picked ? "opacity-60" : ""}`}
    >
      {/* Drag handle */}
      <span className="text-zinc-700 group-hover:text-zinc-500 shrink-0 cursor-grab active:cursor-grabbing">
        <GripIcon />
      </span>

      {/* Status dot */}
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          entry.picked ? "bg-yellow-500" : "bg-green-500"
        }`}
        title={entry.picked ? "Taken by another alliance" : "Available"}
      />

      {/* Rank */}
      <span className="text-xs text-zinc-600 font-mono w-7 shrink-0 text-right tabular-nums">
        {rank !== null ? `#${rank}` : "—"}
      </span>

      {/* Team number */}
      <span className="font-mono text-sm font-semibold text-white w-12 shrink-0">
        {entry.teamNumber}
      </span>

      {/* Team name */}
      <span className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
        <span
          className={`text-xs truncate ${
            entry.picked ? "text-zinc-500" : "text-zinc-300"
          }`}
        >
          {entry.teamName}
        </span>
        <PenaltyBadge avg={penaltyAvg} threshold={penaltyThreshold} />
      </span>

      {/* OPR */}
      <span className="font-mono text-xs text-zinc-500 w-12 text-right shrink-0 tabular-nums">
        {entry.opr.toFixed(1)}
      </span>

      {/* Notes input */}
      <input
        type="text"
        value={entry.notes}
        onChange={(e) => onUpdateNotes(e.target.value)}
        placeholder="notes…"
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
        className="w-36 bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 shrink-0"
      />

      {/* Picked button */}
      <button
        onClick={onTogglePicked}
        title={
          entry.picked
            ? "Mark as available"
            : "Mark as picked by another alliance"
        }
        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors shrink-0 ${
          entry.picked
            ? "bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
            : "bg-zinc-800 text-zinc-500 hover:text-yellow-400 hover:bg-yellow-500/10 border border-zinc-700"
        }`}
      >
        {entry.picked ? "Taken" : "Picked"}
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        title="Remove from pick list"
        className="p-1 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
