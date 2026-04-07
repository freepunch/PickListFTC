"use client";

import { useCallback } from "react";
import { useEvent } from "@/context/EventContext";
import { useAuth } from "@/context/AuthContext";
import { loadLocalPickList, saveLocalPickList, saveCloudPickList } from "@/lib/picklist-sync";

export interface PickListTeam {
  teamNumber: number;
  teamName: string;
  opr: number;
}

export function usePickListActions() {
  const { event } = useEvent();
  const { user } = useAuth();

  const userId = user?.id ?? null;
  const eventCode = event?.code ?? null;

  const isOnPickList = useCallback(
    (teamNumber: number): boolean => {
      if (!eventCode) return false;
      const stored = loadLocalPickList(eventCode, userId);
      return stored?.entries.some((e) => e.teamNumber === teamNumber) ?? false;
    },
    [eventCode, userId]
  );

  const addTeam = useCallback(
    (team: PickListTeam): boolean => {
      if (!eventCode) return false;

      const stored = loadLocalPickList(eventCode, userId);
      const entries = stored?.entries ?? [];

      if (entries.some((e) => e.teamNumber === team.teamNumber)) return false; // already present

      const updated = {
        entries: [...entries, { ...team, notes: "", picked: false }],
        myTeamNumber: stored?.myTeamNumber ?? null,
        updatedAt: new Date().toISOString(),
      };

      saveLocalPickList(eventCode, updated, userId);

      // Fire-and-forget cloud sync
      if (userId) {
        saveCloudPickList(userId, eventCode, updated).catch(() => {});
      }

      return true;
    },
    [eventCode, userId]
  );

  const removeTeam = useCallback(
    (teamNumber: number): boolean => {
      if (!eventCode) return false;

      const stored = loadLocalPickList(eventCode, userId);
      if (!stored) return false;

      const updated = {
        ...stored,
        entries: stored.entries.filter((e) => e.teamNumber !== teamNumber),
        updatedAt: new Date().toISOString(),
      };

      saveLocalPickList(eventCode, updated, userId);

      if (userId) {
        saveCloudPickList(userId, eventCode, updated).catch(() => {});
      }

      return true;
    },
    [eventCode, userId]
  );

  return { addTeam, removeTeam, isOnPickList, hasEvent: !!eventCode };
}
