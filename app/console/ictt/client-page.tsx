"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BridgeShell } from "@/components/toolbox/console/ictt/bridge/BridgeShell";

interface Props {
    initialPhase?: string;
    initialRemote?: string;
}

export default function IcttBridgeClientPage({ initialPhase, initialRemote }: Props) {
    return (
        <div className="flex flex-col gap-4">
            <BridgeShell initialPhase={initialPhase} initialRemote={initialRemote} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Need the previous step-by-step flow?{" "}
                <Link
                    href="/console/ictt/legacy/setup"
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                    Use legacy version
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </p>
        </div>
    );
}
