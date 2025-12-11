"use client";

import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SortIconProps {
  column: string;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  iconVariant?: "chevron" | "arrow";
  className?: string;
}

export function SortIcon({
  column,
  sortColumn,
  sortDirection,
  iconVariant = "chevron",
  className,
}: SortIconProps) {
  const isActive = sortColumn === column;
  const baseClassName = cn("w-3 h-3 ml-1", className);

  if (iconVariant === "arrow") {
    if (!isActive) {
      return <ArrowUpDown className={cn(baseClassName, "opacity-40")} />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className={baseClassName} />
    ) : (
      <ArrowDown className={baseClassName} />
    );
  }

  // Default: chevron variant
  if (!isActive) {
    return <ChevronsUpDown className={cn(baseClassName, "opacity-40")} />;
  }
  return sortDirection === "asc" ? (
    <ChevronUp className={baseClassName} />
  ) : (
    <ChevronDown className={baseClassName} />
  );
}
