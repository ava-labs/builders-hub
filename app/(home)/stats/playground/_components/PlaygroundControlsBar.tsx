"use client";
import { Search, X, Plus, Globe, Lock, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalTimeFilterPopover } from "./GlobalTimeFilterPopover";
import type { GlobalTimeFilterState } from "../_hooks/useGlobalTimeFilter";

interface PlaygroundControlsBarProps {
  isOwner: boolean;

  searchTerm: string;
  onSearchChange: (term: string) => void;

  filter: GlobalTimeFilterState;

  onAddChart: () => void;

  isPublic: boolean;
  onTogglePublic: () => void;

  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export function PlaygroundControlsBar({
  isOwner,
  searchTerm,
  onSearchChange,
  filter,
  onAddChart,
  isPublic,
  onTogglePublic,
  hasChanges,
  isSaving,
  onSave,
}: PlaygroundControlsBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <div className="relative flex-1 sm:flex-none sm:w-64">
          <Search className="absolute left-3 sm:left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
          <Input
            placeholder="Search charts"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 sm:h-10 pl-9 sm:pl-10 pr-9 sm:pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 text-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full z-20 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isOwner && <GlobalTimeFilterPopover filter={filter} />}
      </div>

      {isOwner && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            onClick={onAddChart}
            className="flex-shrink-0 bg-black dark:bg-white text-white dark:text-black transition-colors hover:bg-neutral-800 dark:hover:bg-neutral-200 h-9 sm:h-10 px-3 sm:px-4"
            title="Add New Chart"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="text-xs sm:text-sm">Add Chart</span>
          </Button>
          <Button
            onClick={onTogglePublic}
            className="flex items-center gap-1.5 px-3 h-9 sm:h-10 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
            title={isPublic ? "Make private" : "Make public"}
          >
            {isPublic ? (
              <>
                <Globe className="h-4 w-4" />
                <span>Public</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Private</span>
              </>
            )}
          </Button>
          <Button
            onClick={onSave}
            disabled={!hasChanges || isSaving}
            className="flex-shrink-0 bg-black dark:bg-white text-white dark:text-black transition-colors hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" />
                <span>Save</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
