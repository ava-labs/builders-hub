"use client";

import PerformanceMonitor from "@/components/toolbox/console/layer-1/performance-monitor/PerformanceMonitor";
import RPCMethodsChecker from "@/components/toolbox/console/layer-1/performance-monitor/RPCMethodsChecker";

export default function PerformanceMonitorPage() {
    return (
        <div className="space-y-12">
            <PerformanceMonitor />
            <hr className="border-zinc-200 dark:border-zinc-800" />
            <RPCMethodsChecker />
        </div>
    );
}
