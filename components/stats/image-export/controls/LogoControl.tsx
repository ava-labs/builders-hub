"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { Upload, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LogoSettings, LogoPosition } from "../types";

interface LogoControlProps {
  value: LogoSettings;
  onChange: (settings: Partial<LogoSettings>) => void;
}

const LOGO_TYPE_OPTIONS = [
  { id: "avalanche", label: "Avalanche", icon: "/small-logo.png" },
  { id: "none", label: "None", icon: null },
];

const POSITION_OPTIONS = [
  { id: "inline", label: "Inline" },
  { id: "header", label: "Header" },
];

export function LogoControl({ value, onChange }: LogoControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousUrlRef = useRef<string | undefined>(undefined);

  // Clean up blob URLs when customUrl changes or component unmounts
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (previousUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke previous blob URL if it exists
      if (value.customUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(value.customUrl);
      }
      const url = URL.createObjectURL(file);
      previousUrlRef.current = url;
      onChange({ type: "custom", customUrl: url });
    }
  };

  const handleRemove = () => {
    // Revoke blob URL if it exists
    if (value.customUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(value.customUrl);
    }
    previousUrlRef.current = undefined;
    onChange({ type: "none", customUrl: undefined });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Logo</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Upload custom logo"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Remove logo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Select
          value={value.type === "custom" ? "custom" : value.type}
          onValueChange={(v) => {
            if (v === "custom") {
              fileInputRef.current?.click();
            } else {
              onChange({ type: v as "avalanche" | "none" });
            }
          }}
        >
          <SelectTrigger className="flex-1">
            <div className="flex items-center gap-2">
              {value.type === "avalanche" && (
                <Image
                  src="/small-logo.png"
                  alt="Avalanche"
                  width={20}
                  height={20}
                  className="rounded"
                />
              )}
              {value.type === "custom" && value.customUrl && (
                <Image
                  src={value.customUrl}
                  alt="Custom"
                  width={20}
                  height={20}
                  className="rounded object-contain"
                />
              )}
              <SelectValue>
                {value.type === "custom"
                  ? "Custom"
                  : LOGO_TYPE_OPTIONS.find((o) => o.id === value.type)?.label}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            {LOGO_TYPE_OPTIONS.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
              >
                <div className="flex items-center gap-2">
                  {option.icon && (
                    <Image
                      src={option.icon}
                      alt={option.label}
                      width={20}
                      height={20}
                      className="rounded"
                    />
                  )}
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.position}
          onValueChange={(v) => onChange({ position: v as LogoPosition })}
          disabled={value.type === "none"}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue>
              {POSITION_OPTIONS.find((o) => o.id === value.position)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {POSITION_OPTIONS.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
