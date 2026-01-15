import { useState, useCallback } from "react";
import type {
  ExportSettings,
  PresetType,
  AspectRatio,
  Padding,
  LogoSettings,
  TitleSettings,
  BackgroundSettings,
  FooterSettings,
  ChartType,
  ExportTheme,
  WatermarkSettings,
  ChartDisplaySettings,
  ExportQualitySettings,
} from "../types";
import { PRESET_DEFAULTS } from "../constants";

export function useImageExportSettings(initialPreset: PresetType = "default") {
  const [settings, setSettings] = useState<ExportSettings>(
    PRESET_DEFAULTS[initialPreset]
  );
  const [isCustomized, setIsCustomized] = useState(false);

  const setPreset = useCallback((preset: PresetType) => {
    setSettings(PRESET_DEFAULTS[preset]);
    setIsCustomized(false);
  }, []);

  const setAspectRatio = useCallback((aspectRatio: AspectRatio) => {
    setSettings((prev) => ({ ...prev, aspectRatio }));
    setIsCustomized(true);
  }, []);

  const setPadding = useCallback((padding: Padding) => {
    setSettings((prev) => ({ ...prev, padding }));
    setIsCustomized(true);
  }, []);

  const setLogo = useCallback((logo: Partial<LogoSettings>) => {
    setSettings((prev) => ({
      ...prev,
      logo: { ...prev.logo, ...logo },
    }));
    setIsCustomized(true);
  }, []);

  const setTitle = useCallback((title: Partial<TitleSettings>) => {
    setSettings((prev) => ({
      ...prev,
      title: { ...prev.title, ...title },
    }));
    setIsCustomized(true);
  }, []);

  const setBackground = useCallback((background: Partial<BackgroundSettings>) => {
    setSettings((prev) => ({
      ...prev,
      background: { ...prev.background, ...background },
    }));
    setIsCustomized(true);
  }, []);

  const setFooter = useCallback((footer: Partial<FooterSettings>) => {
    setSettings((prev) => ({
      ...prev,
      footer: { ...prev.footer, ...footer },
    }));
    setIsCustomized(true);
  }, []);

  const setChartType = useCallback((chartType: ChartType) => {
    setSettings((prev) => ({ ...prev, chartType }));
    setIsCustomized(true);
  }, []);

  const setTheme = useCallback((theme: ExportTheme) => {
    setSettings((prev) => ({ ...prev, theme }));
    setIsCustomized(true);
  }, []);

  const setWatermark = useCallback((watermark: Partial<WatermarkSettings>) => {
    setSettings((prev) => ({
      ...prev,
      watermark: { ...prev.watermark, ...watermark },
    }));
    setIsCustomized(true);
  }, []);

  const setChartDisplay = useCallback((chartDisplay: Partial<ChartDisplaySettings>) => {
    setSettings((prev) => ({
      ...prev,
      chartDisplay: { ...prev.chartDisplay, ...chartDisplay },
    }));
    setIsCustomized(true);
  }, []);

  const setExportQuality = useCallback((exportQuality: Partial<ExportQualitySettings>) => {
    setSettings((prev) => ({
      ...prev,
      exportQuality: { ...prev.exportQuality, ...exportQuality },
    }));
    setIsCustomized(true);
  }, []);

  const resetToPreset = useCallback(() => {
    setSettings(PRESET_DEFAULTS[settings.preset]);
    setIsCustomized(false);
  }, [settings.preset]);

  const reset = useCallback(() => {
    setSettings(PRESET_DEFAULTS.default);
    setIsCustomized(false);
  }, []);

  return {
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
    resetToPreset,
    reset,
  };
}
