"use client";
import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "./types";

interface SortButtonProps {
  field: string;
  activeField: string;
  direction: SortDirection;
  onSort: (field: string) => void;
  align?: "left" | "right" | "center";
  children: ReactNode;
}

export function SortButton({
  field,
  activeField,
  direction,
  onSort,
  align = "left",
  children,
}: SortButtonProps) {
  const justify =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <button
      className={`w-full flex items-center gap-1.5 transition-colors hover:text-black dark:hover:text-white ${justify}`}
      onClick={() => onSort(field)}
    >
      {children}
      {activeField === field ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}
