"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { CustomizationPanel as _CustomizationPanel } from "./CustomizationPanel"; // forces type re-export through bundler
import { CollagePreview } from "./CollagePreview";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { useImageExportSettings } from "./hooks/useImageExportSettings";
import { useImageExport } from "./hooks/useImageExport";
import { useCustomTemplates } from "./hooks/useCustomTemplates";
import { useAnnotations } from "./hooks/useAnnotations";
import { useCollageMetrics } from "./hooks/useCollageMetrics";
import { useStudioMode } from "./hooks/useStudioMode";
import { useStudioBrushRange } from "./hooks/useStudioBrushRange";
import { useStudioKeyboardShortcuts } from "./hooks/useStudioKeyboardShortcuts";
import type {
  PresetType,
  PlaygroundChartData,
  CollageMetricData,
} from "./types";
import { cn } from "@/lib/utils";
import { aggregateDataByPeriod, parseDateToTimestamp } from "./studio/period-utils";
import { getPreviewMaxWidth } from "./studio/chart-utils";
import { StudioHeader } from "./studio/StudioHeader";
import { CollageSelectorPanel } from "./studio/CollageSelectorPanel";
import { SingleChartPreview } from "./studio/SingleChartPreview";
import { DateRangeControls } from "./studio/DateRangeControls";
import { CustomizationPanelSection } from "./studio/CustomizationPanelSection";
import { StudioFooter } from "./studio/StudioFooter";
import type { ImageExportStudioProps } from "./studio/types";
import { DATE_RANGE_PRESETS } from "./constants";

void _CustomizationPanel;

