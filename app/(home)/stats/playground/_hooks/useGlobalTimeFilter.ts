"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface GlobalTimeFilterState {
  // Source-of-truth values applied to charts.
  globalStartTime: string | null;
  globalEndTime: string | null;
  // Last-saved snapshot — used to compute dirty state.
  savedGlobalStartTime: string | null;
  savedGlobalEndTime: string | null;
  // Editable scratch values shown inside the popover before the user clicks Reload.
  tempGlobalStartTime: Date | undefined;
  tempGlobalEndTime: Date | undefined;
  // Popover visibility.
  showPopover: boolean;
  // Bumped whenever the filter is applied; ConfigurableChart reads this to trigger a refetch.
  reloadTrigger: number;
  // Derived helpers.
  globalDateRange: { from: Date | undefined; to: Date | undefined };

  // Actions.
  setGlobalStartTime: (value: string | null) => void;
  setGlobalEndTime: (value: string | null) => void;
  setSavedGlobalStartTime: (value: string | null) => void;
  setSavedGlobalEndTime: (value: string | null) => void;
  setTempGlobalStartTime: (value: Date | undefined) => void;
  setTempGlobalEndTime: (value: Date | undefined) => void;
  setShowPopover: (value: boolean) => void;
  applyTempRange: () => void;
  clearRange: () => void;
  resetAll: () => void;
}

// Owns the playground's global time-range picker. Holds three parallel
// representations (applied / saved / temp-during-edit) plus the popover open
// state and a counter that downstream charts watch to know when to refetch.
export function useGlobalTimeFilter(): GlobalTimeFilterState {
  const [globalStartTime, setGlobalStartTime] = useState<string | null>(null);
  const [globalEndTime, setGlobalEndTime] = useState<string | null>(null);
  const [savedGlobalStartTime, setSavedGlobalStartTime] = useState<
    string | null
  >(null);
  const [savedGlobalEndTime, setSavedGlobalEndTime] = useState<string | null>(
    null
  );
  const [tempGlobalStartTime, setTempGlobalStartTime] = useState<
    Date | undefined
  >(undefined);
  const [tempGlobalEndTime, setTempGlobalEndTime] = useState<Date | undefined>(
    undefined
  );
  const [showPopover, setShowPopover] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Sync temp values from the current applied range whenever the popover opens.
  useEffect(() => {
    if (showPopover) {
      setTempGlobalStartTime(
        globalStartTime ? new Date(globalStartTime) : undefined
      );
      setTempGlobalEndTime(
        globalEndTime ? new Date(globalEndTime) : undefined
      );
    }
  }, [showPopover, globalStartTime, globalEndTime]);

  const globalDateRange = useMemo(() => {
    if (globalStartTime && globalEndTime) {
      return {
        from: new Date(globalStartTime),
        to: new Date(globalEndTime),
      };
    }
    return { from: undefined, to: undefined };
  }, [globalStartTime, globalEndTime]);

  const applyTempRange = useCallback(() => {
    setGlobalStartTime(
      tempGlobalStartTime ? tempGlobalStartTime.toISOString() : null
    );
    setGlobalEndTime(
      tempGlobalEndTime ? tempGlobalEndTime.toISOString() : null
    );
    setReloadTrigger((prev) => prev + 1);
    setShowPopover(false);
  }, [tempGlobalStartTime, tempGlobalEndTime]);

  const clearRange = useCallback(() => {
    setTempGlobalStartTime(undefined);
    setTempGlobalEndTime(undefined);
    setGlobalStartTime(null);
    setGlobalEndTime(null);
    setReloadTrigger((prev) => prev + 1);
    setShowPopover(false);
  }, []);

  const resetAll = useCallback(() => {
    setGlobalStartTime(null);
    setGlobalEndTime(null);
    setSavedGlobalStartTime(null);
    setSavedGlobalEndTime(null);
    setTempGlobalStartTime(undefined);
    setTempGlobalEndTime(undefined);
  }, []);

  return {
    globalStartTime,
    globalEndTime,
    savedGlobalStartTime,
    savedGlobalEndTime,
    tempGlobalStartTime,
    tempGlobalEndTime,
    showPopover,
    reloadTrigger,
    globalDateRange,
    setGlobalStartTime,
    setGlobalEndTime,
    setSavedGlobalStartTime,
    setSavedGlobalEndTime,
    setTempGlobalStartTime,
    setTempGlobalEndTime,
    setShowPopover,
    applyTempRange,
    clearRange,
    resetAll,
  };
}
