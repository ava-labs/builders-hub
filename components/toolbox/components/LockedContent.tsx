"use client";

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "../lib/utils";

interface LockedContentProps {
    isUnlocked: boolean;
    lockedMessage?: string;
    children: ReactNode;
    className?: string;
}

export function LockedContent({
    isUnlocked,
    lockedMessage = "Complete the prerequisites above to unlock this section",
    children,
    className,
}: LockedContentProps) {
    return (
        <div className={cn("relative", className)}>
            {/* Content (blurred when locked) */}
            <div
                className={cn(
                    "transition-all duration-300",
                    !isUnlocked && "blur-[4px] pointer-events-none select-none"
                )}
            >
                {children}
            </div>

            {/* Lock overlay */}
            {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/30 backdrop-blur-[1px]">
                    <div className="text-center max-w-md flex flex-col items-center gap-3">
                            <Lock className="w-10 h-10 text-zinc-700 dark:text-zinc-300" />
                        <p className="text-sm text-zinc-900 dark:text-white drop-shadow-sm w-75">
                            {lockedMessage}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