// Bridges the studio Dialog to its child components. Owns the load/save/copy
// orchestration plus all template-management handlers; everything else lives
// in dedicated hooks (mode, brush range, keyboard shortcuts) and section
// components (header, selectors, preview, controls, footer).
export function ImageExportStudio({
  isOpen,
  onClose,
  chartData,
  dataArray = [],
  seriesInfo = [],
  period,
  onPeriodChange,
  allowedPeriods = ["D", "W", "M", "Q", "Y"],
  chainId,
  chainName,
  availableMetrics = [],
  playgroundCharts = [],
  initialMode,
}: ImageExportStudioProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Settings + extracted hooks ─────────────────────────────────────────────
  const {
    settings,
    isCustomized,
    setPreset,
    setAspectRatio,
    setPadding,
    setLogo,
    setTitle,
    setBackground,
    setFooter,
    setChartType,
    setTheme,
    setWatermark,
    setChartDisplay,
    setExportQuality,
    setDescription,
    resetToPreset,
  } = useImageExportSettings("default");

  const { isExporting, downloadImage, copyToClipboard } = useImageExport();
  const { toast } = useToast();
  const { resolvedTheme: siteTheme } = useTheme();
  const {
    templates,
    saveTemplate,
    updateTemplate,
    deleteTemplate,
    renameTemplate,
    duplicateTemplate,
    getTemplate,
    exportTemplate,
    exportAllTemplates,
    importTemplates,
    canSaveMore,
    storageError,
    clearStorageError,
  } = useCustomTemplates();
  const {
    annotations,
    activeToolType,
    selectedAnnotationId,
    selectedColor,
    selectedSize,
    selectedOpacity,
    selectedLineStyle,
    selectedArrowheadStyle,
    setActiveToolType,
    setSelectedAnnotationId,
    setSelectedColor,
    setSelectedSize,
    setSelectedOpacity,
    setSelectedLineStyle,
    setSelectedArrowheadStyle,
    addHighlight,
    addText,
    addArrow,
    addFreehand,
    addRectangle,
    updateAnnotation,
    deleteAnnotation,
    clearAllAnnotations,
  } = useAnnotations();

  const mode = useStudioMode({
    initialMode,
    availableMetrics,
    playgroundCharts,
  });

  const { metricsData } = useCollageMetrics(
    chainId,
    mode.selectedMetrics,
    availableMetrics,
    period
  );

  const showCustomizePanel = settings.preset === "customize";

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [copySuccess, setCopySuccess] = useState(false);
  const [capturedAt, setCapturedAt] = useState<Date>(new Date());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isRenamingTemplate, setIsRenamingTemplate] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Sync export theme to site theme on open ────────────────────────────────
  useEffect(() => {
    if (isOpen && siteTheme) {
      setTheme(siteTheme === "dark" ? "dark" : "light");
    }
  }, [isOpen, siteTheme, setTheme]);

  // ── Reset mode on open (smart-default for playground-only inputs) ──────────
  useEffect(() => {
    if (isOpen) {
      if (initialMode) {
        mode.setActiveMode(initialMode);
      } else {
        const hasPlaygroundCharts = playgroundCharts.length >= 2;
        const hasSingleChartData = dataArray.length > 0;
        if (!hasSingleChartData && hasPlaygroundCharts) {
          mode.setActiveMode("collage");
        } else {
          mode.setActiveMode("single");
        }
      }
      setCapturedAt(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  // ── Aggregated playground charts ───────────────────────────────────────────
  // Re-aggregates each playground chart to the current period so all charts
  // stay in sync when the user changes granularity (D/W/M/Q/Y).
  const aggregatedPlaygroundCharts = useMemo(() => {
    if (!mode.isPlaygroundMode || playgroundCharts.length === 0) return [];
    if (!period || period === "D") return playgroundCharts;
    return playgroundCharts.map((chart) => ({
      ...chart,
      data: aggregateDataByPeriod(chart.data, period),
    }));
  }, [mode.isPlaygroundMode, playgroundCharts, period]);

  // Reference data for the brush widget (chosen based on mode).
  const brushReferenceData = useMemo(() => {
    if (!mode.isCollageMode) return dataArray;

    if (mode.isPlaygroundMode && mode.selectedPlaygroundChartIds.length > 0) {
      const firstChart = aggregatedPlaygroundCharts.find(
        (c) => c.id === mode.selectedPlaygroundChartIds[0]
      );
      if (firstChart && firstChart.data.length > 0) return firstChart.data;
    }

    if (mode.selectedMetrics.length > 0) {
      const firstMetric = metricsData.get(mode.selectedMetrics[0]);
      if (firstMetric && firstMetric.data.length > 0) return firstMetric.data;
    }
    return [];
  }, [
    mode.isCollageMode,
    mode.isPlaygroundMode,
    mode.selectedPlaygroundChartIds,
    mode.selectedMetrics,
    aggregatedPlaygroundCharts,
    dataArray,
    metricsData,
  ]);

  const firstCollageMetric = mode.selectedMetrics[0]
    ? metricsData.get(mode.selectedMetrics[0])
    : undefined;

  const brush = useStudioBrushRange({
    isOpen,
    dataArray,
    brushReferenceData,
    isCollageMode: mode.isCollageMode,
    activeMode: mode.activeMode,
    selectedMetricsLength: mode.selectedMetrics.length,
    collageDataLength: firstCollageMetric?.data.length ?? 0,
    collageDataIsLoading: firstCollageMetric?.isLoading ?? false,
    period,
  });

  // ── Display data + cumulative + chart stats ────────────────────────────────
  const displayData = useMemo(() => {
    if (!brush.brushRange || dataArray.length === 0) return dataArray;
    const start = Math.max(
      0,
      Math.min(brush.brushRange.startIndex, dataArray.length - 1)
    );
    const end = Math.max(
      0,
      Math.min(brush.brushRange.endIndex, dataArray.length - 1)
    );
    if (start > end) return dataArray;
    return dataArray.slice(start, end + 1);
  }, [brush.brushRange, dataArray]);

  const displayDataWithCumulative = useMemo(() => {
    if (!settings.chartDisplay.showTotalLine || displayData.length === 0)
      return displayData;
    const series =
      seriesInfo.length > 0
        ? seriesInfo
        : [{ id: "value", name: "Value", color: "#e84142" }];
    const primarySeriesId = series[0]?.id || "value";
    let cumulative = 0;
    return displayData.map((point) => {
      const value = point[primarySeriesId];
      if (typeof value === "number") cumulative += value;
      return { ...point, cumulative };
    });
  }, [displayData, settings.chartDisplay.showTotalLine, seriesInfo]);

  const filteredCollageMetrics = useMemo<CollageMetricData[]>(() => {
    if (
      !mode.isCollageMode ||
      mode.isPlaygroundMode ||
      !brush.brushRange ||
      brushReferenceData.length === 0
    ) {
      return mode.selectedMetrics
        .map((key) => metricsData.get(key))
        .filter((m): m is CollageMetricData => !!m);
    }
    const startDate = brushReferenceData[brush.brushRange.startIndex]?.date;
    const endDate = brushReferenceData[brush.brushRange.endIndex]?.date;
    if (!startDate || !endDate) {
      return mode.selectedMetrics
        .map((key) => metricsData.get(key))
        .filter((m): m is CollageMetricData => !!m);
    }
    return mode.selectedMetrics
      .map((key) => {
        const metric = metricsData.get(key);
        if (!metric) return null;
        const filteredData = metric.data.filter((point) => {
          const pointDate = point.date;
          if (!pointDate) return true;
          return pointDate >= startDate && pointDate <= endDate;
        });
        return { ...metric, data: filteredData };
      })
      .filter((m): m is CollageMetricData => !!m);
  }, [
    mode.isCollageMode,
    mode.isPlaygroundMode,
    brush.brushRange,
    brushReferenceData,
    mode.selectedMetrics,
    metricsData,
  ]);

  // Filter playground charts using each chart's OWN end date so cards with
  // different date ranges still render the correct relative window.
  const filteredPlaygroundCharts = useMemo<PlaygroundChartData[]>(() => {
    if (!mode.isCollageMode || !mode.isPlaygroundMode) return [];

    const selectedCharts = mode.selectedPlaygroundChartIds
      .map((id) => aggregatedPlaygroundCharts.find((c) => c.id === id))
      .filter((c): c is PlaygroundChartData => !!c);

    if (brush.activePreset === "ALL") return selectedCharts;

    const presetConfig = DATE_RANGE_PRESETS.find((p) => p.id === brush.activePreset);
    if (!presetConfig?.days) return selectedCharts;

    const presetMs = presetConfig.days * 24 * 60 * 60 * 1000;
    return selectedCharts.map((chart) => {
      if (chart.data.length === 0) return chart;
      const chartEndDate = chart.data[chart.data.length - 1]?.date;
      const endTimestamp = parseDateToTimestamp(chartEndDate);
      if (endTimestamp === null) return chart;
      const startTimestamp = endTimestamp - presetMs;
      const filteredData = chart.data.filter((point) => {
        const pointTimestamp = parseDateToTimestamp(point.date);
        if (pointTimestamp === null) return true;
        return pointTimestamp >= startTimestamp && pointTimestamp <= endTimestamp;
      });
      return { ...chart, data: filteredData };
    });
  }, [
    mode.isCollageMode,
    mode.isPlaygroundMode,
    mode.selectedPlaygroundChartIds,
    aggregatedPlaygroundCharts,
    brush.activePreset,
  ]);

  // Re-shape playground charts as CollageMetricData entries.
  const playgroundChartsAsMetrics = useMemo<CollageMetricData[]>(() => {
    if (!mode.isPlaygroundMode) return [];
    return filteredPlaygroundCharts.map((chart) => {
      const primaryColor =
        chart.color || chart.seriesInfo[0]?.color || "#e84142";
      const firstSeriesId = chart.seriesInfo[0]?.id || "value";
      const transformedData = chart.data.map((point) => ({
        date: point.date,
        value:
          typeof point[firstSeriesId] === "number"
            ? (point[firstSeriesId] as number)
            : (point.value as number | undefined),
      }));
      return {
        config: {
          metricKey: chart.id,
          title: chart.title,
          description: chart.seriesInfo.map((s) => s.name).join(", "),
          color: primaryColor,
        },
        data: transformedData,
        isLoading: false,
        error: undefined,
      };
    });
  }, [mode.isPlaygroundMode, filteredPlaygroundCharts]);

  const collageMetricsForPreview = mode.isPlaygroundMode
    ? playgroundChartsAsMetrics
    : filteredCollageMetrics;

  const chartStats = useMemo(() => {
    if (displayData.length === 0) return null;
    const series =
      seriesInfo.length > 0
        ? seriesInfo
        : [{ id: "value", name: "Value", color: "#e84142" }];

    const allStats = series
      .map((s) => {
        const values = displayData
          .map((d) => {
            const val = d[s.id];
            return typeof val === "number" ? val : null;
          })
          .filter((v): v is number => v !== null);
        if (values.length === 0) return null;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const firstVal = values[0];
        const lastVal = values[values.length - 1];
        const percentChange =
          firstVal !== 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
        const trend: "up" | "down" | "neutral" =
          percentChange > 1 ? "up" : percentChange < -1 ? "down" : "neutral";

        return {
          seriesId: s.id,
          seriesName: s.name,
          seriesColor: s.color,
          min,
          max,
          avg,
          percentChange,
          trend,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (allStats.length === 0) return null;

    const cumulativeTotal = settings.chartDisplay.showTotalLine
      ? (displayDataWithCumulative[displayDataWithCumulative.length - 1]
          ?.cumulative as number | undefined)
      : undefined;

    return { ...allStats[0], allSeries: allStats, cumulativeTotal };
  }, [
    displayData,
    seriesInfo,
    settings.chartDisplay.showTotalLine,
    displayDataWithCumulative,
  ]);

  const primaryColor = useMemo(() => {
    if (mode.isPlaygroundMode && mode.selectedPlaygroundChartIds.length > 0) {
      const firstChart = playgroundCharts.find(
        (c) => c.id === mode.selectedPlaygroundChartIds[0]
      );
      return (
        firstChart?.color || firstChart?.seriesInfo[0]?.color || "#e84142"
      );
    }
    return seriesInfo[0]?.color || "#e84142";
  }, [
    mode.isPlaygroundMode,
    mode.selectedPlaygroundChartIds,
    playgroundCharts,
    seriesInfo,
  ]);

  // ── Template handlers ──────────────────────────────────────────────────────
  const handlePresetChange = useCallback(
    (preset: PresetType | string) => {
      if (typeof preset === "string" && preset.startsWith("custom-")) {
        const template = getTemplate(preset);
        if (template) {
          // Apply all settings from the template (preserve template's saved theme).
          setPreset("customize");
          setSelectedTemplateId(preset);
          setAspectRatio(template.settings.aspectRatio);
          setPadding(template.settings.padding);
          setLogo(template.settings.logo);
          setTitle(template.settings.title);
          setBackground(template.settings.background);
          setFooter(template.settings.footer);
          setChartType(template.settings.chartType);
          setTheme(template.settings.theme);
          setWatermark(template.settings.watermark);
          setChartDisplay(template.settings.chartDisplay);
          setExportQuality(template.settings.exportQuality);
        }
      } else {
        setPreset(preset as PresetType);
        setSelectedTemplateId(null);
        // Re-apply site theme after preset change (presets ship with their
        // own theme, but we want the dialog to match the host page).
        if (siteTheme) {
          setTheme(siteTheme === "dark" ? "dark" : "light");
        }
      }
    },
    [
      setPreset,
      setAspectRatio,
      setPadding,
      setLogo,
      setTitle,
      setBackground,
      setFooter,
      setChartType,
      setTheme,
      setWatermark,
      setChartDisplay,
      setExportQuality,
      getTemplate,
      siteTheme,
    ]
  );

  const handleSaveTemplate = useCallback(() => {
    if (selectedTemplateId) {
      updateTemplate(selectedTemplateId, settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
      const template = templates.find((t) => t.id === selectedTemplateId);
      toast({
        title: "Template updated",
        description: `"${template?.name}" has been saved`,
        variant: "success",
        duration: 2000,
      });
    } else {
      setNewTemplateName(`My Template ${templates.length + 1}`);
      setIsCreatingTemplate(true);
    }
  }, [settings, updateTemplate, selectedTemplateId, templates, toast]);

  const handleCreateTemplate = useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      if (trimmedName) {
        const newId = saveTemplate(trimmedName, settings);
        setSelectedTemplateId(newId);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 1500);
        toast({
          title: "Template created!",
          description: `"${trimmedName}" is now available in presets`,
          variant: "success",
          duration: 2000,
        });
      }
      setIsCreatingTemplate(false);
      setNewTemplateName("");
    },
    [settings, saveTemplate, toast]
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      deleteTemplate(id);
      if (selectedTemplateId === id) setSelectedTemplateId(null);
      toast({ title: "Template deleted", duration: 2000 });
    },
    [deleteTemplate, selectedTemplateId, toast]
  );

  const handleRenameTemplate = useCallback(
    (id: string, newName: string) => {
      renameTemplate(id, newName);
      toast({ title: "Template renamed", duration: 2000 });
    },
    [renameTemplate, toast]
  );

  const handleDuplicateTemplate = useCallback(
    (id: string) => {
      const newId = duplicateTemplate(id);
      if (newId) {
        toast({ title: "Template duplicated", duration: 2000 });
      } else {
        toast({
          title: "Cannot duplicate",
          description: "Maximum number of templates reached",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [duplicateTemplate, toast]
  );

  const handleExportTemplate = useCallback(
    (id: string) => {
      const json = exportTemplate(id);
      if (!json) return;
      const template = templates.find((t) => t.id === id);
      const filename = `template-${template?.name.replace(/\s+/g, "-").toLowerCase() || "export"}.json`;
      downloadJson(json, filename);
      toast({
        title: "Template exported",
        description: `Saved as ${filename}`,
        duration: 2000,
      });
    },
    [exportTemplate, templates, toast]
  );

  const handleExportAllTemplates = useCallback(() => {
    if (templates.length === 0) {
      toast({
        title: "No templates to export",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    const json = exportAllTemplates();
    const filename = `image-studio-templates-${new Date().toISOString().split("T")[0]}.json`;
    downloadJson(json, filename);
    toast({
      title: "Templates exported",
      description: `Exported ${templates.length} template${templates.length > 1 ? "s" : ""}`,
      duration: 2000,
    });
  }, [exportAllTemplates, templates.length, toast]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith(".json")) {
        toast({
          title: "Invalid file type",
          description: "Please select a JSON file",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result;
          if (typeof content !== "string") throw new Error("Failed to read file content");
          const result = importTemplates(content);
          if (result.error) {
            toast({
              title: "Import failed",
              description: result.error,
              variant: "destructive",
              duration: 3000,
            });
          } else if (result.success > 0) {
            toast({
              title: "Templates imported",
              description: `Imported ${result.success} template${result.success > 1 ? "s" : ""}${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
              variant: "success",
              duration: 3000,
            });
          }
        } catch {
          toast({
            title: "Import failed",
            description: "Could not read file content",
            variant: "destructive",
            duration: 3000,
          });
        }
      };
      reader.onerror = () =>
        toast({
          title: "Import failed",
          description: "Error reading file",
          variant: "destructive",
          duration: 3000,
        });
      reader.readAsText(file);
      // Reset so the same file can be selected again.
      e.target.value = "";
    },
    [importTemplates, toast]
  );

  // ── Export ─────────────────────────────────────────────────────────────────
  const prepareForExport = useCallback(async () => {
    setSelectedAnnotationId(null);
    setCapturedAt(new Date());
    // Brief delay so React commits the deselection before we capture.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, [setSelectedAnnotationId]);

  const handleSave = useCallback(async () => {
    await prepareForExport();
    const filename = chartData.title?.replace(/\s+/g, "_") || "chart";
    await downloadImage(exportRef.current, filename, settings.exportQuality);
  }, [prepareForExport, chartData.title, downloadImage, settings.exportQuality]);

  const handleCopy = useCallback(async () => {
    await prepareForExport();
    const success = await copyToClipboard(exportRef.current, settings.exportQuality);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast({
        title: "Image copied!",
        description: "Ready to paste anywhere",
        variant: "success",
        duration: 2000,
      });
    }
  }, [prepareForExport, copyToClipboard, settings.exportQuality, toast]);

  // Reset copy-success flag when modal closes.
  useEffect(() => {
    if (!isOpen) setCopySuccess(false);
  }, [isOpen]);

  // Surface storage errors via toast.
  useEffect(() => {
    if (storageError) {
      toast({
        title: "Storage error",
        description: storageError,
        variant: "destructive",
        duration: 4000,
      });
      clearStorageError();
    }
  }, [storageError, toast, clearStorageError]);

  // Keyboard shortcuts (Cmd+S/C, presets, chart type, display flags, annotation nudges).
  useStudioKeyboardShortcuts({
    isOpen,
    onSave: handleSave,
    onCopy: handleCopy,
    onPresetChange: handlePresetChange,
    templates,
    setChartType,
    setChartDisplay,
    chartDisplay: settings.chartDisplay,
    selectedAnnotationId,
    annotations,
    deleteAnnotation,
    updateAnnotation,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const previewMaxWidth = getPreviewMaxWidth(
    settings.aspectRatio,
    mode.customAspectRatio
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          clearAllAnnotations();
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn(
          "max-w-[95vw] max-h-[90vh] p-0 gap-0 bg-background border flex flex-col",
          showCustomizePanel ? "sm:max-w-[1100px]" : "sm:max-w-[800px]"
        )}
        hideCloseButton
      >
        <StudioHeader
          hasCollageMode={mode.hasCollageMode}
          activeMode={mode.activeMode}
          onModeChange={(m) => {
            if (mode.activeMode !== m) {
              clearAllAnnotations();
              mode.setActiveMode(m);
            }
          }}
          period={period}
          allowedPeriods={allowedPeriods}
          onPeriodChange={onPeriodChange}
          chartType={settings.chartType}
          onChartTypeChange={setChartType}
          showCustomizePanel={showCustomizePanel}
          selectedPreset={settings.preset}
          selectedTemplateId={selectedTemplateId}
          templates={templates}
          onPresetChange={handlePresetChange}
          isRenamingTemplate={isRenamingTemplate}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onConfirmRename={() => {
            if (selectedTemplateId && renameValue.trim()) {
              handleRenameTemplate(selectedTemplateId, renameValue.trim());
            }
            setIsRenamingTemplate(false);
            setRenameValue("");
          }}
          onCancelRename={() => {
            setIsRenamingTemplate(false);
            setRenameValue("");
          }}
          onStartRename={() => {
            const template = templates.find((t) => t.id === selectedTemplateId);
            if (template) {
              setRenameValue(template.name);
              setIsRenamingTemplate(true);
            }
          }}
          isCreatingTemplate={isCreatingTemplate}
          newTemplateName={newTemplateName}
          onNewTemplateNameChange={setNewTemplateName}
          onConfirmCreate={() => handleCreateTemplate(newTemplateName)}
          onCancelCreate={() => {
            setIsCreatingTemplate(false);
            setNewTemplateName("");
          }}
          canSaveMore={canSaveMore}
          saveSuccess={saveSuccess}
          onSaveTemplate={handleSaveTemplate}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onExportTemplate={handleExportTemplate}
          onExportAllTemplates={handleExportAllTemplates}
          onImportClick={() => fileInputRef.current?.click()}
          onClose={onClose}
        />

        {/* Hidden file input for template imports — colocated with the menu trigger. */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />

        {mode.isCollageMode && (
          <CollageSelectorPanel
            isPlaygroundMode={mode.isPlaygroundMode}
            availableMetrics={availableMetrics}
            selectedMetrics={mode.selectedMetrics}
            onMetricSelectionChange={mode.setSelectedMetrics}
            metricsData={metricsData}
            playgroundCharts={playgroundCharts}
            selectedPlaygroundChartIds={mode.selectedPlaygroundChartIds}
            onPlaygroundSelectionChange={mode.setSelectedPlaygroundChartIds}
            mobileExpanded={mode.mobileMetricsExpanded}
            onMobileExpandedChange={mode.setMobileMetricsExpanded}
          />
        )}

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Preview area */}
          <div className="flex-1 p-5 overflow-auto flex flex-col bg-muted/30">
            {mode.isCollageMode ? (
              <div className={cn("w-full mx-auto", previewMaxWidth)}>
                <div ref={exportRef} className="relative">
                  <CollagePreview
                    metrics={collageMetricsForPreview}
                    settings={settings}
                    collageSettings={mode.collageSettings}
                    chainName={mode.isPlaygroundMode ? "Playground" : chainName}
                    period={period}
                    pageUrl={chartData.pageUrl}
                    capturedAt={capturedAt}
                  />
                  {(annotations.length > 0 ||
                    (showCustomizePanel && activeToolType)) && (
                    <AnnotationOverlay
                      annotations={annotations}
                      activeToolType={showCustomizePanel ? activeToolType : null}
                      selectedAnnotationId={selectedAnnotationId}
                      selectedColor={selectedColor}
                      onAddHighlight={addHighlight}
                      onAddText={addText}
                      onAddArrow={addArrow}
                      onAddFreehand={addFreehand}
                      onAddRectangle={addRectangle}
                      onSelectAnnotation={setSelectedAnnotationId}
                      onUpdateAnnotation={updateAnnotation}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className={cn("w-full mx-auto", previewMaxWidth)}>
                <div ref={exportRef} className="relative">
                  <SingleChartPreview
                    settings={settings}
                    chartData={chartData}
                    dataArray={dataArray}
                    displayDataWithCumulative={displayDataWithCumulative}
                    seriesInfo={seriesInfo}
                    chartStats={chartStats}
                    capturedAt={capturedAt}
                    period={period}
                  />
                  {(annotations.length > 0 ||
                    (showCustomizePanel && activeToolType)) && (
                    <AnnotationOverlay
                      annotations={annotations}
                      activeToolType={showCustomizePanel ? activeToolType : null}
                      selectedAnnotationId={selectedAnnotationId}
                      selectedColor={selectedColor}
                      onAddHighlight={addHighlight}
                      onAddText={addText}
                      onAddArrow={addArrow}
                      onAddFreehand={addFreehand}
                      onAddRectangle={addRectangle}
                      onSelectAnnotation={setSelectedAnnotationId}
                      onUpdateAnnotation={updateAnnotation}
                    />
                  )}
                </div>
              </div>
            )}

            <DateRangeControls
              brushReferenceData={brushReferenceData}
              isCollageMode={mode.isCollageMode}
              seriesInfo={seriesInfo}
              primaryColor={primaryColor}
              period={period}
              activePreset={brush.activePreset}
              safeBrushRange={brush.safeBrushRange}
              onPresetChange={brush.handleDateRangePreset}
              onBrushChange={brush.setBrushRange}
              onManualBrushChange={() => brush.setActivePreset("ALL")}
            />
          </div>

          {showCustomizePanel && (
            <CustomizationPanelSection
              settings={settings}
              isCustomized={isCustomized}
              isCollageMode={mode.isCollageMode}
              collageMetricCount={mode.selectedMetrics.length}
              collageGridLayout={mode.collageSettings.gridLayout}
              onCollageGridLayoutChange={(layout) =>
                mode.setCollageSettings((prev) => ({
                  ...prev,
                  gridLayout: layout,
                }))
              }
              onAspectRatioChange={setAspectRatio}
              customAspectRatio={mode.customAspectRatio}
              onCustomAspectRatioChange={mode.setCustomAspectRatio}
              onPaddingChange={setPadding}
              onLogoChange={setLogo}
              onTitleChange={setTitle}
              onBackgroundChange={setBackground}
              onFooterChange={setFooter}
              onThemeChange={setTheme}
              onWatermarkChange={setWatermark}
              onChartDisplayChange={setChartDisplay}
              onExportQualityChange={setExportQuality}
              onDescriptionChange={setDescription}
              onReset={resetToPreset}
              annotations={annotations}
              activeToolType={activeToolType}
              selectedAnnotationId={selectedAnnotationId}
              selectedColor={selectedColor}
              selectedSize={selectedSize}
              selectedOpacity={selectedOpacity}
              selectedLineStyle={selectedLineStyle}
              selectedArrowheadStyle={selectedArrowheadStyle}
              onAnnotationToolSelect={setActiveToolType}
              onAnnotationSelect={setSelectedAnnotationId}
              onAnnotationColorChange={setSelectedColor}
              onAnnotationSizeChange={setSelectedSize}
              onAnnotationOpacityChange={setSelectedOpacity}
              onAnnotationLineStyleChange={setSelectedLineStyle}
              onAnnotationArrowheadStyleChange={setSelectedArrowheadStyle}
              onUpdateAnnotation={updateAnnotation}
              onDeleteAnnotation={deleteAnnotation}
              onClearAllAnnotations={clearAllAnnotations}
              mobileExpanded={mode.mobileCustomizeExpanded}
              onMobileExpandedChange={mode.setMobileCustomizeExpanded}
            />
          )}
        </div>

        <StudioFooter
          isExporting={isExporting}
          copySuccess={copySuccess}
          onSave={handleSave}
          onCopy={handleCopy}
        />
      </DialogContent>
    </Dialog>
  );
}

// Trigger a download of the given JSON string. Pulled out of the template
// export handlers to keep them shorter.
function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
