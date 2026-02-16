"use client";

import { RWADashboard } from "@/components/rwa/RWADashboard";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";

export default function RWAStatsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-full min-w-0">
      <StatsBubbleNav />
      <RWADashboard />
    </div>
  );
}
