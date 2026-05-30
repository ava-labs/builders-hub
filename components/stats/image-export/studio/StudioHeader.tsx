"use client";
import {
  X,
  Copy,
  TrendingUp,
  BarChart3,
  AreaChart,
  HelpCircle,
  Save,
  Settings2,
  Pencil,
  Trash2,
  Check,
  Upload,
  FileDown,
} from "lucide-react";
import {
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
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PresetSelector } from "../PresetSelector";
import type { CustomTemplate } from "../hooks/useCustomTemplates";
import type { ExportMode, Period, PresetType } from "../types";
import {
  KEYBOARD_SHORTCUTS,
  type ChartType,
} from "./types";

const CHART_TYPE_ICONS: Record<ChartType, React.ReactNode> = {
  line: <TrendingUp className="h-4 w-4" />,
  bar: <BarChart3 className="h-4 w-4" />,
  area: <AreaChart className="h-4 w-4" />,
};

const CHART_TYPES: ChartType[] = ["line", "bar", "area"];

const PERIOD_LABELS: Record<Period, string> = {
  D: "Daily",
  W: "Weekly",
  M: "Monthly",
  Q: "Quarterly",
  Y: "Yearly",
};

interface StudioHeaderProps {
  // Mode toggle.
  hasCollageMode: boolean;
  activeMode: ExportMode;
  onModeChange: (mode: ExportMode) => void;

  // Period selector.
  period: Period | undefined;
  allowedPeriods: Period[];
  onPeriodChange?: (period: Period) => void;

  // Chart type.
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;

  // Preset / template state.
  showCustomizePanel: boolean;
  selectedPreset: PresetType | string;
  selectedTemplateId: string | null;
  templates: CustomTemplate[];
  onPresetChange: (preset: PresetType | string) => void;

  // Rename / create flows.
  isRenamingTemplate: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;

  isCreatingTemplate: boolean;
  newTemplateName: string;
  onNewTemplateNameChange: (value: string) => void;
  onConfirmCreate: () => void;
  onCancelCreate: () => void;

  // Template menu actions.
  canSaveMore: boolean;
  saveSuccess: boolean;
  onSaveTemplate: () => void;
  onDuplicateTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onExportTemplate: (id: string) => void;
  onExportAllTemplates: () => void;
  onImportClick: () => void;

  onClose: () => void;
}

// Top-bar of the studio dialog: title, mode toggle, period selector, chart-
// type buttons, preset selector, template management, keyboard help, close.
// Keeps mobile and desktop as two render branches sharing the same props
// rather than risking a unified responsive layout.
export function StudioHeader(props: StudioHeaderProps) {
  return (
    <DialogHeader className="shrink-0">
      <MobileHeader {...props} />
      <DesktopHeader {...props} />
    </DialogHeader>
  );
}

// ── Mobile layout ──────────────────────────────────────────────────────────

