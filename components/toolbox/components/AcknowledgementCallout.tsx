"use client";

import { ReactNode } from "react";
import { Callout } from "fumadocs-ui/components/callout";
import { Checkbox } from "./Checkbox";
import { cn } from "../lib/utils";

export type AcknowledgementCalloutType = "info" | "warn" | "error";

interface AcknowledgementCalloutProps {
    title?: string;
    children: ReactNode;
    checkboxLabel: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    type?: AcknowledgementCalloutType;
    visible?: boolean;
    className?: string;
}

const typeStyles = {
    info: {
        borderColor: "border-blue-500 dark:border-blue-400",
        glowColor: "bg-blue-500/20 dark:bg-blue-500/10",
        dividerColor: "border-blue-200/60 dark:border-blue-700/60",
        checkboxBg: "bg-blue-50 dark:bg-blue-950/30",
    },
    warn: {
        borderColor: "border-amber-500 dark:border-amber-400",
        glowColor: "bg-amber-500/20 dark:bg-amber-500/10",
        dividerColor: "border-amber-200/60 dark:border-amber-700/60",
        checkboxBg: "bg-amber-50 dark:bg-amber-950/30",
    },
    error: {
        borderColor: "border-red-500 dark:border-red-400",
        glowColor: "bg-red-500/20 dark:bg-red-500/10",
        dividerColor: "border-red-200/60 dark:border-red-700/60",
        checkboxBg: "bg-red-50 dark:bg-red-950/30",
    },
};

export function AcknowledgementCallout({
    title,
    children,
    checkboxLabel,
    checked,
    onCheckedChange,
    type = "warn",
    visible = true,
    className,
}: AcknowledgementCalloutProps) {
    if (!visible) return null;

    const styles = typeStyles[type];

    return (
        <div className={cn("relative mb-6", className)}>
            <div className={cn("absolute -inset-1 rounded-lg blur-sm opacity-60", styles.glowColor)} />
            <Callout title={title} type={type} className={cn("relative border-2 shadow-lg", styles.borderColor)}>
                {/* Content area */}
                <div className="text-sm">
                    {children}
                </div>
                
                {/* Acknowledgement section */}
                <div className={cn(
                    "pt-3 mt-4 border-t",
                    styles.dividerColor
                )}>
                    <div className={cn(
                        "rounded-md p-3 transition-colors",
                        styles.checkboxBg
                    )}>
                        <Checkbox
                            label={checkboxLabel}
                            checked={checked}
                            onChange={onCheckedChange}
                            className="mb-0"
                        />
                    </div>
                </div>
            </Callout>
        </div>
    );
}

