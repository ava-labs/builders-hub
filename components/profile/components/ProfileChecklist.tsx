"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface ProfileChecklistProps {
    email: boolean;
    profilePicture: boolean;
    country: boolean;
    company: boolean;
    wallet: boolean;
    teamName: boolean;
}

interface ChecklistItemProps {
    completed: boolean;
    label: string;
}

function ChecklistItem({ completed, label }: ChecklistItemProps) {
    return (
        <div className="flex items-center gap-3">
            <div
                className={cn(
                    "w-4 h-4 rounded-sm flex items-center justify-center border transition-colors",
                    completed
                        ? "bg-red-500 border-red-500"
                        : "border-zinc-400 dark:border-zinc-600"
                )}
            >
                {completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <span
                className={cn(
                    "text-sm",
                    completed
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400"
                )}
            >
                {label}
            </span>
        </div>
    );
}

export function ProfileChecklist({
    email,
    profilePicture,
    country,
    company,
    wallet,
    teamName,
}: ProfileChecklistProps) {
   
    return (
        <div className="bg-white dark:bg-zinc-900 dark:border-zinc-800 p-6 shadow-sm max-w-[270px]">
            <div className="flex flex-col items-left justify-between ">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Profile Checklist
                </h3>
                <br />
                <h2>Complete all steps to reach 100% and unlock advanced benefits.</h2>
            </div>
            <div className="space-y-3">
                <ChecklistItem completed={email} label="Complete email" />
                <ChecklistItem completed={profilePicture} label="Complete profile picture" />
                <ChecklistItem completed={country} label="Add your country" />
                <ChecklistItem completed={company} label="Add your company" />
                <ChecklistItem completed={wallet} label="Add your wallet" />
                <ChecklistItem completed={teamName} label="Add a team name" />
            </div>

    
        </div>
    );
}