function MobileHeader({
  hasCollageMode,
  activeMode,
  onModeChange,
  period,
  allowedPeriods,
  onPeriodChange,
  chartType,
  onChartTypeChange,
  showCustomizePanel,
  selectedPreset,
  selectedTemplateId,
  templates,
  onPresetChange,
  isRenamingTemplate,
  renameValue,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onStartRename,
  isCreatingTemplate,
  newTemplateName,
  onNewTemplateNameChange,
  onConfirmCreate,
  onCancelCreate,
  canSaveMore,
  saveSuccess,
  onSaveTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onExportTemplate,
  onExportAllTemplates,
  onImportClick,
  onClose,
}: StudioHeaderProps) {
  return (
    <>
      {/* Row 1: Title + Mode toggle + Chart type */}
      <div className="flex md:hidden items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <DialogTitle className="text-sm font-semibold">Image Studio</DialogTitle>
          {hasCollageMode && (
            <ModeToggle
              activeMode={activeMode}
              onChange={onModeChange}
              size="sm"
            />
          )}
        </div>
        <ChartTypeToggle
          activeType={chartType}
          onChange={onChartTypeChange}
          size="sm"
        />
      </div>

      {/* Row 2: Period + Preset + Actions */}
      <div className="flex md:hidden items-center justify-between px-4 py-2 border-b gap-2">
        {period && onPeriodChange && (
          <Select
            value={period}
            onValueChange={(value) => onPeriodChange(value as Period)}
          >
            <SelectTrigger className="w-[60px] h-8 text-xs">
              <span data-slot="select-value" className="truncate">
                {period}
              </span>
            </SelectTrigger>
            <SelectContent>
              {allowedPeriods.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {PERIOD_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1 min-w-0">
          {isRenamingTemplate && selectedTemplateId ? (
            <TemplateNameInput
              value={renameValue}
              onChange={onRenameValueChange}
              onConfirm={onConfirmRename}
              onCancel={onCancelRename}
              placeholder="Template name"
              size="sm"
            />
          ) : isCreatingTemplate ? (
            <TemplateNameInput
              value={newTemplateName}
              onChange={onNewTemplateNameChange}
              onConfirm={onConfirmCreate}
              onCancel={onCancelCreate}
              placeholder="New template name"
              requireValue
              size="sm"
            />
          ) : (
            <PresetSelector
              value={selectedTemplateId || selectedPreset}
              onChange={onPresetChange}
              showLabel={false}
              customTemplates={templates}
            />
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <ImportExportMenu
            templatesCount={templates.length}
            onImport={onImportClick}
            onExportAll={onExportAllTemplates}
            size="sm"
          />

          {showCustomizePanel && selectedTemplateId && (
            <TemplateActionsMenu
              selectedTemplateId={selectedTemplateId}
              canSaveMore={canSaveMore}
              onRename={onStartRename}
              onDuplicate={onDuplicateTemplate}
              onExport={onExportTemplate}
              onDelete={onDeleteTemplate}
              size="sm"
            />
          )}

          {showCustomizePanel && (
            <SaveTemplateButton
              selectedTemplateId={selectedTemplateId}
              canSaveMore={canSaveMore}
              saveSuccess={saveSuccess}
              onClick={onSaveTemplate}
              size="sm"
            />
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Desktop layout ─────────────────────────────────────────────────────────

function DesktopHeader({
  hasCollageMode,
  activeMode,
  onModeChange,
  period,
  allowedPeriods,
  onPeriodChange,
  chartType,
  onChartTypeChange,
  showCustomizePanel,
  selectedPreset,
  selectedTemplateId,
  templates,
  onPresetChange,
  isRenamingTemplate,
  renameValue,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onStartRename,
  isCreatingTemplate,
  newTemplateName,
  onNewTemplateNameChange,
  onConfirmCreate,
  onCancelCreate,
  canSaveMore,
  saveSuccess,
  onSaveTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onExportTemplate,
  onExportAllTemplates,
  onImportClick,
  onClose,
}: StudioHeaderProps) {
  return (
    <div className="hidden md:flex items-center justify-between gap-4 px-5 py-3 border-b">
      {/* Left: Title + mode toggle */}
      <div className="flex items-center gap-3 shrink-0">
        <DialogTitle className="text-base font-semibold">
          Image Studio
        </DialogTitle>
        {hasCollageMode && (
          <ModeToggle
            activeMode={activeMode}
            onChange={onModeChange}
            size="md"
          />
        )}
      </div>

      {/* Right: All controls */}
      <div className="flex items-center gap-3 shrink-0">
        {period && onPeriodChange && (
          <PeriodToggle
            allowedPeriods={allowedPeriods}
            activePeriod={period}
            onChange={onPeriodChange}
          />
        )}

        <ChartTypeToggle
          activeType={chartType}
          onChange={onChartTypeChange}
          size="md"
        />

        <div className="h-5 w-px bg-border" />

        {isRenamingTemplate && selectedTemplateId ? (
          <TemplateNameInput
            value={renameValue}
            onChange={onRenameValueChange}
            onConfirm={onConfirmRename}
            onCancel={onCancelRename}
            placeholder="Template name"
            size="md"
          />
        ) : isCreatingTemplate ? (
          <TemplateNameInput
            value={newTemplateName}
            onChange={onNewTemplateNameChange}
            onConfirm={onConfirmCreate}
            onCancel={onCancelCreate}
            placeholder="New template name"
            requireValue
            size="md"
          />
        ) : (
          <>
            <PresetSelector
              value={selectedTemplateId || selectedPreset}
              onChange={onPresetChange}
              showLabel={false}
              customTemplates={templates}
            />

            <div className="flex items-center gap-1">
              {showCustomizePanel && (
                <>
                  <TemplateActionsMenu
                    selectedTemplateId={selectedTemplateId}
                    canSaveMore={canSaveMore}
                    onRename={onStartRename}
                    onDuplicate={onDuplicateTemplate}
                    onExport={onExportTemplate}
                    onDelete={onDeleteTemplate}
                    size="md"
                  />

                  <ImportExportMenu
                    templatesCount={templates.length}
                    onImport={onImportClick}
                    onExportAll={onExportAllTemplates}
                    size="md"
                  />

                  <SaveTemplateButton
                    selectedTemplateId={selectedTemplateId}
                    canSaveMore={canSaveMore}
                    saveSuccess={saveSuccess}
                    onClick={onSaveTemplate}
                    size="md"
                  />
                </>
              )}

              <KeyboardShortcutsHelp />

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
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function ModeToggle({
  activeMode,
  onChange,
  size,
}: {
  activeMode: ExportMode;
  onChange: (mode: ExportMode) => void;
  size: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const radius = size === "sm" ? "rounded-md p-0.5" : "rounded-lg p-0.5";

  return (
    <div className={`flex items-center bg-muted border border-border ${radius}`}>
      {(["single", "collage"] as ExportMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={cn(
            `${padding} font-medium transition-colors`,
            size === "sm" ? "rounded" : "rounded-md",
            activeMode === m
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {m === "single" ? "Single" : "Collage"}
        </button>
      ))}
    </div>
  );
}

function PeriodToggle({
  allowedPeriods,
  activePeriod,
  onChange,
}: {
  allowedPeriods: Period[];
  activePeriod: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center bg-muted border border-border rounded-lg p-0.5">
      {allowedPeriods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-md transition-colors min-w-[28px]",
            activePeriod === p
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function ChartTypeToggle({
  activeType,
  onChange,
  size,
}: {
  activeType: ChartType;
  onChange: (type: ChartType) => void;
  size: "sm" | "md";
}) {
  const padding = size === "sm" ? "p-1" : "p-1.5";
  const radius = size === "sm" ? "rounded-md p-0.5" : "rounded-lg p-0.5";

  return (
    <div className={`flex items-center bg-muted border border-border ${radius}`}>
      {CHART_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={cn(
            `${padding} rounded transition-colors`,
            size === "md" && "rounded-md",
            activeType === type
              ? "bg-background text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          title={type.charAt(0).toUpperCase() + type.slice(1)}
        >
          {CHART_TYPE_ICONS[type]}
        </button>
      ))}
    </div>
  );
}

interface TemplateNameInputProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  placeholder: string;
  requireValue?: boolean;
  size: "sm" | "md";
}

function TemplateNameInput({
  value,
  onChange,
  onConfirm,
  onCancel,
  placeholder,
  requireValue,
  size,
}: TemplateNameInputProps) {
  const inputCls =
    size === "sm"
      ? "flex-1 min-w-0 px-2 py-1 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
      : "min-w-[150px] px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary";
  const btnCls =
    size === "sm"
      ? "p-1 rounded"
      : "p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30";
  const cancelCls =
    size === "sm"
      ? "p-1 rounded text-muted-foreground"
      : "p-1.5 rounded-md text-muted-foreground hover:bg-muted";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  const canConfirm = requireValue ? value.trim().length > 0 : true;

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (requireValue && !value.trim()) return;
            onConfirm();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className={inputCls}
        autoFocus
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => {
          if (canConfirm) onConfirm();
        }}
        disabled={!canConfirm}
        className={cn(
          btnCls,
          canConfirm ? "text-green-600" : "text-muted-foreground/30 cursor-not-allowed"
        )}
      >
        <Check className={iconSize} />
      </button>
      <button type="button" onClick={onCancel} className={cancelCls}>
        <X className={iconSize} />
      </button>
    </div>
  );
}

function ImportExportMenu({
  templatesCount,
  onImport,
  onExportAll,
  size,
}: {
  templatesCount: number;
  onImport: () => void;
  onExportAll: () => void;
  size: "sm" | "md";
}) {
  const trigger = (
    <button
      type="button"
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <Upload className="h-4 w-4" />
    </button>
  );

  return (
    <DropdownMenu>
      {size === "md" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Import/Export templates</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onImport}>
          <Upload className="h-3.5 w-3.5 mr-2" />
          Import templates
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportAll} disabled={templatesCount === 0}>
          <FileDown className="h-3.5 w-3.5 mr-2" />
          Export all ({templatesCount})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TemplateActionsMenuProps {
  selectedTemplateId: string | null;
  canSaveMore: boolean;
  onRename: () => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  size: "sm" | "md";
}

function TemplateActionsMenu({
  selectedTemplateId,
  canSaveMore,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  size,
}: TemplateActionsMenuProps) {
  const trigger = (
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
  );

  return (
    <DropdownMenu>
      {size === "md" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {selectedTemplateId ? "Template options" : "Select a custom template"}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      {selectedTemplateId && (
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onRename}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDuplicate(selectedTemplateId)}
            disabled={!canSaveMore}
          >
            <Copy className="h-3.5 w-3.5 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport(selectedTemplateId)}>
            <FileDown className="h-3.5 w-3.5 mr-2" />
            Export
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(selectedTemplateId)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

interface SaveTemplateButtonProps {
  selectedTemplateId: string | null;
  canSaveMore: boolean;
  saveSuccess: boolean;
  onClick: () => void;
  size: "sm" | "md";
}

function SaveTemplateButton({
  selectedTemplateId,
  canSaveMore,
  saveSuccess,
  onClick,
  size,
}: SaveTemplateButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={(!selectedTemplateId && !canSaveMore) || saveSuccess}
      className={cn(
        "p-1.5 rounded-md transition-all duration-200",
        saveSuccess
          ? "text-green-600 bg-green-100 dark:bg-green-900/30"
          : selectedTemplateId || canSaveMore
            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
            : "text-muted-foreground/30 cursor-not-allowed"
      )}
    >
      {saveSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
    </button>
  );

  if (size === "sm") return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {saveSuccess
          ? "Saved!"
          : selectedTemplateId
            ? "Save template"
            : canSaveMore
              ? "Save as new template"
              : "Max templates reached"}
      </TooltipContent>
    </Tooltip>
  );
}

function KeyboardShortcutsHelp() {
  return (
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
              <div
                key={i}
                className="flex items-center justify-between gap-4 text-xs"
              >
                <span className="text-primary-foreground/70">
                  {shortcut.description}
                </span>
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
  );
}
