"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { X, Download, Copy, Loader2, TrendingUp, BarChart3, AreaChart, HelpCircle, Save, Settings2, Pencil, Trash2, Check, Upload, FileDown, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Brush,
  LabelList,
  ReferenceLine,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { PresetSelector } from "./PresetSelector";
import { CustomizationPanel } from "./CustomizationPanel";
import { ImagePreview } from "./ImagePreview";
import { CollagePreview } from "./CollagePreview";
import { CollageMetricSelector } from "./CollageMetricSelector";
import { useImageExportSettings } from "./hooks/useImageExportSettings";
import { useImageExport } from "./hooks/useImageExport";
import { useCustomTemplates } from "./hooks/useCustomTemplates";
import { useAnnotations } from "./hooks/useAnnotations";
import { useCollageMetrics } from "./hooks/useCollageMetrics";
import { AnnotationOverlay } from "./AnnotationOverlay";
import type { ChartExportData, PresetType, Period, ChartType, DateRangePreset, BrushRange, ExportMode, CollageMetricConfig, CollageSettings, CustomAspectRatio } from "./types";
import { DATE_RANGE_PRESETS } from "./constants";
import { cn } from "@/lib/utils";
import { ChartWatermark } from "@/components/stats/ChartWatermark";

// Chart data point interface
interface ChartDataPoint {
  date?: string;
  day?: string;
  value?: number;
  [key: string]: string | number | undefined;
}

// Series info for multi-series charts
interface SeriesInfo {
  id: string;
  name: string;
  color: string;
  yAxis?: string;
}

interface ImageExportStudioProps {
  isOpen: boolean;
  onClose: () => void;
  chartData: ChartExportData;
  // Chart data array for rendering
  dataArray?: ChartDataPoint[];
  seriesInfo?: SeriesInfo[];
  // Period selector props
  period?: Period;
  onPeriodChange?: (period: Period) => void;
  allowedPeriods?: Period[];
  // Collage mode props
  chainId?: string;
  chainName?: string;
  availableMetrics?: CollageMetricConfig[];
}

const CHART_TYPE_ICONS: Record<ChartType, React.ReactNode> = {
  line: <TrendingUp className="h-4 w-4" />,
  bar: <BarChart3 className="h-4 w-4" />,
  area: <AreaChart className="h-4 w-4" />,
};

