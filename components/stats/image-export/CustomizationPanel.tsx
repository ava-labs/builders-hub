"use client";

import { useState } from "react";
import { RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AspectRatioControl } from "./controls/AspectRatioControl";
import { PaddingControl } from "./controls/PaddingControl";
import { LogoControl } from "./controls/LogoControl";
import { TitleControl } from "./controls/TitleControl";
import { BackgroundControl } from "./controls/BackgroundControl";
import { FooterControl } from "./controls/FooterControl";
import { ThemeControl } from "./controls/ThemeControl";
import { WatermarkControl } from "./controls/WatermarkControl";
import { ChartDisplayControl } from "./controls/ChartDisplayControl";
import { ExportQualityControl } from "./controls/ExportQualityControl";
import { AnnotationControl } from "./controls/AnnotationControl";
import { DescriptionControl } from "./controls/DescriptionControl";
import { CollageLayoutControl } from "./controls/CollageLayoutControl";
import type {
  ExportSettings,
  AspectRatio,
  Padding,
  LogoSettings,
  TitleSettings,
  BackgroundSettings,
  FooterSettings,
  ExportTheme,
  WatermarkSettings,
  ChartDisplaySettings,
  ExportQualitySettings,
  Annotation,
  AnnotationType,
  AnnotationSize,
  ArrowLineStyle,
  ArrowheadStyle,
  CustomAspectRatio,
} from "./types";

interface CustomizationPanelProps {
  settings: ExportSettings;
  isCustomized: boolean;
  isCollageMode?: boolean;
  collageMetricCount?: number;
  collageGridLayout?: { cols: number; rows: number } | null;
  onCollageGridLayoutChange?: (layout: { cols: number; rows: number } | null) => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  customAspectRatio?: CustomAspectRatio;
  onCustomAspectRatioChange?: (dimensions: CustomAspectRatio) => void;
  onPaddingChange: (padding: Padding) => void;
  onLogoChange: (settings: Partial<LogoSettings>) => void;
  onTitleChange: (settings: Partial<TitleSettings>) => void;
  onBackgroundChange: (settings: Partial<BackgroundSettings>) => void;
  onFooterChange: (settings: Partial<FooterSettings>) => void;
  onThemeChange: (theme: ExportTheme) => void;
  onWatermarkChange: (settings: Partial<WatermarkSettings>) => void;
  onChartDisplayChange: (settings: Partial<ChartDisplaySettings>) => void;
  onExportQualityChange: (settings: Partial<ExportQualitySettings>) => void;
  onDescriptionChange: (description: string) => void;
  onReset: () => void;
  // Annotation props
  annotations?: Annotation[];
  activeToolType?: AnnotationType | null;
  selectedAnnotationId?: string | null;
  selectedColor?: string;
  selectedSize?: AnnotationSize;
  selectedOpacity?: number;
  selectedLineStyle?: ArrowLineStyle;
  selectedArrowheadStyle?: ArrowheadStyle;
  onAnnotationToolSelect?: (type: AnnotationType | null) => void;
  onAnnotationSelect?: (id: string | null) => void;
  onAnnotationColorChange?: (color: string) => void;
  onAnnotationSizeChange?: (size: AnnotationSize) => void;
  onAnnotationOpacityChange?: (opacity: number) => void;
  onAnnotationLineStyleChange?: (style: ArrowLineStyle) => void;
  onAnnotationArrowheadStyleChange?: (style: ArrowheadStyle) => void;
  onUpdateAnnotation?: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation?: (id: string) => void;
  onClearAllAnnotations?: () => void;
  hideReset?: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border pb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-1 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
      >
        {title}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </div>
  );
}

