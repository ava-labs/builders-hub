"use client";

import { FileText, Link2, QrCode, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FooterSettings } from "../types";

interface FooterControlProps {
  value: FooterSettings;
  onChange: (settings: Partial<FooterSettings>) => void;
}

type FooterOptionKey = "showSources" | "showUrl" | "showQrCode" | "showCaptureDate";

const FOOTER_OPTIONS: {
  key: FooterOptionKey;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "showSources", label: "Sources", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "showUrl", label: "URL", icon: <Link2 className="h-3.5 w-3.5" /> },
  { key: "showQrCode", label: "QR", icon: <QrCode className="h-3.5 w-3.5" /> },
  { key: "showCaptureDate", label: "Date", icon: <Calendar className="h-3.5 w-3.5" /> },
];

export function FooterControl({ value, onChange }: FooterControlProps) {
  return (
    <div className="flex flex-wrap gap-1">
        {FOOTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              const newValue = !value[option.key];
              // If enabling an option and footer is not visible, make it visible
              if (newValue && !value.visible) {
                onChange({ visible: true, [option.key]: true });
              } else {
                // If disabling the last option, hide the footer
                const otherOptions = FOOTER_OPTIONS.filter(o => o.key !== option.key);
                const anyOtherEnabled = otherOptions.some(o => value[o.key]);
                if (!newValue && !anyOtherEnabled) {
                  onChange({ visible: false, [option.key]: false });
                } else {
                  onChange({ [option.key]: newValue });
                }
              }
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors border",
              value[option.key]
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/80 hover:border-foreground/30"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
    </div>
  );
}