// Keyboard shortcuts for the help tooltip
const KEYBOARD_SHORTCUTS = [
  { keys: ["⌘", "S"], description: "Save image" },
  { keys: ["⌘", "C"], description: "Copy image" },
  { keys: ["1-9"], description: "Presets & templates" },
  { keys: ["L", "B", "A"], description: "Chart type" },
  { keys: ["G"], description: "Toggle grid" },
  { keys: ["D"], description: "Toggle labels" },
  { keys: ["R"], description: "Avg reference" },
  { keys: ["T"], description: "Total line" },
  { keys: ["Del"], description: "Delete annotation" },
  { keys: ["↑↓←→"], description: "Nudge annotation" },
];

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
}: ImageExportStudioProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const { templates, saveTemplate, updateTemplate, deleteTemplate, renameTemplate, duplicateTemplate, getTemplate, exportTemplate, exportAllTemplates, importTemplates, canSaveMore, storageError, clearStorageError } = useCustomTemplates();
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [brushRange, setBrushRange] = useState<BrushRange | null>(null);
  const [activePreset, setActivePreset] = useState<DateRangePreset>("ALL");
  const [capturedAt, setCapturedAt] = useState<Date>(new Date());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isRenamingTemplate, setIsRenamingTemplate] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Collage mode state
  const [activeMode, setActiveMode] = useState<ExportMode>("single");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [collageSettings, setCollageSettings] = useState<CollageSettings>({
    showIndividualTitles: true,
    chartSpacing: 8,
  });

  // Custom aspect ratio state
  const [customAspectRatio, setCustomAspectRatio] = useState<CustomAspectRatio>({
    width: 1280,
    height: 720,
  });

  // Mobile collapsible section state
  const [mobileMetricsExpanded, setMobileMetricsExpanded] = useState(false);
  const [mobileCustomizeExpanded, setMobileCustomizeExpanded] = useState(false);

  // Collage metrics data hook
  const { metricsData } = useCollageMetrics(
    chainId,
    selectedMetrics,
    availableMetrics,
    period
  );

  // Check if collage mode is available
  const hasCollageMode = availableMetrics.length > 0;
  const isCollageMode = activeMode === "collage";

  const showCustomizePanel = settings.preset === "customize";

  // Get default brush range based on period - show last 3 months by default
  const getDefaultBrushRange = (dataLength: number, currentPeriod: Period | undefined) => {
    const endIndex = dataLength - 1;
    // Default to 3 months (90 days)
    const defaultDays = 90;
    let dataPoints: number;

    const p = currentPeriod || "D";
    switch (p) {
      case "D":
        dataPoints = defaultDays;
        break;
      case "W":
        dataPoints = Math.ceil(defaultDays / 7);
        break;
      case "M":
        dataPoints = 3; // 3 months
        break;
      case "Q":
        dataPoints = 1; // 1 quarter is ~3 months
        break;
      case "Y":
        dataPoints = 1; // Show at least 1 year
        break;
      default:
        dataPoints = defaultDays;
    }

    const startIndex = Math.max(0, endIndex - dataPoints + 1);
    return { startIndex, endIndex };
  };

  // Track previous data length to detect period changes
  const prevDataLengthRef = useRef<number>(0);
  // Track previous collage data length to detect period changes in collage mode
  const prevCollageDataLengthRef = useRef<number>(0);
  // Track previous mode to detect mode switches (single↔collage)
  const prevModeRef = useRef<ExportMode>(activeMode);

  // Auto-set export theme based on site theme when modal opens
  useEffect(() => {
    if (isOpen && siteTheme) {
      setTheme(siteTheme === "dark" ? "dark" : "light");
    }
  }, [isOpen, siteTheme, setTheme]);

  // Reset brush range and capture date when modal opens
  useEffect(() => {
    if (isOpen && dataArray.length > 0) {
      const range = getDefaultBrushRange(dataArray.length, period);
      setBrushRange(range);
      setActivePreset("3M");
      setCapturedAt(new Date());
      prevDataLengthRef.current = dataArray.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // When dataArray changes (period change), recalculate brush range based on current preset
  useEffect(() => {
    if (!isOpen || dataArray.length === 0) return;

    // Skip if this is the initial load (handled by isOpen effect)
    if (prevDataLengthRef.current === 0) {
      prevDataLengthRef.current = dataArray.length;
      return;
    }

    // Data changed (likely due to period change) - recalculate brush based on active preset
    if (prevDataLengthRef.current !== dataArray.length) {
      const endIndex = dataArray.length - 1;
      const presetConfig = DATE_RANGE_PRESETS.find(p => p.id === activePreset);

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

  // Re-initialize brush range when switching between single/collage modes
  // or when collage data changes due to period change
  useEffect(() => {
    if (!isOpen) return;

    // Only reset to 3M when actually switching modes, not when data updates
    const modeChanged = prevModeRef.current !== activeMode;
    prevModeRef.current = activeMode;

    if (isCollageMode) {
      // In collage mode, wait for first metric data to be available
      if (selectedMetrics.length > 0) {
        const firstMetric = metricsData.get(selectedMetrics[0]);
        if (firstMetric && firstMetric.data.length > 0 && !firstMetric.isLoading) {
          const collageDataLength = firstMetric.data.length;
          const collageDataChanged = prevCollageDataLengthRef.current !== collageDataLength && prevCollageDataLengthRef.current > 0;

          if (modeChanged) {
            // Switching to collage mode - reset to 3M
            const range = getDefaultBrushRange(collageDataLength, period);
            setBrushRange(range);
            setActivePreset("3M");
          } else if (collageDataChanged) {
            // Period changed in collage mode - recalculate brush based on current preset
            const endIndex = collageDataLength - 1;
            const presetConfig = DATE_RANGE_PRESETS.find(p => p.id === activePreset);

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
      }
    } else {
      // In single mode
      if (dataArray.length > 0 && modeChanged) {
        // Switching to single mode - reset to 3M
        const range = getDefaultBrushRange(dataArray.length, period);
        setBrushRange(range);
        setActivePreset("3M");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollageMode, selectedMetrics.length, metricsData, activeMode, activePreset, period]);

  // Calculate data points for a preset based on the current period
  const calculateDataPointsForPreset = (days: number | null, currentPeriod: Period | undefined) => {
    if (!days) return null; // ALL preset

    const p = currentPeriod || "D";
    switch (p) {
      case "D":
        return days;
      case "W":
        return Math.ceil(days / 7);
      case "M":
        return Math.ceil(days / 30);
      case "Q":
        return Math.ceil(days / 90);
      case "Y":
        return Math.ceil(days / 365);
      default:
        return days;
    }
  };

  // Get reference data for brush (single mode: dataArray, collage mode: first metric's data)
  const brushReferenceData = useMemo(() => {
    if (!isCollageMode) return dataArray;

    // For collage mode, use the first selected metric's data as reference
    if (selectedMetrics.length > 0) {
      const firstMetric = metricsData.get(selectedMetrics[0]);
      if (firstMetric && firstMetric.data.length > 0) {
        return firstMetric.data;
      }
    }
    return [];
  }, [isCollageMode, dataArray, selectedMetrics, metricsData]);

  // Handle date range preset change (works with both single and collage modes)
  const handleDateRangePreset = (preset: DateRangePreset) => {
    if (brushReferenceData.length === 0) return;

    const endIndex = brushReferenceData.length - 1;
    const presetConfig = DATE_RANGE_PRESETS.find(p => p.id === preset);

    let startIndex = 0;
    if (presetConfig?.days) {
      // Convert days to data points based on period
      const dataPoints = calculateDataPointsForPreset(presetConfig.days, period);
      if (dataPoints) {
        startIndex = Math.max(0, endIndex - dataPoints + 1);
      }
    }

    setBrushRange({ startIndex, endIndex });
    setActivePreset(preset);
  };

  // Compute display data based on brush range
  const displayData = useMemo(() => {
    if (!brushRange || dataArray.length === 0) return dataArray;

    const start = Math.max(0, Math.min(brushRange.startIndex, dataArray.length - 1));
    const end = Math.max(0, Math.min(brushRange.endIndex, dataArray.length - 1));

    if (start > end) return dataArray;
    return dataArray.slice(start, end + 1);
  }, [brushRange, dataArray]);

  // Compute display data with cumulative totals for the Total line feature
  const displayDataWithCumulative = useMemo(() => {
    if (!settings.chartDisplay.showTotalLine || displayData.length === 0) return displayData;

    const series = seriesInfo.length > 0 ? seriesInfo : [{ id: "value", name: "Value", color: "#e84142" }];
    // Use the first series for cumulative calculation
    const primarySeriesId = series[0]?.id || "value";

    let cumulative = 0;
    return displayData.map((point) => {
      const value = point[primarySeriesId];
      if (typeof value === "number") {
        cumulative += value;
      }
      return {
        ...point,
        cumulative,
      };
    });
  }, [displayData, settings.chartDisplay.showTotalLine, seriesInfo]);

  // Compute filtered collage metrics based on brush range
  const filteredCollageMetrics = useMemo(() => {
    if (!isCollageMode || !brushRange || brushReferenceData.length === 0) {
      return selectedMetrics.map((key) => metricsData.get(key)).filter((m): m is NonNullable<typeof m> => !!m);
    }

    // Get the date range from the brush reference data
    const startDate = brushReferenceData[brushRange.startIndex]?.date;
    const endDate = brushReferenceData[brushRange.endIndex]?.date;

    if (!startDate || !endDate) {
      return selectedMetrics.map((key) => metricsData.get(key)).filter((m): m is NonNullable<typeof m> => !!m);
    }

    // Filter each metric's data to the date range
    return selectedMetrics.map((key) => {
      const metric = metricsData.get(key);
      if (!metric) return null;

      const filteredData = metric.data.filter((point) => {
        const pointDate = point.date;
        if (!pointDate) return true;
        return pointDate >= startDate && pointDate <= endDate;
      });

      return {
        ...metric,
        data: filteredData,
      };
    }).filter((m): m is NonNullable<typeof m> => !!m);
  }, [isCollageMode, brushRange, brushReferenceData, selectedMetrics, metricsData]);

  // Calculate chart stats from display data for all series
  const chartStats = useMemo(() => {
    if (displayData.length === 0) return null;

    const series = seriesInfo.length > 0 ? seriesInfo : [{ id: "value", name: "Value", color: "#e84142" }];

    const allStats = series.map((s) => {
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

      // Calculate percent change (first to last)
      const firstVal = values[0];
      const lastVal = values[values.length - 1];
      const percentChange = firstVal !== 0
        ? ((lastVal - firstVal) / firstVal) * 100
        : 0;

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
        trend
      };
    }).filter((s): s is NonNullable<typeof s> => s !== null);

    if (allStats.length === 0) return null;

    // Calculate cumulative total if Total line is enabled
    const cumulativeTotal = settings.chartDisplay.showTotalLine
      ? displayDataWithCumulative[displayDataWithCumulative.length - 1]?.cumulative as number | undefined
      : undefined;

    // Return primary stats for backwards compatibility, plus all series stats
    const primary = allStats[0];
    return {
      ...primary,
      allSeries: allStats,
      cumulativeTotal,
    };
  }, [displayData, seriesInfo, settings.chartDisplay.showTotalLine, displayDataWithCumulative]);

  // Safe brush range for the component (uses brushReferenceData for collage mode)
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

  const handlePresetChange = useCallback((preset: PresetType | string) => {
    // Check if it's a custom template
    if (preset.startsWith("custom-")) {
      const template = getTemplate(preset);
      if (template) {
        // Apply all settings from the template (keep template's saved theme)
        setPreset("customize");
        setSelectedTemplateId(preset); // Track selected template
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
      setSelectedTemplateId(null); // Clear template selection
      // Apply site theme after preset change (presets load their default theme,
      // but we want to respect the builder-hub's current theme)
      if (siteTheme) {
        setTheme(siteTheme === "dark" ? "dark" : "light");
      }
    }
  }, [setPreset, setAspectRatio, setPadding, setLogo, setTitle, setBackground, setFooter, setChartType, setTheme, setWatermark, setChartDisplay, setExportQuality, getTemplate, siteTheme]);

  const handleSaveTemplate = useCallback(() => {
    // If a custom template is selected, update it
    if (selectedTemplateId) {
      updateTemplate(selectedTemplateId, settings);
      // Show visual feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
      const template = templates.find(t => t.id === selectedTemplateId);
      toast({
        title: "Template updated",
        description: `"${template?.name}" has been saved`,
        variant: "success",
        duration: 2000,
      });
    } else {
      // No custom template selected, start create flow
      setNewTemplateName(`My Template ${templates.length + 1}`);
      setIsCreatingTemplate(true);
    }
  }, [settings, updateTemplate, selectedTemplateId, templates, toast]);

  // Handle creating a new template (after user enters name)
  const handleCreateTemplate = useCallback((name: string) => {
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
  }, [settings, saveTemplate, toast]);

  const handleDeleteTemplate = useCallback((id: string) => {
    deleteTemplate(id);
    // If deleting the currently selected template, clear selection
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null);
    }
    toast({
      title: "Template deleted",
      duration: 2000,
    });
  }, [deleteTemplate, selectedTemplateId, toast]);

  const handleRenameTemplate = useCallback((id: string, newName: string) => {
    renameTemplate(id, newName);
    toast({
      title: "Template renamed",
      duration: 2000,
    });
  }, [renameTemplate, toast]);

  const handleDuplicateTemplate = useCallback((id: string) => {
    const newId = duplicateTemplate(id);
    if (newId) {
      toast({
        title: "Template duplicated",
        duration: 2000,
      });
    } else {
      toast({
        title: "Cannot duplicate",
        description: "Maximum number of templates reached",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [duplicateTemplate, toast]);

  // Export template as JSON file
  const handleExportTemplate = useCallback((id: string) => {
    const json = exportTemplate(id);
    if (!json) return;

    const template = templates.find(t => t.id === id);
    const filename = `template-${template?.name.replace(/\s+/g, "-").toLowerCase() || "export"}.json`;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Template exported",
      description: `Saved as ${filename}`,
      duration: 2000,
    });
  }, [exportTemplate, templates, toast]);

  // Export all templates as JSON file
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

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Templates exported",
      description: `Exported ${templates.length} template${templates.length > 1 ? "s" : ""}`,
      duration: 2000,
    });
  }, [exportAllTemplates, templates.length, toast]);

  // Handle file input change for import
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        if (typeof content !== "string") {
          throw new Error("Failed to read file content");
        }
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
    reader.onerror = () => {
      toast({
        title: "Import failed",
        description: "Error reading file",
        variant: "destructive",
        duration: 3000,
      });
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    e.target.value = "";
  }, [importTemplates, toast]);

  // Shared preparation before export (deselect annotations, update timestamp)
  const prepareForExport = useCallback(async () => {
    setSelectedAnnotationId(null);
    setCapturedAt(new Date());
    // Small delay to ensure UI updates before capture
    await new Promise(resolve => setTimeout(resolve, 100));
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

  // Reset copy success when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopySuccess(false);
    }
  }, [isOpen]);

  // Show toast when storage error occurs
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

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isInInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Cmd/Ctrl + S: Save image
      if (isMod && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Cmd/Ctrl + C: Copy image (only when not in an input)
      if (isMod && e.key === "c" && !isInInput) {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Skip all non-modifier shortcuts when user is typing in an input
      if (isInInput) return;

      // Number keys: Switch presets (1-4) and custom templates (5+)
      if (!isMod && !e.shiftKey && !e.altKey) {
        const presets: (PresetType | string)[] = [
          "default",
          "social-media",
          "slide-deck",
          "customize",
          ...templates.map(t => t.id),
        ];
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= presets.length) {
          e.preventDefault();
          handlePresetChange(presets[keyNum - 1]);
          return;
        }
      }

      // L/B/A: Switch chart types
      if (!isMod && !e.shiftKey && !e.altKey) {
        const chartTypeMap: Record<string, ChartType> = {
          "l": "line",
          "b": "bar",
          "a": "area",
        };
        if (chartTypeMap[e.key.toLowerCase()]) {
          e.preventDefault();
          setChartType(chartTypeMap[e.key.toLowerCase()]);
          return;
        }
      }

      // G: Toggle grid lines
      if (!isMod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setChartDisplay({ showGridLines: !settings.chartDisplay.showGridLines });
        return;
      }

      // D: Toggle data labels
      if (!isMod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setChartDisplay({ showDataLabels: !settings.chartDisplay.showDataLabels });
        return;
      }

      // R: Toggle average reference line
      if (!isMod && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setChartDisplay({ showAvgLine: !settings.chartDisplay.showAvgLine });
        return;
      }

      // T: Toggle total cumulative line
      if (!isMod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setChartDisplay({ showTotalLine: !settings.chartDisplay.showTotalLine });
        return;
      }

      // === Annotation Shortcuts ===

      // Delete/Backspace: Delete selected annotation
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        e.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }

      // Arrow keys: Nudge selected annotation
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selectedAnnotationId) {
        e.preventDefault();
        const annotation = annotations.find(a => a.id === selectedAnnotationId);
        if (!annotation) return;

        const step = e.shiftKey ? 5 : 1; // Shift for larger steps
        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
          case "ArrowUp": deltaY = -step; break;
          case "ArrowDown": deltaY = step; break;
          case "ArrowLeft": deltaX = -step; break;
          case "ArrowRight": deltaX = step; break;
        }

        if (annotation.type === "arrow") {
          // Move entire arrow
          updateAnnotation(selectedAnnotationId, {
            startX: Math.max(2, Math.min(98, annotation.startX + deltaX)),
            startY: Math.max(2, Math.min(98, annotation.startY + deltaY)),
            endX: Math.max(2, Math.min(98, annotation.endX + deltaX)),
            endY: Math.max(2, Math.min(98, annotation.endY + deltaY)),
          });
        } else if (annotation.type === "highlight" || annotation.type === "text") {
          // Move point or text annotation
          updateAnnotation(selectedAnnotationId, {
            x: Math.max(2, Math.min(98, annotation.x + deltaX)),
            y: Math.max(2, Math.min(98, annotation.y + deltaY)),
          });
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSave, handleCopy, handlePresetChange, templates, setChartType, setChartDisplay, settings.chartDisplay, selectedAnnotationId, activeToolType, annotations, deleteAnnotation, setActiveToolType, setSelectedAnnotationId, updateAnnotation]);

  // Get max width based on aspect ratio to prevent overflow
  const getPreviewMaxWidth = () => {
    // For custom aspect ratio, calculate based on actual dimensions
    if (settings.aspectRatio === "custom") {
      const ratio = customAspectRatio.width / customAspectRatio.height;
      if (ratio < 0.75) return "max-w-[280px]"; // Very tall (portrait-like)
      if (ratio < 1) return "max-w-[350px]"; // Tall
      if (ratio < 1.2) return "max-w-[450px]"; // Square-ish
      if (ratio < 1.6) return "max-w-[650px]"; // Slightly wide
      if (ratio < 2) return "max-w-[700px]"; // Wide
      return "max-w-[900px]"; // Very wide
    }

    switch (settings.aspectRatio) {
      case "portrait":
        return "max-w-[280px]";
      case "instagram":
        return "max-w-[350px]";
      case "square":
        return "max-w-[450px]";
      case "landscape":
        return "max-w-[700px]";
      case "collage":
        return "max-w-[1400px]";
      case "social-card":
      default:
        return "max-w-[650px]";
    }
  };

  // Format X axis labels based on period
  const formatXAxis = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    // Format based on current period
    switch (period) {
      case "Y":
        return date.getFullYear().toString();
      case "Q":
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} '${date.getFullYear().toString().slice(-2)}`;
      case "M":
        return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      case "W":
      case "D":
      default:
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  // Format Y axis values
  const formatYAxis = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Get the data key (could be "date" or "day" depending on the source)
  const dateKey = dataArray[0]?.date !== undefined ? "date" : "day";

  // Get the date key for brush (uses brushReferenceData)
  const brushDateKey = brushReferenceData[0]?.date !== undefined ? "date" : "day";

  // Get series data keys
  const getDataKeys = () => {
    if (seriesInfo.length > 0) {
      return seriesInfo;
    }
    // Default to "value" key if no series info provided
    return [{ id: "value", name: chartData.title || "Value", color: "#e84142", yAxis: "left" }];
  };

  // Format value for data labels
  const formatDataLabel = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Render chart element based on chart type
  const renderChartContent = () => {
    const series = getDataKeys();
    const chartType = settings.chartType;
    const showLabels = settings.chartDisplay.showDataLabels;

    return series.map((s) => {
      const commonProps = {
        key: s.id,
        dataKey: s.id,
        name: s.name,
        yAxisId: s.yAxis === "right" ? "right" : "left",
      };

      const labelProps = showLabels ? {
        content: ({ value }: { value?: number }) => (value !== undefined ? formatDataLabel(value) : ""),
      } : undefined;

      switch (chartType) {
        case "bar":
          return (
            <Bar
              {...commonProps}
              fill={s.color}
              radius={[2, 2, 0, 0]}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  formatter={formatDataLabel}
                  className="fill-gray-600 dark:fill-gray-400"
                  style={{ fontSize: 9 }}
                />
              )}
            </Bar>
          );
        case "area":
          return (
            <Area
              {...commonProps}
              type="monotone"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.3}
              strokeWidth={2}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  formatter={formatDataLabel}
                  className="fill-gray-600 dark:fill-gray-400"
                  style={{ fontSize: 9 }}
                />
              )}
            </Area>
          );
        case "line":
        default:
          return (
            <Line
              {...commonProps}
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              dot={showLabels}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.id}
                  position="top"
                  formatter={formatDataLabel}
                  className="fill-gray-600 dark:fill-gray-400"
                  style={{ fontSize: 9 }}
                />
              )}
            </Line>
          );
      }
    });
  };

  // Determine if we have right Y axis (includes Total line when enabled)
  const hasRightAxis = seriesInfo.some(s => s.yAxis === "right") || settings.chartDisplay.showTotalLine;

  // Primary color for brush
  const primaryColor = seriesInfo[0]?.color || "#e84142";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        clearAllAnnotations();
        onClose();
      }
    }}>
      <DialogContent
        className={cn(
          "max-w-[95vw] max-h-[90vh] p-0 gap-0 bg-background border flex flex-col",
          showCustomizePanel ? "sm:max-w-[1100px]" : "sm:max-w-[800px]"
        )}
        hideCloseButton
      >
        {/* Header */}
        <DialogHeader className="shrink-0">
          {/* Mobile Header - Row 1: Title, Mode Toggle, Chart Type */}
          <div className="flex md:hidden items-center justify-between px-4 py-2 border-b">
            {/* Left: Title + Mode Toggle */}
            <div className="flex items-center gap-2">
              <DialogTitle className="text-sm font-semibold">Image Studio</DialogTitle>
              {/* Mode Toggle (compact) */}
              {hasCollageMode && (
                <div className="flex items-center bg-muted border border-border rounded-md p-0.5">
                  <button
                    onClick={() => {
                      if (activeMode !== "single") {
                        clearAllAnnotations();
                        setActiveMode("single");
                      }
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
                      activeMode === "single"
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Single
                  </button>
                  <button
                    onClick={() => {
                      if (activeMode !== "collage") {
                        clearAllAnnotations();
                        setActiveMode("collage");
                      }
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
                      activeMode === "collage"
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Collage
                  </button>
                </div>
              )}
            </div>
            {/* Right: Chart Type Icons */}
            <div className="flex items-center bg-muted border border-border rounded-md p-0.5">
              {(["line", "bar", "area"] as ChartType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    settings.chartType === type
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={type.charAt(0).toUpperCase() + type.slice(1)}
                >
                  {CHART_TYPE_ICONS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Header - Row 2: Period, Preset, Actions */}
          <div className="flex md:hidden items-center justify-between px-4 py-2 border-b gap-2">
            {/* Left: Period dropdown */}
            {period && onPeriodChange && (
              <Select value={period} onValueChange={(value) => onPeriodChange(value as Period)}>
                <SelectTrigger className="w-[60px] h-8 text-xs">
                  <span data-slot="select-value" className="truncate">{period}</span>
                </SelectTrigger>
                <SelectContent>
                  {allowedPeriods.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p === "D" ? "Daily" : p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Center: Preset selector */}
            <div className="flex-1 min-w-0">
              {isRenamingTemplate && selectedTemplateId ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        handleRenameTemplate(selectedTemplateId, renameValue.trim());
                        setIsRenamingTemplate(false);
                        setRenameValue("");
                      } else if (e.key === "Escape") {
                        setIsRenamingTemplate(false);
                        setRenameValue("");
                      }
                    }}
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    placeholder="Template name"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (renameValue.trim()) {
                        handleRenameTemplate(selectedTemplateId, renameValue.trim());
                      }
                      setIsRenamingTemplate(false);
                      setRenameValue("");
                    }}
                    className="p-1 rounded text-green-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRenamingTemplate(false);
                      setRenameValue("");
                    }}
                    className="p-1 rounded text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : isCreatingTemplate ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateTemplate(newTemplateName);
                      } else if (e.key === "Escape") {
                        setIsCreatingTemplate(false);
                        setNewTemplateName("");
                      }
                    }}
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    placeholder="New template name"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateTemplate(newTemplateName)}
                    disabled={!newTemplateName.trim()}
                    className={cn(
                      "p-1 rounded",
                      newTemplateName.trim() ? "text-green-600" : "text-muted-foreground/30"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingTemplate(false);
                      setNewTemplateName("");
                    }}
                    className="p-1 rounded text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <PresetSelector
                  value={selectedTemplateId || settings.preset}
                  onChange={handlePresetChange}
                  showLabel={false}
                  customTemplates={templates}
                />
              )}
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-0.5">
              {/* Import templates */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-2" />
                    Import templates
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportAllTemplates}
                    disabled={templates.length === 0}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-2" />
                    Export all ({templates.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Template settings - only show when custom template selected */}
              {showCustomizePanel && selectedTemplateId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      if (template) {
                        setRenameValue(template.name);
                        setIsRenamingTemplate(true);
                      }
                    }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDuplicateTemplate(selectedTemplateId)}
                      disabled={!canSaveMore}
                    >
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportTemplate(selectedTemplateId)}>
                      <FileDown className="h-3.5 w-3.5 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteTemplate(selectedTemplateId)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Save template - only in Customize mode */}
              {showCustomizePanel && (
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={(!selectedTemplateId && !canSaveMore) || saveSuccess}
                  className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    saveSuccess
                      ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                      : (selectedTemplateId || canSaveMore)
                        ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                        : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  {saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                </button>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between gap-4 px-5 py-3 border-b">
            {/* Left: Title, mode toggle, and dimensions */}
            <div className="flex items-center gap-3 shrink-0">
              <DialogTitle className="text-base font-semibold">
                Image Studio
              </DialogTitle>
              {/* Mode Toggle - only show when collage mode is available */}
              {hasCollageMode && (
                <div className="flex items-center bg-muted border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => {
                      if (activeMode !== "single") {
                        clearAllAnnotations();
                        setActiveMode("single");
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                      activeMode === "single"
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    Single
                  </button>
                  <button
                    onClick={() => {
                      if (activeMode !== "collage") {
                        clearAllAnnotations();
                        setActiveMode("collage");
                      }
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                      activeMode === "collage"
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    Collage
                  </button>
                </div>
              )}
            </div>

            {/* Right: All controls grouped together */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Period Selector */}
              {period && onPeriodChange && (
                <div className="flex items-center bg-muted border border-border rounded-lg p-0.5">
                  {allowedPeriods.map((p) => (
                    <button
                      key={p}
                      onClick={() => onPeriodChange(p)}
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-md transition-colors min-w-[28px]",
                        period === p
                          ? "bg-background text-foreground shadow-sm border border-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Chart Type Selector */}
              <div className="flex items-center bg-muted border border-border rounded-lg p-0.5">
                {(["line", "bar", "area"] as ChartType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      settings.chartType === type
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                  >
                    {CHART_TYPE_ICONS[type]}
                  </button>
                ))}
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-border" />

              {/* Preset selector, rename input, or create template input */}
              {isRenamingTemplate && selectedTemplateId ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        handleRenameTemplate(selectedTemplateId, renameValue.trim());
                        setIsRenamingTemplate(false);
                        setRenameValue("");
                      } else if (e.key === "Escape") {
                        setIsRenamingTemplate(false);
                        setRenameValue("");
                      }
                    }}
                    className="min-w-[150px] px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    placeholder="Template name"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (renameValue.trim()) {
                        handleRenameTemplate(selectedTemplateId, renameValue.trim());
                      }
                      setIsRenamingTemplate(false);
                      setRenameValue("");
                    }}
                    className="p-1.5 rounded-md text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRenamingTemplate(false);
                      setRenameValue("");
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : isCreatingTemplate ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateTemplate(newTemplateName);
                      } else if (e.key === "Escape") {
                        setIsCreatingTemplate(false);
                        setNewTemplateName("");
                      }
                    }}
                    className="min-w-[150px] px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    placeholder="New template name"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateTemplate(newTemplateName)}
                    disabled={!newTemplateName.trim()}
                    className={cn(
                      "p-1.5 rounded-md",
                      newTemplateName.trim()
                        ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                        : "text-muted-foreground/30 cursor-not-allowed"
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingTemplate(false);
                      setNewTemplateName("");
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <PresetSelector
                    value={selectedTemplateId || settings.preset}
                    onChange={handlePresetChange}
                    showLabel={false}
                    customTemplates={templates}
                  />

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    {/* Template-related controls - only show in Customize mode */}
                    {showCustomizePanel && (
                      <>
                        {/* Template settings dropdown */}
                        <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={!selectedTemplateId}
                              className={cn(
                                "p-1.5 rounded-md transition-colors",
                                selectedTemplateId
                                  ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                                  : "text-muted-foreground/30 cursor-not-allowed"
                              )}
                            >
                              <Settings2 className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          {selectedTemplateId ? "Template options" : "Select a custom template"}
                        </TooltipContent>
                      </Tooltip>
                      {selectedTemplateId && (
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => {
                            const template = templates.find(t => t.id === selectedTemplateId);
                            if (template) {
                              setRenameValue(template.name);
                              setIsRenamingTemplate(true);
                            }
                          }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicateTemplate(selectedTemplateId)}
                            disabled={!canSaveMore}
                          >
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportTemplate(selectedTemplateId)}>
                            <FileDown className="h-3.5 w-3.5 mr-2" />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteTemplate(selectedTemplateId)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      )}
                    </DropdownMenu>

                    {/* Import/Export all templates dropdown */}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Import/Export templates</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5 mr-2" />
                          Import templates
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleExportAllTemplates}
                          disabled={templates.length === 0}
                        >
                          <FileDown className="h-3.5 w-3.5 mr-2" />
                          Export all ({templates.length})
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Hidden file input for importing */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileImport}
                      className="hidden"
                    />

                {/* Save template button - always reserve space */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={!showCustomizePanel || (!selectedTemplateId && !canSaveMore) || saveSuccess}
                      className={cn(
                        "p-1.5 rounded-md transition-all duration-200",
                        saveSuccess
                          ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                          : showCustomizePanel && (selectedTemplateId || canSaveMore)
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "text-muted-foreground/30 cursor-not-allowed"
                      )}
                    >
                      {saveSuccess ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {saveSuccess
                      ? "Saved!"
                      : !showCustomizePanel
                        ? "Switch to Customize to save"
                        : selectedTemplateId
                          ? "Save template"
                          : canSaveMore
                            ? "Save as new template"
                            : "Max templates reached"}
                  </TooltipContent>
                </Tooltip>
                      </>
                    )}

                {/* Keyboard shortcuts help */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="p-3 max-w-xs">
                    <div className="space-y-2">
                      <p className="font-medium text-sm">Keyboard Shortcuts</p>
                      <div className="grid gap-1.5">
                        {KEYBOARD_SHORTCUTS.map((shortcut, i) => (
                          <div key={i} className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-primary-foreground/70">{shortcut.description}</span>
                            <div className="flex gap-1">
                              {shortcut.keys.map((key, j) => (
                                <kbd
                                  key={j}
                                  className="px-1.5 py-0.5 bg-primary-foreground/20 rounded text-[10px] font-mono"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  <X className="h-5 w-5" />
                </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Mobile: Collapsible Metrics Section (Collage mode only) */}
        {isCollageMode && (
          <div className="md:hidden border-b">
            <button
              onClick={() => setMobileMetricsExpanded(!mobileMetricsExpanded)}
              className={cn(
                "w-full px-4 py-3 flex items-center",
                mobileMetricsExpanded ? "justify-between" : "justify-center"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-normal">
                {mobileMetricsExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> {selectedMetrics.length} metrics selected
                  </>
                )}
              </span>
              {mobileMetricsExpanded && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      const toSelect = availableMetrics.slice(0, 9).map((m) => m.metricKey);
                      setSelectedMetrics(toSelect);
                    }}
                    className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 transition-colors"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMetrics([])}
                    className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 hover:border-foreground/30 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </button>
            {mobileMetricsExpanded && (
              <div className="max-h-[300px] overflow-y-auto px-4 pb-4 overscroll-contain touch-pan-y">
                <CollageMetricSelector
                  availableMetrics={availableMetrics}
                  selectedMetrics={selectedMetrics}
                  onSelectionChange={setSelectedMetrics}
                  metricsData={metricsData}
                  hideHeader={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Collage Mode: Metric Selector (left side) - Desktop only */}
          {isCollageMode && (
            <div className="hidden md:block w-[240px] border-r p-4 overflow-y-auto shrink-0 bg-background">
              <CollageMetricSelector
                availableMetrics={availableMetrics}
                selectedMetrics={selectedMetrics}
                onSelectionChange={setSelectedMetrics}
                metricsData={metricsData}
              />
            </div>
          )}

          {/* Preview area */}
          <div className="flex-1 p-5 overflow-auto flex flex-col bg-muted/30">
            {isCollageMode ? (
              /* Collage Preview */
              <div className={cn("w-full mx-auto", getPreviewMaxWidth())}>
                <div ref={exportRef} className="relative">
                  <CollagePreview
                    metrics={filteredCollageMetrics}
                    settings={settings}
                    collageSettings={collageSettings}
                    chainName={chainName}
                    period={period}
                    pageUrl={chartData.pageUrl}
                    capturedAt={capturedAt}
                  />
                  {/* Annotation Overlay for collage - inside export wrapper so annotations are captured */}
                  {(annotations.length > 0 || (showCustomizePanel && activeToolType)) && (
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
              /* Single Chart Preview */
              <div className={cn("w-full mx-auto", getPreviewMaxWidth())}>
                {/* Export wrapper - includes both preview and annotations */}
                <div ref={exportRef} className="relative">
                  <ImagePreview
                    settings={settings}
                    chartData={chartData}
                    stats={chartStats || undefined}
                    capturedAt={capturedAt}
                  >
                    {dataArray.length > 0 ? (
                      <ChartWatermark
                        className="h-full"
                        scale={["portrait", "instagram"].includes(settings.aspectRatio) ? "small" : settings.aspectRatio === "square" ? "medium" : "large"}
                        visible={settings.watermark.visible}
                        opacity={settings.watermark.opacity}
                        position={settings.watermark.position}
                        layer={settings.watermark.layer}
                      >
                        <ResponsiveContainer width="100%" height={250}>
                          <ComposedChart
                            data={displayDataWithCumulative}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                          >
                            {settings.chartDisplay.showGridLines && (
                              <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-gray-200 dark:stroke-gray-700"
                                vertical={false}
                              />
                            )}
                            <XAxis
                              dataKey={dateKey}
                              tickFormatter={formatXAxis}
                              tick={{ className: "fill-gray-600 dark:fill-gray-400", fontSize: 11 }}
                              minTickGap={40}
                            />
                            <YAxis
                              yAxisId="left"
                              tick={{ className: "fill-gray-600 dark:fill-gray-400", fontSize: 11 }}
                              tickFormatter={formatYAxis}
                            />
                            {hasRightAxis && (
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ className: "fill-gray-600 dark:fill-gray-400", fontSize: 11 }}
                                tickFormatter={formatYAxis}
                              />
                            )}
                            {renderChartContent()}
                            {/* Total cumulative line - purple line showing running total */}
                            {settings.chartDisplay.showTotalLine && (
                              <Line
                                type="monotone"
                                dataKey="cumulative"
                                stroke="#a855f7"
                                strokeWidth={1.5}
                                dot={false}
                                yAxisId="right"
                                name="Total"
                                strokeOpacity={0.9}
                              />
                            )}
                            {/* Average reference line - rendered after chart content to be on top */}
                            {settings.chartDisplay.showAvgLine && chartStats && (
                              <ReferenceLine
                                y={chartStats.avg}
                                yAxisId="left"
                                stroke="#888"
                                strokeDasharray="5 5"
                                strokeWidth={1.5}
                                label={{
                                  value: `Avg: ${formatYAxis(chartStats.avg)}`,
                                  position: "insideTopLeft",
                                  className: "fill-gray-600 dark:fill-gray-400",
                                  fontSize: 10,
                                  offset: 5,
                                }}
                              />
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartWatermark>
                    ) : (
                      <div className="h-[250px] flex flex-col items-center justify-center gap-3 text-center px-8">
                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-muted-foreground"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 3v18h18" />
                            <path d="M7 16l4-4 4 4 5-6" />
                          </svg>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">No chart data available</p>
                          <p className="text-xs text-muted-foreground/70">Select a metric with data to create an export</p>
                        </div>
                      </div>
                    )}
                  </ImagePreview>
                  {/* Annotation Overlay - inside export wrapper so annotations are captured */}
                  {(annotations.length > 0 || (showCustomizePanel && activeToolType)) && (
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

            {/* Date Range Controls - below the preview, only show when we have data */}
            {brushReferenceData.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* Date Range Presets */}
                <div className="flex items-center justify-center gap-2">
                  {DATE_RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleDateRangePreset(preset.id as DateRangePreset)}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-md transition-colors border",
                        activePreset === preset.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/80 hover:border-foreground/30"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Brush Slider - only show if we have reference data */}
                {brushReferenceData.length > 0 && (
                  <div className="bg-muted rounded-lg p-2">
                    <ResponsiveContainer width="100%" height={55}>
                      <LineChart
                        data={brushReferenceData}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <Brush
                          dataKey={brushDateKey}
                          height={45}
                          stroke={primaryColor}
                          fill={`${primaryColor}20`}
                          startIndex={safeBrushRange.startIndex}
                          endIndex={safeBrushRange.endIndex}
                          onChange={(e: { startIndex?: number; endIndex?: number }) => {
                            if (e.startIndex !== undefined && e.endIndex !== undefined) {
                              setBrushRange({
                                startIndex: e.startIndex,
                                endIndex: e.endIndex,
                              });
                              // Clear active preset when manually adjusting
                              setActivePreset("ALL");
                            }
                          }}
                          travellerWidth={8}
                          tickFormatter={formatXAxis}
                        >
                          <LineChart data={brushReferenceData}>
                            <Line
                              type="monotone"
                              dataKey={isCollageMode ? "value" : (seriesInfo[0]?.id || "value")}
                              stroke={primaryColor}
                              strokeWidth={1}
                              dot={false}
                            />
                          </LineChart>
                        </Brush>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customization panel (right side) - Desktop only */}
          {showCustomizePanel && (
            <div className="hidden md:block border-l p-4 overflow-y-auto shrink-0 w-[280px] bg-background">
              <CustomizationPanel
                settings={settings}
                isCustomized={isCustomized}
                isCollageMode={isCollageMode}
                collageMetricCount={selectedMetrics.length}
                collageGridLayout={collageSettings.gridLayout}
                onCollageGridLayoutChange={(layout) => setCollageSettings(prev => ({ ...prev, gridLayout: layout }))}
                onAspectRatioChange={setAspectRatio}
                customAspectRatio={customAspectRatio}
                onCustomAspectRatioChange={setCustomAspectRatio}
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
                // Annotation props
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
              />
            </div>
          )}
        </div>

        {/* Mobile: Collapsible Customize Section */}
        {showCustomizePanel && (
          <div className="md:hidden border-t shrink-0">
            <button
              onClick={() => setMobileCustomizeExpanded(!mobileCustomizeExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm font-normal">
                {mobileCustomizeExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Customize
                  </>
                )}
              </span>
              {/* Reset button on the right side - only when expanded and customized */}
              {mobileCustomizeExpanded && isCustomized && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    resetToPreset();
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </span>
              )}
            </button>
            {mobileCustomizeExpanded && (
              <div
                className="h-[300px] overflow-y-auto px-4 pb-4 overscroll-contain"
                style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                <CustomizationPanel
                  settings={settings}
                  isCustomized={isCustomized}
                  isCollageMode={isCollageMode}
                  collageMetricCount={selectedMetrics.length}
                  collageGridLayout={collageSettings.gridLayout}
                  onCollageGridLayoutChange={(layout) => setCollageSettings(prev => ({ ...prev, gridLayout: layout }))}
                  onAspectRatioChange={setAspectRatio}
                  customAspectRatio={customAspectRatio}
                  onCustomAspectRatioChange={setCustomAspectRatio}
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
                  // Annotation props
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
                  hideReset={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer with action buttons */}
        <div className="px-5 py-3 border-t flex gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isExporting}
            className={cn(
              "flex-1 h-12 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all",
              "bg-muted/50 hover:bg-muted border-2 border-border hover:border-foreground/20",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Save image
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={isExporting}
            className={cn(
              "flex-1 h-12 flex items-center justify-center gap-2 rounded-lg font-medium text-sm transition-all",
              "bg-muted/50 hover:bg-muted border-2 border-border hover:border-foreground/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              copySuccess && "border-green-500 bg-green-500/10"
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copySuccess ? "Copied!" : "Copy image"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