export function CustomizationPanel({
  settings,
  isCustomized,
  isCollageMode = false,
  collageMetricCount = 0,
  collageGridLayout,
  onCollageGridLayoutChange,
  onAspectRatioChange,
  customAspectRatio,
  onCustomAspectRatioChange,
  onPaddingChange,
  onLogoChange,
  onTitleChange,
  onBackgroundChange,
  onFooterChange,
  onThemeChange,
  onWatermarkChange,
  onChartDisplayChange,
  onExportQualityChange,
  onDescriptionChange,
  onReset,
  // Annotation props
  annotations = [],
  activeToolType = null,
  selectedAnnotationId = null,
  selectedColor = "#e84142",
  selectedSize = "medium",
  selectedOpacity = 100,
  selectedLineStyle = "solid",
  selectedArrowheadStyle = "filled",
  onAnnotationToolSelect,
  onAnnotationSelect,
  onAnnotationColorChange,
  onAnnotationSizeChange,
  onAnnotationOpacityChange,
  onAnnotationLineStyleChange,
  onAnnotationArrowheadStyleChange,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onClearAllAnnotations,
  hideReset = false,
}: CustomizationPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Reset button */}
      {isCustomized && !hideReset && (
        <div className="flex justify-end pb-2 border-b border-border">
          <button
            type="button"
            onClick={onReset}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      )}

      {/* Layout Section - structural/spatial properties */}
      <CollapsibleSection title="Layout">
        <div className="space-y-4">
          <AspectRatioControl
            value={settings.aspectRatio}
            onChange={onAspectRatioChange}
            customDimensions={customAspectRatio}
            onCustomDimensionsChange={onCustomAspectRatioChange}
          />
          {/* Collage grid layout control - only show in collage mode with multiple metrics */}
          {isCollageMode && collageMetricCount > 1 && onCollageGridLayoutChange && (
            <CollageLayoutControl
              metricCount={collageMetricCount}
              value={collageGridLayout ?? null}
              onChange={onCollageGridLayoutChange}
            />
          )}
          <PaddingControl
            value={settings.padding}
            onChange={onPaddingChange}
            borderRadius={settings.background.borderRadius ?? 8}
            onBorderRadiusChange={(radius) => onBackgroundChange({ borderRadius: radius })}
          />
        </div>
      </CollapsibleSection>

      {/* Branding Section - identity elements */}
      <CollapsibleSection title="Branding">
        <div className="space-y-4">
          <LogoControl value={settings.logo} onChange={onLogoChange} />
          <TitleControl value={settings.title} onChange={onTitleChange} />
          <DescriptionControl value={settings.description || ""} onChange={onDescriptionChange} />
          <WatermarkControl value={settings.watermark} onChange={onWatermarkChange} />
        </div>
      </CollapsibleSection>

      {/* Appearance Section - colors/style */}
      <CollapsibleSection title="Appearance">
        <div className="space-y-4">
          <ThemeControl value={settings.theme} onChange={onThemeChange} />
          <BackgroundControl value={settings.background} onChange={onBackgroundChange} />
        </div>
      </CollapsibleSection>

      {/* Chart Section - data visualization options */}
      <CollapsibleSection title="Chart" defaultOpen={false}>
        <ChartDisplayControl value={settings.chartDisplay} onChange={onChartDisplayChange} isCollageMode={isCollageMode} />
      </CollapsibleSection>

      {/* Annotations Section */}
      {onAnnotationToolSelect && onAnnotationSelect && onAnnotationColorChange && onAnnotationSizeChange && onAnnotationOpacityChange && onAnnotationLineStyleChange && onAnnotationArrowheadStyleChange && onUpdateAnnotation && onDeleteAnnotation && onClearAllAnnotations && (
        <CollapsibleSection title="Annotations" defaultOpen={false}>
          <AnnotationControl
            annotations={annotations}
            activeToolType={activeToolType}
            selectedAnnotationId={selectedAnnotationId}
            selectedColor={selectedColor}
            selectedSize={selectedSize}
            selectedOpacity={selectedOpacity}
            selectedLineStyle={selectedLineStyle}
            selectedArrowheadStyle={selectedArrowheadStyle}
            onToolSelect={onAnnotationToolSelect}
            onAnnotationSelect={onAnnotationSelect}
            onColorChange={onAnnotationColorChange}
            onSizeChange={onAnnotationSizeChange}
            onOpacityChange={onAnnotationOpacityChange}
            onLineStyleChange={onAnnotationLineStyleChange}
            onArrowheadStyleChange={onAnnotationArrowheadStyleChange}
            onUpdateAnnotation={onUpdateAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            onClearAll={onClearAllAnnotations}
          />
        </CollapsibleSection>
      )}

      {/* Footer Section */}
      <CollapsibleSection title="Footer" defaultOpen={false}>
        <FooterControl value={settings.footer} onChange={onFooterChange} />
      </CollapsibleSection>

      {/* Export Section - output settings */}
      <CollapsibleSection title="Export" defaultOpen={false}>
        <ExportQualityControl value={settings.exportQuality} onChange={onExportQualityChange} />
      </CollapsibleSection>
    </div>
  );
}
