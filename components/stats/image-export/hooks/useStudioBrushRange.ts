"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrushRange, DateRangePreset, ExportMode, Period } from "../types";
import { DATE_RANGE_PRESETS } from "../constants";
import {
  calculateDataPointsForPreset,
  getDefaultBrushRange,
} from "../studio/period-utils";
import type { ChartDataPoint } from "../studio/types";

interface UseStudioBrushRangeOptions {
  isOpen: boolean;
  dataArray: ChartDataPoint[];
  brushReferenceData: ChartDataPoint[];
  isCollageMode: boolean;
  activeMode: ExportMode;
  selectedMetricsLength: number;
  collageDataLength: number;
  collageDataIsLoading: boolean;
  period: Period | undefined;
}

// Owns the date-range brush state and the three effects that keep it in sync
// with mode/period changes. The page-level component just reads the current
// `safeBrushRange` and calls `handleDateRangePreset` when the user clicks a
// preset chip.
export function useStudioBrushRange({
  isOpen,
  dataArray,
  brushReferenceData,
  isCollageMode,
  activeMode,
  selectedMetricsLength,
  collageDataLength,
  collageDataIsLoading,
  period,
}: UseStudioBrushRangeOptions) {
  const [brushRange, setBrushRange] = useState<BrushRange | null>(null);
  const [activePreset, setActivePreset] = useState<DateRangePreset>("ALL");

  // Track previous values so we can detect "data changed because period
  // changed" vs "first load" vs "mode switch".
  const prevDataLengthRef = useRef<number>(0);
  const prevCollageDataLengthRef = useRef<number>(0);
  const prevModeRef = useRef<ExportMode>(activeMode);

  // Reset brush + preset when the modal opens.
  useEffect(() => {
    if (isOpen && dataArray.length > 0) {
      const range = getDefaultBrushRange(dataArray.length, period);
      setBrushRange(range);
      setActivePreset("3M");
      prevDataLengthRef.current = dataArray.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When dataArray length changes (period change), recalculate the brush
  // window relative to the active preset.
  useEffect(() => {
    if (!isOpen || dataArray.length === 0) return;

    if (prevDataLengthRef.current === 0) {
      prevDataLengthRef.current = dataArray.length;
      return;
    }

    if (prevDataLengthRef.current !== dataArray.length) {
      const endIndex = dataArray.length - 1;
      const presetConfig = DATE_RANGE_PRESETS.find((p) => p.id === activePreset);
      let startIndex = 0;
      if (presetConfig?.days) {
        const dataPoints = calculateDataPointsForPreset(presetConfig.days, period);
        if (dataPoints) {
          startIndex = Math.max(0, endIndex - dataPoints + 1);
        }
      }
      setBrushRange({ startIndex, endIndex });
      prevDataLengthRef.current = dataArray.length;
    }
  }, [isOpen, dataArray.length, activePreset, period]);

  // Re-init the brush when switching between single/collage modes, or when
  // collage data changes due to a period change.
  useEffect(() => {
    if (!isOpen) return;

    const modeChanged = prevModeRef.current !== activeMode;
    prevModeRef.current = activeMode;

    if (isCollageMode) {
      if (selectedMetricsLength > 0 && collageDataLength > 0 && !collageDataIsLoading) {
        const collageDataChanged =
          prevCollageDataLengthRef.current !== collageDataLength &&
          prevCollageDataLengthRef.current > 0;

        if (modeChanged) {
          // Switching to collage — reset to 3M.
          const range = getDefaultBrushRange(collageDataLength, period);
          setBrushRange(range);
          setActivePreset("3M");
        } else if (collageDataChanged) {
          // Period changed in collage — recalculate based on current preset.
          const endIndex = collageDataLength - 1;
          const presetConfig = DATE_RANGE_PRESETS.find((p) => p.id === activePreset);
          let startIndex = 0;
          if (presetConfig?.days) {
            const dataPoints = calculateDataPointsForPreset(presetConfig.days, period);
            if (dataPoints) {
              startIndex = Math.max(0, endIndex - dataPoints + 1);
            }
          }
          setBrushRange({ startIndex, endIndex });
        }
        prevCollageDataLengthRef.current = collageDataLength;
      }
    } else if (dataArray.length > 0 && modeChanged) {
      // Switching to single — reset to 3M.
      const range = getDefaultBrushRange(dataArray.length, period);
      setBrushRange(range);
      setActivePreset("3M");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isCollageMode,
    selectedMetricsLength,
    collageDataLength,
    collageDataIsLoading,
    activeMode,
  ]);

  const handleDateRangePreset = useCallback(
    (preset: DateRangePreset) => {
      if (brushReferenceData.length === 0) return;
      const endIndex = brushReferenceData.length - 1;
      const presetConfig = DATE_RANGE_PRESETS.find((p) => p.id === preset);
      let startIndex = 0;
      if (presetConfig?.days) {
        const dataPoints = calculateDataPointsForPreset(presetConfig.days, period);
        if (dataPoints) {
          startIndex = Math.max(0, endIndex - dataPoints + 1);
        }
      }
      setBrushRange({ startIndex, endIndex });
      setActivePreset(preset);
    },
    [brushReferenceData.length, period]
  );

  // Clamp the brush indices to the current reference data length so we can't
  // hand recharts an out-of-range value if the data shrinks.
  const safeBrushRange = useMemo(() => {
    const maxIndex = Math.max(0, brushReferenceData.length - 1);
    if (!brushRange) {
      return { startIndex: 0, endIndex: maxIndex };
    }
    return {
      startIndex: Math.max(0, Math.min(brushRange.startIndex, maxIndex)),
      endIndex: Math.max(0, Math.min(brushRange.endIndex, maxIndex)),
    };
  }, [brushRange, brushReferenceData.length]);

  return {
    brushRange,
    setBrushRange,
    activePreset,
    setActivePreset,
    handleDateRangePreset,
    safeBrushRange,
  };
}
