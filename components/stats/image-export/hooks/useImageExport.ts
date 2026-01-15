"use client";

import { useState, useCallback } from "react";
import { toPng, toJpeg, toSvg, toBlob } from "html-to-image";
import type { ExportQualitySettings, ExportFormat, ExportResolution } from "../types";

// Map resolution to pixel ratio
const RESOLUTION_MAP: Record<ExportResolution, number> = {
  "1x": 1,
  "2x": 2,
  "3x": 3,
};

interface UseImageExportOptions {
  pixelRatio?: number;
  quality?: number;
}

export function useImageExport(options: UseImageExportOptions = {}) {
  const { pixelRatio = 2, quality = 1 } = options;
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadImage = useCallback(
    async (
      element: HTMLElement | null,
      filename: string = "chart",
      exportSettings?: ExportQualitySettings
    ) => {
      if (!element) {
        setError("No element to export");
        return false;
      }

      setIsExporting(true);
      setError(null);

      try {
        // Use export settings if provided, otherwise use defaults
        const actualPixelRatio = exportSettings
          ? RESOLUTION_MAP[exportSettings.resolution]
          : pixelRatio;
        const format: ExportFormat = exportSettings?.format || "png";
        const jpegQuality = exportSettings?.jpegQuality
          ? exportSettings.jpegQuality / 100
          : quality;

        let dataUrl: string;
        let fileExtension: string;

        const commonOptions = {
          pixelRatio: actualPixelRatio,
          cacheBust: true,
          backgroundColor: undefined,
        };

        if (format === "jpeg") {
          dataUrl = await toJpeg(element, {
            ...commonOptions,
            quality: jpegQuality,
          });
          fileExtension = "jpg";
        } else if (format === "svg") {
          dataUrl = await toSvg(element, {
            ...commonOptions,
          });
          fileExtension = "svg";
        } else {
          // PNG is default
          dataUrl = await toPng(element, {
            ...commonOptions,
            quality: 1,
          });
          fileExtension = "png";
        }

        const link = document.createElement("a");
        link.download = `${filename}-${new Date().toISOString().split("T")[0]}.${fileExtension}`;
        link.href = dataUrl;
        link.click();

        setIsExporting(false);
        return true;
      } catch (err) {
        console.error("Failed to download image:", err);
        setError("Failed to download image");
        setIsExporting(false);
        return false;
      }
    },
    [pixelRatio, quality]
  );

  const copyToClipboard = useCallback(
    async (element: HTMLElement | null, exportSettings?: ExportQualitySettings) => {
      if (!element) {
        setError("No element to export");
        return false;
      }

      setIsExporting(true);
      setError(null);

      try {
        // Use export settings if provided, otherwise use defaults
        const actualPixelRatio = exportSettings
          ? RESOLUTION_MAP[exportSettings.resolution]
          : pixelRatio;

        const blob = await toBlob(element, {
          quality,
          pixelRatio: actualPixelRatio,
          cacheBust: true,
          backgroundColor: undefined,
        });

        if (!blob) {
          throw new Error("Failed to create blob");
        }

        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);

        setIsExporting(false);
        return true;
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        setError("Failed to copy to clipboard");
        setIsExporting(false);
        return false;
      }
    },
    [pixelRatio, quality]
  );

  return {
    isExporting,
    error,
    downloadImage,
    copyToClipboard,
  };
}
